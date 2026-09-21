const $ = (id) => document.getElementById(id);

function pesan(jenis, teks) {
  $('pesan').innerHTML = '';
  if (!teks) return;
  const d = document.createElement('div');
  d.className = 'pesan ' + jenis;
  d.textContent = teks;
  $('pesan').appendChild(d);
}

function kirim(m) {
  return new Promise((ok, gagal) => chrome.runtime.sendMessage(m, (r) => {
    if (chrome.runtime.lastError) return gagal(new Error(chrome.runtime.lastError.message));
    if (r && r.galat) return gagal(new Error(r.galat));
    ok(r);
  }));
}

function waktu(ms) {
  if (!ms) return '—';
  const menit = Math.round((Date.now() - ms) / 60000);
  return menit < 1 ? 'baru saja' : menit < 60 ? menit + ' menit lalu' : new Date(ms).toLocaleString('id-ID');
}

async function muat() {
  const s = await chrome.storage.local.get({ url: '', kunci: '', aktif: true, tampilkan: true, status: {}, diagnosa: null });
  $('url').value = s.url;
  $('kunci').value = s.kunci;
  $('aktif').checked = s.aktif;
  $('tampilkan').checked = s.tampilkan;
  tampilStatus(s.status, s.diagnosa);
}

const VERSI = chrome.runtime.getManifest().version;

function tampilStatus(st, diag) {
  $('terakhir').textContent = waktu(st.terakhir);
  $('versi').textContent = VERSI + ' / ' + (st.versiDasbor || '?');
  if (st.versiDasbor && st.versiDasbor.split('.')[0] !== VERSI.split('.')[0]) {
    $('versi').textContent += ' ⚠️';
    $('versi').title = 'Versi berbeda — perbarui aplikasi dasbor atau muat ulang ekstensi.';
  }
  $('keadaan').textContent = st.galat ? '⚠️ ' + st.galat : (st.pesan || '');
  const h = st.hasilTerakhir;
  $('kartuHasil').hidden = !h;
  if (h) {
    const label = { terbit: '✅ Terbit', draf: '📝 Draf di Facebook', uji: '🧪 Mode uji', gagal: '⚠️ Gagal' }[h.hasil] || h.hasil;
    $('hasil').textContent = label + ' · ' + h.judul + ' · ' + waktu(h.waktu) + (h.pesan ? '\n' + h.pesan : '');
  }
  $('tombolDiagnosa').hidden = !diag;
}

$('simpan').addEventListener('click', async () => {
  const url = $('url').value.trim();
  const kunci = $('kunci').value.trim();
  if (!/^https?:\/\/[^\s]+\/api\/ekstensi$/.test(url)) {
    return pesan('galat', 'URL harus berakhiran /api/ekstensi — salin dari halaman Pengaturan di dasbor.');
  }
  if (kunci.length < 20) return pesan('galat', 'Tempel kunci rahasia dari halaman Pengaturan di dasbor.');
  try {
    // Izin situs diminta saat diklik (harus dari aksi pengguna).
    const asal = new URL(url).origin + '/*';
    if (!(await chrome.permissions.contains({ origins: [asal] })) && !(await chrome.permissions.request({ origins: [asal] }))) {
      return pesan('galat', 'Izin untuk ' + asal + ' ditolak, jadi ekstensi tidak bisa menghubungi dasbor.');
    }
  } catch (e) {
    return pesan('galat', 'URL tidak valid: ' + e.message);
  }
  await chrome.storage.local.set({ url, kunci, aktif: $('aktif').checked, tampilkan: $('tampilkan').checked });
  $('simpan').disabled = true;
  pesan('info', 'Menghubungi dasbor…');
  try {
    const r = await kirim({ jenis: 'tes' });
    const st = (await chrome.storage.local.get({ status: {} })).status;
    st.versiDasbor = r.versi || '?';
    await chrome.storage.local.set({ status: st });
    pesan('ok', 'Terhubung ke "' + r.nama + '".\n' + ({
      uji: '🧪 Mode uji AKTIF — formulir diisi tetapi tidak diterbitkan.',
      draf: '📝 Iklan disimpan sebagai DRAF di Facebook — Anda yang menerbitkannya sendiri.',
      terbit: '🚀 Iklan akan langsung diterbitkan.'
    }[r.akhir || (r.uji ? 'uji' : 'terbit')]) +
      '\nJeda ' + r.jeda + ' menit · maks ' + r.batas + '/hari · hari ini ' + r.hariIni + '.' +
      '\nVersi dasbor ' + (r.versi || '?') + ' · ekstensi ' + VERSI + '.');
  } catch (e) {
    pesan('galat', e.message);
  } finally {
    $('simpan').disabled = false;
  }
});

['aktif', 'tampilkan'].forEach((id) => $(id).addEventListener('change', () => chrome.storage.local.set({ [id]: $(id).checked })));

$('cek').addEventListener('click', async () => {
  $('cek').disabled = true;
  try {
    const r = await kirim({ jenis: 'cekSekarang' });
    pesan(r && r.galat ? 'galat' : 'info', (r && (r.galat || r.pesan)) || 'Selesai.');
  } catch (e) {
    pesan('galat', e.message);
  } finally {
    $('cek').disabled = false;
    muat();
  }
});

$('rekam').addEventListener('click', async () => {
  $('rekam').disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/facebook\.com\/marketplace\/create/.test(tab.url || '')) {
      throw new Error('Buka dulu halaman buat iklan Marketplace (facebook.com/marketplace/create/…) di tab yang aktif.');
    }
    pesan('info', 'Merekam formulir… (dropdown dibuka-tutup sebentar, jangan klik apa pun)');
    const d = await chrome.tabs.sendMessage(tab.id, { jenis: 'rekam' });
    if (!d || d.galat) throw new Error((d && d.galat) || 'Skrip ekstensi belum aktif di tab ini. Muat ulang halaman Facebook lalu coba lagi.');
    await kirim({ jenis: 'rekam', diagnosa: d });
    await chrome.storage.local.set({ diagnosa: d });
    pesan('ok', 'Tersimpan ke riwayat dasbor: ' + d.isian.length + ' kolom, ' + Object.keys(d.pilihan || {}).length + ' dropdown. Terima kasih!');
  } catch (e) {
    pesan('galat', e.message);
  } finally {
    $('rekam').disabled = false;
    muat();
  }
});

$('salinDiagnosa').addEventListener('click', async () => {
  const { diagnosa } = await chrome.storage.local.get('diagnosa');
  await navigator.clipboard.writeText(JSON.stringify(diagnosa, null, 2));
  pesan('ok', 'Diagnosa disalin. Kirimkan ke pengembang bila formulir Facebook berubah.');
});

chrome.storage.onChanged.addListener((u) => { if (u.status || u.diagnosa) muat(); });
muat();
