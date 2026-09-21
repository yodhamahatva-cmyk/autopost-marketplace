/**
 * Protokol ekstensi Chrome: ping / ambil / foto / progres / lapor / rekam.
 * Sama seperti versi Apps Script, tetapi datanya dari penyimpanan aplikasi ini
 * dan foto bisa berasal dari unggahan, URL, atau folder di komputer pemakai
 * (untuk folder, ekstensi yang membacanya sendiri — file tidak melewati server).
 */
import { db, setelanLengkap } from './data/index.js';
import { periksaIklan, jumlahFoto, STATUS, caraAkhir } from './iklan.js';
import { potong } from './util.js';
import { samaAman, tokenBaru } from './rahasia.js';
import { hariIni } from './waktu.js';

export const VERSI = '2.1.0';
const MACET_MENIT = 20;
const BATAS_TELAT_JAM = 6;

export async function prosesEkstensi(permintaan) {
  const req = permintaan || {};
  const setelan = await setelanLengkap();
  if (!setelan.kunciEkstensi) {
    return { ok: false, kode: 'kunci', galat: 'Kunci ekstensi belum dibuat. Buka Pengaturan di dasbor.' };
  }
  if (!samaAman(req.kunci, setelan.kunciEkstensi)) {
    return { ok: false, kode: 'kunci', galat: 'Kunci ekstensi salah.' };
  }
  const aksi = { ping, ambil, foto, progres, lapor, rekam }[req.aksi];
  if (!aksi) return { ok: false, galat: 'Aksi tidak dikenal: ' + req.aksi };

  await db().simpanSetelan({ ekstensiTerakhir: new Date().toISOString() });
  try {
    return { ok: true, versi: VERSI, ...(await aksi(req, setelan)) };
  } catch (e) {
    return { ok: false, versi: VERSI, galat: e.message };
  }
}

// ---------------------------------------------------------------- aksi

async function ping(req, setelan) {
  return {
    nama: process.env.NAMA_APLIKASI || 'AutoPost Iklan',
    uji: caraAkhir(setelan) === 'uji', draf: caraAkhir(setelan) === 'draf',
    akhir: caraAkhir(setelan), jeda: setelan.jedaMenit, batas: setelan.batasHarian,
    hariIni: hitunganHariIni(setelan)
  };
}

async function ambil(req, setelan) {
  await bersihkanMacet(setelan);
  const kini = Date.now();
  const antre = (await db().daftarIklan({ status: STATUS.TERJADWAL }))
    .filter((x) => x.cara === 'otomatis' && x.jadwal && new Date(x.jadwal).getTime() <= kini)
    .sort((a, b) => String(a.jadwal).localeCompare(String(b.jadwal)));
  if (!antre.length) return { tugas: null };

  if (caraAkhir(setelan) !== 'uji') {
    const sisa = setelan.postTerakhir
      ? setelan.jedaMenit * 60000 - (kini - new Date(setelan.postTerakhir).getTime()) : 0;
    if (sisa > 0) return { tugas: null, tunggu: 'Jeda antar-posting: ' + Math.ceil(sisa / 60000) + ' menit lagi (' + antre.length + ' antre).' };
    if (hitunganHariIni(setelan) >= setelan.batasHarian) {
      return { tugas: null, tunggu: 'Batas ' + setelan.batasHarian + ' posting per hari tercapai.' };
    }
  }

  for (const iklan of antre) {
    const telatJam = (kini - new Date(iklan.jadwal).getTime()) / 3600000;
    if (telatJam > BATAS_TELAT_JAM) {
      await ubah(iklan, { status: STATUS.TERLEWAT, keterangan: 'Lewat lebih dari ' + BATAS_TELAT_JAM + ' jam dari jadwal — ubah jadwalnya lalu set Terjadwal lagi.' }, 'terlewat');
      continue;
    }
    const cek = periksaIklan(iklan);
    if (!cek.siap) {
      await ubah(iklan, { status: STATUS.GAGAL, keterangan: 'Tidak diposting: ' + cek.galat.join(' ') }, 'gagal');
      continue;
    }
    const token = tokenBaru();
    await ubah(iklan, {
      status: STATUS.DIPROSES, token, klaim: new Date().toISOString(),
      langkah: 'diserahkan ke ekstensi',
      keterangan: 'Sedang diposting oleh ekstensi Chrome' + {
        uji: ' (MODE UJI — tidak diterbitkan)', draf: ' (disimpan sebagai draf, tidak diterbitkan)', terbit: ''
      }[caraAkhir(setelan)] + '…'
    }, 'diproses');
    return {
      tugas: {
        id: iklan.id, token, versi: VERSI,
        uji: caraAkhir(setelan) === 'uji', draf: caraAkhir(setelan) === 'draf',
        jenis: iklan.jenis, judul: iklan.judul, harga: iklan.harga, kategori: iklan.kategori,
        kondisi: iklan.kondisi, lokasi: iklan.lokasi, deskripsi: iklan.deskripsi,
        kendaraan: iklan.kendaraan,
        foto: iklan.foto.tipe === 'folder' ? { tipe: 'folder', folder: iklan.foto.folder } : { tipe: 'server' },
        jumlahFoto: jumlahFoto(iklan)
      }
    };
  }
  return { tugas: null };
}

