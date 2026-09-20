/**
 * AutoPost Iklan – Marketplace: pekerja latar (versi web app).
 *
 * Tiap menit bertanya ke dasbor (API /api/ekstensi) apakah ada iklan yang jatuh
 * tempo. Bila ada: foto disiapkan (dari server, atau dibaca dari folder di
 * komputer), lalu formulir Marketplace dibuka dan diisi oleh isi-formulir.js.
 * Hasilnya dilaporkan kembali ke dasbor.
 */

const URL_BUAT = {
  barang: 'https://www.facebook.com/marketplace/create/item',
  kendaraan: 'https://www.facebook.com/marketplace/create/vehicle'
};
const BATAS_TUGAS_MS = 8 * 60 * 1000;
const SENYAP_MAKS_MS = 75 * 1000;
const BATAS_PANGGIL_MS = 90 * 1000;
const MAKS_ULANG = 2;
const POLA_LOGIN = /facebook\.com\/(login|checkpoint|two_step_verification|recover)|\/login\.php/i;
const VERSI = chrome.runtime.getManifest().version;

chrome.runtime.onInstalled.addListener(pasangAlarm);
chrome.runtime.onStartup.addListener(pasangAlarm);
function pasangAlarm() {
  chrome.alarms.create('cek', { periodInMinutes: 1 });
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'cek') putaran(false).catch(() => {}); });

// ------------------------------------------------------------ penyimpanan

async function setelan() {
  return chrome.storage.local.get({ url: '', kunci: '', aktif: true, tampilkan: true });
}
async function ambilTugas() {
  return (await chrome.storage.session.get('tugas')).tugas || null;
}
async function simpanTugas(t) {
  await chrome.storage.session.set({ tugas: t });
}
async function catatStatus(o) {
  const lama = (await chrome.storage.local.get({ status: {} })).status;
  await chrome.storage.local.set({ status: Object.assign(lama, o) });
}

// ------------------------------------------------------------ dasbor

async function panggil(aksi, data) {
  const s = await setelan();
  if (!s.url || !s.kunci) throw new Error('URL dasbor dan kunci belum diisi (klik ikon ekstensi).');
  let res;
  const henti = new AbortController();
  const penghitung = setTimeout(() => henti.abort(), BATAS_PANGGIL_MS);
  try {
    res = await fetch(s.url, {
      method: 'POST', redirect: 'follow', signal: henti.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ aksi, kunci: s.kunci, versiEkstensi: VERSI }, data || {}))
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? 'Dasbor tidak menjawab dalam 90 detik (aksi ' + aksi + ').'
      : 'Tidak bisa menghubungi dasbor (' + e.message + '). Periksa internet, URL, dan izin situs ekstensi.');
  } finally {
    clearTimeout(penghitung);
  }
  const teks = await res.text();
  let j;
  try {
    j = JSON.parse(teks);
  } catch (e) {
    throw new Error('Balasan dasbor tidak valid (HTTP ' + res.status + '). Pastikan URL berakhiran /api/ekstensi.');
  }
  if (!j.ok) {
    const g = new Error(j.galat || 'Galat tidak dikenal.');
    g.kode = j.kode;
    throw g;
  }
  return j;
}

// ------------------------------------------------------------ foto

let FOTO = { kunci: '', janji: [], lokal: null };

function mulaiUnduhFoto(t) {
  const kunci = t.id + ':' + t.token;
  if (FOTO.kunci === kunci) return;
  FOTO = { kunci, janji: new Array(t.jumlahFoto || 0), lokal: null };
  let berikut = 0;
  const pekerja = async () => {
    while (berikut < (t.jumlahFoto || 0)) {
      const i = berikut++;
      FOTO.janji[i] = panggil('foto', { id: t.id, token: t.token, i });
      try { await FOTO.janji[i]; } catch (e) { /* diulang saat diminta */ }
    }
  };
  for (let k = 0; k < 3; k++) pekerja();
}

async function ambilFoto(t, i) {
  const kunci = t.id + ':' + t.token;
  if (FOTO.kunci === kunci && FOTO.lokal) {
    const f = FOTO.lokal[i];
    if (!f) throw new Error('Foto ke-' + (i + 1) + ' tidak ada di folder.');
    return f;
  }
  if (FOTO.kunci === kunci && FOTO.janji[i]) {
    try { return await FOTO.janji[i]; } catch (e) { /* coba sekali lagi di bawah */ }
  }
  return panggil('foto', { id: t.id, token: t.token, i });
}

