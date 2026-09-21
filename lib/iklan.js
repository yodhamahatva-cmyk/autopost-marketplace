/** Aturan iklan Marketplace: bentuk data, kelengkapan, dan status. */
import { angka, potong } from './util.js';

export const STATUS = {
  DRAF: 'draf', TERJADWAL: 'terjadwal', DIPROSES: 'diproses',
  TERBIT: 'terbit', DRAF_FB: 'draf-fb', SIAP: 'siap', GAGAL: 'gagal', TERLEWAT: 'terlewat'
};

export const LABEL_STATUS = {
  draf: 'Draf', terjadwal: 'Terjadwal', diproses: 'Diproses',
  terbit: 'Terbit', 'draf-fb': 'Draf di Facebook', siap: 'Siap dipasang', gagal: 'Gagal', terlewat: 'Terlewat'
};

/** Cara ekstensi menutup formulir: terbitkan, simpan sebagai draf Facebook, atau berhenti (mode uji). */
export const AKHIR = ['terbit', 'draf', 'uji'];
export const LABEL_AKHIR = {
  terbit: 'Terbitkan langsung',
  draf: 'Simpan sebagai draf di Facebook',
  uji: 'Mode uji — isi formulir saja'
};

/** Setelan lama hanya punya modeUji; nilai itu tetap dipakai bila "akhir" belum pernah disimpan. */
export function caraAkhir(setelan = {}) {
  const a = String(setelan.akhir || '').toLowerCase();
  if (AKHIR.includes(a)) return a;
  return setelan.modeUji ? 'uji' : 'terbit';
}

export const KONDISI = ['Baru', 'Bekas - Seperti Baru', 'Bekas - Baik', 'Bekas - Cukup Baik'];
export const JENIS_KENDARAAN = ['Mobil/Truk', 'Sepeda Motor'];
export const TRANSMISI = ['Otomatis', 'Manual'];
export const BAHAN_BAKAR = ['Bensin', 'Diesel', 'Listrik', 'Hibrida'];
export const TIPE_BODI = ['Hatchback', 'Sedan', 'SUV', 'MPV', 'Minivan', 'Coupe', 'Convertible', 'Wagon', 'Pikap', 'Truk', 'Van', 'Lainnya'];
export const WARNA = ['Hitam', 'Putih', 'Perak', 'Abu-abu', 'Merah', 'Biru', 'Kuning', 'Hijau', 'Cokelat', 'Oranye', 'Krem', 'Emas', 'Lainnya'];
export const MAKS_FOTO = { barang: 10, kendaraan: 20 };

/** Lengkapi nilai bawaan + rapikan tipe data satu iklan. */
export function rapikanIklan(x = {}) {
  const k = x.kendaraan || {};
  const jenis = x.jenis === 'kendaraan' || /^(kendaraan|mobil|motor)/i.test(x.kategori || '') || k.merek ? 'kendaraan' : 'barang';
  const kendaraan = jenis === 'kendaraan' ? {
    jenis: k.jenis || (/motor/i.test(x.kategori || '') ? 'Sepeda Motor' : 'Mobil/Truk'),
    tahun: String(k.tahun || '').replace(/\D/g, ''),
    merek: (k.merek || '').trim(),
    model: (k.model || '').trim(),
    jarakTempuh: angka(k.jarakTempuh),
    transmisi: (k.transmisi || '').trim(),
    bahanBakar: (k.bahanBakar || '').trim(),
    warna: (k.warna || '').trim(),
    tipeBodi: (k.tipeBodi || '').trim()
  } : null;
  const judul = (x.judul || '').trim() ||
    (kendaraan ? [kendaraan.tahun, kendaraan.merek, kendaraan.model].filter(Boolean).join(' ') : '');
  return {
    id: x.id, kunci: (x.kunci || '').trim(), jenis, judul,
    harga: angka(x.harga),
    kategori: (x.kategori || (jenis === 'kendaraan' ? 'Kendaraan' : '')).trim(),
    kondisi: (x.kondisi || '').trim(),
    lokasi: (x.lokasi || '').trim(),
    deskripsi: (x.deskripsi || '').trim(),
    foto: rapikanFoto(x.foto),
    kendaraan,
    cara: x.cara === 'manual' ? 'manual' : 'otomatis',
    jadwal: x.jadwal || null,
    status: x.status || STATUS.DRAF,
    keterangan: x.keterangan || '',
    langkah: x.langkah || '',
    token: x.token || null,
    klaim: x.klaim || null,
    hasilUrl: x.hasilUrl || '',
    sumber: x.sumber || null,
    dibuat: x.dibuat || new Date().toISOString(),
    diubah: new Date().toISOString()
  };
}