/**
 * Link berbagi Google Drive bukan alamat gambar: yang terkirim halaman web, bukan foto.
 * Ambil ID berkasnya lalu coba alamat yang benar-benar mengeluarkan gambar.
 */
function idDrive(url) {
  const s = String(url || '');
  const m = s.match(/drive\.google\.com\/file\/d\/([\w-]{15,})/) ||
    s.match(/(?:drive|docs)\.google\.com\/[^#]*?[?&]id=([\w-]{15,})/) ||
    s.match(/drive\.usercontent\.google\.com\/[^#]*?[?&]id=([\w-]{15,})/);
  return m ? m[1] : null;
}

export function alamatGambar(url) {
  const id = idDrive(url);
  if (!id) return [url];
  return [
    'https://lh3.googleusercontent.com/d/' + id + '=w2048',
    'https://drive.usercontent.google.com/download?id=' + id + '&export=download',
    'https://drive.google.com/uc?export=download&id=' + id
  ];
}

const TANDA_GAMBAR = [
  [0xff, 0xd8], [0x89, 0x50, 0x4e, 0x47], [0x47, 0x49, 0x46], [0x42, 0x4d]
];
const memangGambar = (b) => b.length > 512 &&
  (TANDA_GAMBAR.some((t) => t.every((x, i) => b[i] === x)) || b.slice(8, 12).toString('latin1') === 'WEBP' ||
    /ftyp|heic/.test(b.slice(4, 12).toString('latin1')));

export async function unduhGambar(url) {
  const alamat = alamatGambar(url);
  const sebab = [];
  for (const a of alamat) {
    let res;
    try {
      res = await fetch(a, { redirect: 'follow' });
    } catch (e) {
      sebab.push('tidak bisa dihubungi (' + e.message + ')');
      continue;
    }
    if (!res.ok) { sebab.push('HTTP ' + res.status); continue; }
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
    const data = Buffer.from(await res.arrayBuffer());
    if (memangGambar(data)) return { data, mime: /^image\//.test(mime) ? mime : 'image/jpeg' };
    sebab.push(/html/i.test(mime) ? 'yang terkirim halaman web, bukan gambar' : 'isinya bukan gambar (' + (mime || 'tanpa jenis') + ')');
  }
  throw new Error('Foto ' + url + ' tidak bisa diunduh: ' + sebab.join('; ') + '.' +
    (idDrive(url) ? ' Link Google Drive hanya bisa dipakai bila berkasnya dibagikan "Siapa saja yang memiliki link (Pelihat)".' : ''));
}

async function foto(req) {
  const iklan = await tugasAktif(req);
  const f = iklan.foto || {};
  const i = Number(req.i);
  if (f.tipe === 'folder') throw new Error('Foto iklan ini dibaca langsung dari folder komputer, bukan dari server.');
  if (f.tipe === 'url') {
    const url = (f.url || [])[i];
    if (!url) throw new Error('Foto ke-' + (i + 1) + ' tidak ada.');
    const { data, mime } = await unduhGambar(url);
    return {
      nama: url.split('/').pop().split('?')[0] || 'foto.jpg',
      mime, sumber: url, data: data.toString('base64')
    };
  }
  const berkas = (f.berkas || [])[i];
  if (!berkas) throw new Error('Foto ke-' + (i + 1) + ' tidak ada.');
  const isi = await db().bacaFoto(iklan.id, berkas.id);
  return { nama: berkas.nama || isi.nama, mime: berkas.mime || 'image/jpeg', data: Buffer.from(isi.data).toString('base64') };
}

async function progres(req) {
  const iklan = await tugasAktif(req);
  await db().simpanIklan({ ...iklan, langkah: potong(req.langkah, 120), diubah: new Date().toISOString() });
  return {};
}

async function lapor(req, setelan) {
  const iklan = await tugasAktif(req);
  const pesan = potong(req.pesan, 600);
  if (req.diagnosa) {
    await db().tambahLog({ iklanId: iklan.id, jenis: 'diagnosa', pesan: potong(req.diagnosa.galat || 'diagnosa formulir', 200), data: req.diagnosa });
  }

  if (req.hasil === 'terbit') {
    await ubah(iklan, {
      status: STATUS.TERBIT, token: null, klaim: null, langkah: '', hasilUrl: req.url || '',
      keterangan: 'Diposting otomatis oleh ekstensi Chrome.'
    }, 'terbit');
    const hari = hariIni(setelan.zona);
    await db().simpanSetelan({
      postTerakhir: new Date().toISOString(),
      hitungHarian: hari + ':' + (hitunganHariIni(setelan) + 1)
    });
    return { status: STATUS.TERBIT };
  }
  if (req.hasil === 'draf') {
    await ubah(iklan, {
      status: STATUS.DRAF_FB, token: null, klaim: null, langkah: '',
      hasilUrl: req.url || 'https://www.facebook.com/marketplace/you/selling',
      keterangan: 'Tersimpan sebagai draf di Facebook Marketplace — belum tayang. ' +
        'Buka Marketplace → Anda → Draf untuk memeriksa lalu menerbitkannya.' + (pesan ? ' ' + pesan : '')
    }, 'draf-fb');
    // Menyimpan draf tetap membuka formulir baru di Facebook, jadi jeda & batas harian tetap dihitung.
    const hariDraf = hariIni(setelan.zona);
    await db().simpanSetelan({
      postTerakhir: new Date().toISOString(),
      hitungHarian: hariDraf + ':' + (hitunganHariIni(setelan) + 1)
    });
    return { status: STATUS.DRAF_FB };
  }
  if (req.hasil === 'uji') {
    await ubah(iklan, {
      status: STATUS.DRAF, token: null, klaim: null, langkah: '',
      keterangan: 'MODE UJI: formulir terisi di Chrome tetapi TIDAK diterbitkan. Periksa jendela Facebook, lalu matikan Mode uji di Pengaturan dan jadwalkan lagi.' + (pesan ? ' ' + pesan : '')
    }, 'uji');
    return { status: STATUS.DRAF };
  }
  const akhir = req.pasti === false
    ? 'Ekstensi gagal SETELAH tombol Terbitkan diklik: ' + pesan + ' — cek Marketplace Anda sebelum menjadwalkan ulang agar tidak dobel.'
    : 'Ekstensi gagal memposting: ' + pesan;
  await ubah(iklan, { status: STATUS.GAGAL, token: null, klaim: null, langkah: '', keterangan: akhir }, 'gagal');
  return { status: STATUS.GAGAL };
}

async function rekam(req) {
  await db().tambahLog({ jenis: 'rekaman', pesan: 'Rekaman formulir: ' + potong(req.diagnosa?.url || '', 120), data: req.diagnosa || {} });
  return {};
}

// ---------------------------------------------------------------- pembantu

async function tugasAktif(req) {
  const iklan = await db().ambilIklan(String(req.id || ''));
  if (!iklan) throw new Error('Iklan tidak ditemukan.');
  if (iklan.status !== STATUS.DIPROSES || !iklan.token || !samaAman(iklan.token, req.token)) {
    throw new Error('Iklan ini tidak sedang diproses ekstensi (status: ' + iklan.status + ').');
  }
  return iklan;
}

async function ubah(iklan, patch, jenisLog) {
  const baru = { ...iklan, ...patch, diubah: new Date().toISOString() };
  await db().simpanIklan(baru);
  if (jenisLog) await db().tambahLog({ iklanId: iklan.id, jenis: jenisLog, pesan: potong(patch.keterangan || jenisLog, 300) });
  return baru;
}

/** Tugas yang diklaim tetapi tidak pernah dilaporkan (Chrome ditutup di tengah proses). */
async function bersihkanMacet() {
  const diproses = await db().daftarIklan({ status: STATUS.DIPROSES });
  for (const x of diproses) {
    if (!x.klaim || Date.now() - new Date(x.klaim).getTime() < MACET_MENIT * 60000) continue;
    await ubah(x, {
      status: STATUS.GAGAL, token: null, klaim: null,
      keterangan: 'Ekstensi tidak melaporkan hasil dalam ' + MACET_MENIT + ' menit (Chrome ditutup?). Cek Marketplace: bila belum terbit, jadwalkan lagi.'
    }, 'gagal');
  }
}

export function hitunganHariIni(setelan) {
  const m = String(setelan.hitungHarian || '').match(/^(\d{4}-\d{2}-\d{2}):(\d+)$/);
  return m && m[1] === hariIni(setelan.zona) ? Number(m[2]) : 0;
}