/** Windows/POSIX path → URL folder. "D:\Foto Mobil\B123" → "file:///D:/Foto%20Mobil/B123/" */
function urlFolder(folder) {
  let p = String(folder || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (!p) throw new Error('Folder foto kosong.');
  if (!p.startsWith('/')) p = '/' + p;
  return 'file://' + p.split('/').map(encodeURIComponent).join('/').replace(/%3A/gi, ':') + '/';
}

/** Buka folder di tab tersembunyi, baca gambarnya, lalu tutup tabnya. */
async function bacaFolderLokal(tugas) {
  const url = urlFolder(tugas.foto.folder);
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });
  } catch (e) {
    throw new Error('Tidak bisa membuka folder ' + tugas.foto.folder + ' (' + e.message + ').');
  }
  try {
    await new Promise((selesai, gagal) => {
      const batas = setTimeout(() => { bersih(); gagal(new Error('Folder tidak terbuka dalam 20 detik.')); }, 20000);
      const dengar = (id, ubah) => { if (id === tab.id && ubah.status === 'complete') { bersih(); selesai(); } };
      const bersih = () => { clearTimeout(batas); chrome.tabs.onUpdated.removeListener(dengar); };
      chrome.tabs.onUpdated.addListener(dengar);
    });
    let hasil;
    try {
      hasil = await chrome.tabs.sendMessage(tab.id, { jenis: 'bacaFolder' });
    } catch (e) {
      throw new Error('Folder tidak bisa dibaca. Buka chrome://extensions → detail ekstensi ini → nyalakan "Izinkan akses ke URL file".');
    }
    if (!hasil || !hasil.ok) throw new Error(hasil?.galat || 'Folder tidak bisa dibaca.');
    return hasil.berkas;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// ------------------------------------------------------------ putaran

let sibuk = false;

async function putaran(paksa) {
  const s = await setelan();
  const tugas = await ambilTugas();
  if (tugas) return jagaTugas(tugas);
  if (!s.aktif && !paksa) return { pesan: 'Ekstensi dijeda.' };
  if (sibuk) return { pesan: 'Sedang memeriksa…' };
  sibuk = true;
  try {
    const r = await panggil('ambil');
    await catatStatus({ terakhir: Date.now(), galat: '', versiDasbor: r.versi || '?',
      pesan: r.tugas ? 'Memproses: ' + r.tugas.judul : (r.tunggu || 'Tidak ada iklan yang jatuh tempo.') });
    if (!r.tugas) return { pesan: r.tunggu || 'Tidak ada iklan yang jatuh tempo.' };
    const t = r.tugas;

    if (t.foto?.tipe === 'folder') {
      await catatStatus({ pesan: t.judul + ': membaca folder foto' });
      laporProgres(t, 'membaca folder foto di komputer');
      try {
        const berkas = await bacaFolderLokal(t);
        FOTO = { kunci: t.id + ':' + t.token, janji: [], lokal: berkas };
        t.jumlahFoto = berkas.length;
      } catch (e) {
        await selesai({ ...t, tabId: null, langkah: 'membaca folder foto' }, { hasil: 'gagal', pasti: true, pesan: e.message });
        return { galat: e.message };
      }
    } else {
      mulaiUnduhFoto(t);
    }

    const tabId = await bukaFormulir(t, s.tampilkan);
    await simpanTugas(Object.assign({}, t, { tabId, mulai: Date.now(), kabar: Date.now(), dimulai: false, ulang: 0, langkah: 'membuka formulir' }));
    laporProgres(t, 'membuka formulir Facebook (' + (t.jenis === 'kendaraan' ? 'kendaraan' : 'barang') + ')');
    const galatSuntik = await suntikPengisi(tabId);
    if (galatSuntik) laporProgres(t, galatSuntik);
    return { pesan: 'Memproses: ' + t.judul };
  } catch (e) {
    await catatStatus({ terakhir: Date.now(), galat: e.message });
    return { galat: e.message };
  } finally {
    sibuk = false;
  }
}

/** Tunggu tab selesai memuat (atau sudah selesai). */
async function tungguMuat(tabId, ms = 25000) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab && tab.status === 'complete') return tab;
  return new Promise((selesai) => {
    const batas = setTimeout(() => { bersih(); selesai(null); }, ms);
    const dengar = (id, ubah) => { if (id === tabId && ubah.status === 'complete') { bersih(); chrome.tabs.get(tabId).then(selesai, () => selesai(null)); } };
    const bersih = () => { clearTimeout(batas); chrome.tabs.onUpdated.removeListener(dengar); };
    chrome.tabs.onUpdated.addListener(dengar);
  });
}