/**
 * Sumber foto: unggahan (tersimpan di aplikasi), folder (dibaca ekstensi dari PC), atau url publik.
 * { tipe:'unggahan', berkas:[{id,nama,mime,ukuran}] } | { tipe:'folder', folder:'D:\Foto\B123' } | { tipe:'url', url:[...] }
 */
export function rapikanFoto(f) {
  if (!f || !f.tipe) return { tipe: 'unggahan', berkas: [] };
  if (f.tipe === 'folder') return { tipe: 'folder', folder: String(f.folder || '').trim() };
  if (f.tipe === 'url') {
    const url = (Array.isArray(f.url) ? f.url : String(f.url || '').split(/[\s,;]+/))
      .map((u) => String(u).trim()).filter((u) => /^https?:\/\//i.test(u));
    return { tipe: 'url', url };
  }
  return { tipe: 'unggahan', berkas: Array.isArray(f.berkas) ? f.berkas : [] };
}

export function jumlahFoto(iklan) {
  const f = iklan.foto || {};
  if (f.tipe === 'unggahan') return (f.berkas || []).length;
  if (f.tipe === 'url') return (f.url || []).length;
  return null; // folder: jumlahnya baru diketahui ekstensi saat membaca folder di PC
}

/** { galat:[], saran:[] } — dipakai sebelum menjadwalkan & sebelum diserahkan ke ekstensi. */
export function periksaIklan(iklan) {
  const galat = [];
  const saran = [];
  const f = iklan.foto || {};
  const n = jumlahFoto(iklan);

  if (iklan.harga === null) galat.push('Harga wajib diisi (angka).');
  if (f.tipe === 'folder') {
    if (!f.folder) galat.push('Folder foto belum diisi, mis. D:\\Foto Mobil\\B1590DYA.');
  } else if (!n) {
    galat.push('Minimal 1 foto.');
  } else if (n > MAKS_FOTO[iklan.jenis]) {
    galat.push('Maksimal ' + MAKS_FOTO[iklan.jenis] + ' foto untuk iklan ' + iklan.jenis + ' (ada ' + n + ').');
  }

  if (iklan.jenis === 'kendaraan') {
    const k = iklan.kendaraan || {};
    const kurang = [];
    if (!/^(19|20)\d{2}$/.test(k.tahun || '')) kurang.push('Tahun (4 angka)');
    if (!k.merek) kurang.push('Merek');
    if (!k.model) kurang.push('Model');
    if (k.jarakTempuh === null) kurang.push('Jarak tempuh');
    if (!k.tipeBodi) kurang.push('Tipe bodi');
    if (!k.warna) kurang.push('Warna');
    if (!iklan.deskripsi) kurang.push('Deskripsi');
    if (kurang.length) galat.push('Formulir kendaraan Facebook mewajibkan: ' + kurang.join(', ') + '.');
    if (!k.transmisi) saran.push('Transmisi kosong.');
    if (!k.bahanBakar) saran.push('Bahan bakar kosong.');
  } else {
    if (!iklan.judul) galat.push('Judul wajib diisi.');
    if (!iklan.kategori) saran.push('Kategori kosong — Facebook mewajibkannya saat memasang.');
    if (!iklan.kondisi) saran.push('Kondisi kosong.');
    if (!iklan.deskripsi) saran.push('Deskripsi kosong.');
  }
  return { galat, saran, siap: galat.length === 0 };
}

/** Ringkasan satu baris untuk daftar & pratinjau. */
export function ringkas(iklan) {
  const k = iklan.kendaraan;
  return k
    ? [k.jenis, k.tahun, k.merek, k.model, k.jarakTempuh !== null ? k.jarakTempuh + ' km' : '', k.transmisi, k.bahanBakar, k.warna, k.tipeBodi]
      .filter(Boolean).join(' · ')
    : [iklan.kategori, iklan.kondisi, iklan.lokasi, potong(iklan.deskripsi, 60)].filter(Boolean).join(' · ');
}