/**
 * Suntikkan skrip pengisi. Manifes sudah mendaftarkannya untuk halaman buat iklan,
 * tetapi penyuntikan langsung ini membuatnya tetap jalan meski URL Facebook berbeda
 * dari pola yang didaftarkan (mis. dialihkan ke domain/jalur lain).
 */
async function suntikPengisi(tabId) {
  const tab = await tungguMuat(tabId);
  const url = tab?.url || '';
  if (url && !/facebook\.com/.test(url)) return 'Halaman yang terbuka bukan Facebook: ' + url.split('?')[0];
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['isi-formulir.js'] });
  } catch (e) {
    return 'Skrip pengisi tidak bisa dijalankan di ' + (url.split('?')[0] || 'halaman itu') + ' (' + e.message + ').';
  }
  return '';
}

async function bukaFormulir(t, tampilkan) {
  const url = URL_BUAT[t.jenis] || URL_BUAT.barang;
  if (tampilkan) {
    const jendela = await chrome.windows.create({ url, focused: true, type: 'normal', width: 1100, height: 900 });
    return jendela.tabs[0].id;
  }
  return (await chrome.tabs.create({ url, active: false })).id;
}

async function jagaTugas(tugas) {
  if (Date.now() - tugas.mulai > BATAS_TUGAS_MS) {
    await selesai(tugas, { hasil: 'gagal', pasti: !tugas.terbitDiklik, pesan: 'Waktu habis (8 menit) saat ' + (tugas.langkah || 'membuka formulir') + '.' });
    return { pesan: 'Tugas sebelumnya kehabisan waktu.' };
  }
  if (Date.now() - (tugas.kabar || tugas.mulai) < SENYAP_MAKS_MS) return { pesan: 'Sedang memproses: ' + tugas.judul };

  let hidup = false;
  try { hidup = await chrome.tabs.sendMessage(tugas.tabId, { jenis: 'hidup' }) === true; } catch (e) { hidup = false; }
  if (hidup) return { pesan: 'Sedang memproses: ' + tugas.judul };
  let tab = null;
  try { tab = await chrome.tabs.get(tugas.tabId); } catch (e) { tab = null; }
  if (tab && !tugas.terbitDiklik && (tugas.ulang || 0) < MAKS_ULANG) {
    tugas.ulang = (tugas.ulang || 0) + 1;
    tugas.dimulai = false;
    tugas.kabar = Date.now();
    tugas.langkah = 'memuat ulang formulir (percobaan ' + (tugas.ulang + 1) + ')';
    await simpanTugas(tugas);
    laporProgres(tugas, tugas.langkah);
    await chrome.tabs.update(tugas.tabId, { url: URL_BUAT[tugas.jenis] || URL_BUAT.barang });
    await suntikPengisi(tugas.tabId);
    return { pesan: 'Memuat ulang formulir: ' + tugas.judul };
  }
  const dimana = tab
    ? ' Halaman yang terbuka: ' + String(tab.url || '').split('?')[0] + (tab.title ? ' — "' + tab.title + '"' : '') + '.'
    : ' Tab formulir sudah tertutup.';
  const saran = tab && !/\/marketplace\/create/.test(String(tab.url || ''))
    ? ' Facebook tidak membuka halaman buat iklan (mungkin diminta login, verifikasi, atau Marketplace tidak tersedia untuk akun ini). Buka halaman itu sekali secara manual di Chrome yang sama, lalu jadwalkan ulang.'
    : ' Coba buka chrome://extensions → pastikan ekstensi aktif dan tidak ada galat, lalu jadwalkan ulang.';
  await selesai(tugas, {
    hasil: 'gagal', pasti: !tugas.terbitDiklik,
    pesan: 'Skrip pengisi tidak merespons saat ' + (tugas.langkah || 'membuka formulir') + '.' + dimana + saran
  });
  return { pesan: 'Tugas dihentikan.' };
}

function laporProgres(tugas, langkah) {
  panggil('progres', { id: tugas.id, token: tugas.token, langkah }).catch(() => {});
}

let selesaiUntuk = '';
async function selesai(tugas, m) {
  if (selesaiUntuk === tugas.token) return;
  selesaiUntuk = tugas.token;
  await chrome.storage.session.remove('tugas');
  if (m.diagnosa) await chrome.storage.local.set({ diagnosa: m.diagnosa });
  let catatan = '';
  try {
    await panggil('lapor', {
      id: tugas.id, token: tugas.token, hasil: m.hasil, pesan: m.pesan || '', url: m.url || '',
      pasti: m.pasti !== false, diagnosa: m.diagnosa || null
    });
  } catch (e) {
    catatan = ' (gagal melapor ke dasbor: ' + e.message + ')';
  }
  const judul = { terbit: '✅ Terbit di Marketplace', uji: '🧪 Mode uji: formulir terisi', gagal: '⚠️ Gagal memposting' }[m.hasil] || 'AutoPost Iklan';
  chrome.notifications.create({
    type: 'basic', iconUrl: 'ikon128.png', title: judul,
    message: tugas.judul + (m.pesan ? ' — ' + m.pesan : '') + catatan, priority: m.hasil === 'terbit' ? 0 : 2
  });
  await catatStatus({ hasilTerakhir: { waktu: Date.now(), judul: tugas.judul, hasil: m.hasil, pesan: (m.pesan || '') + catatan } });
  if (m.hasil === 'terbit' && tugas.tabId) {
    setTimeout(() => { chrome.tabs.remove(tugas.tabId).catch(() => {}); }, 5000);
  }
}

// ------------------------------------------------------------ pesan

chrome.runtime.onMessage.addListener((m, pengirim, balas) => {
  tangani(m, pengirim).then(balas, (e) => balas({ galat: e.message }));
  return true;
});

async function tangani(m, pengirim) {
  if (m.jenis === 'cekSekarang') return putaran(true);
  if (m.jenis === 'tes') return panggil('ping');
  if (m.jenis === 'rekam') { await panggil('rekam', { diagnosa: m.diagnosa }); return true; }
  if (m.jenis === 'folderSiap') return true;

  const tugas = await ambilTugas();
  const milik = tugas && pengirim.tab && pengirim.tab.id === tugas.tabId;
  if (!milik) return null;
  tugas.kabar = Date.now();

  if (m.jenis === 'halo') {
    if (tugas.dimulai && tugas.instans === m.instans) return null;
    if (tugas.dimulai) {
      if (tugas.terbitDiklik || (tugas.ulang || 0) >= MAKS_ULANG) { await simpanTugas(tugas); return null; }
      tugas.ulang = (tugas.ulang || 0) + 1;
      laporProgres(tugas, 'halaman dimuat ulang oleh Facebook — mengulang (percobaan ' + (tugas.ulang + 1) + ')');
    }
    tugas.dimulai = true;
    tugas.instans = m.instans;
    await simpanTugas(tugas);
    if (tugas.foto?.tipe !== 'folder') mulaiUnduhFoto(tugas);
    const s = await setelan();
    return Object.assign({}, tugas, { tampilkan: s.tampilkan });
  }
  if (m.jenis === 'foto') {
    await simpanTugas(tugas);
    const r = await ambilFoto(tugas, m.i);
    return { nama: r.nama, mime: r.mime, data: r.data };
  }
  if (m.jenis === 'langkah') {
    tugas.langkah = m.teks;
    if (m.terbitDiklik) tugas.terbitDiklik = true;
    await simpanTugas(tugas);
    await catatStatus({ pesan: tugas.judul + ': ' + m.teks });
    laporProgres(tugas, m.teks);
    return true;
  }
  if (m.jenis === 'hasil') { await selesai(tugas, m); return true; }
  return null;
}

chrome.tabs.onUpdated.addListener(async (tabId, ubah) => {
  if (!ubah.url || !POLA_LOGIN.test(ubah.url)) return;
  const tugas = await ambilTugas();
  if (tugas && tugas.tabId === tabId) {
    await selesai(tugas, {
      hasil: 'gagal', pasti: true,
      pesan: 'Facebook meminta login/verifikasi di Chrome ini. Login dulu, lalu jadwalkan ulang.'
    });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tugas = await ambilTugas();
  if (tugas && tugas.tabId === tabId) {
    await selesai(tugas, { hasil: 'gagal', pasti: !tugas.terbitDiklik, pesan: 'Tab formulir ditutup sebelum selesai (' + (tugas.langkah || '-') + ').' });
  }
});
