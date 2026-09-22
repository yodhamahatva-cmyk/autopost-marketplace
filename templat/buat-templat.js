/**
 * Membuat berkas pilihan nilai untuk templat Google Sheet, langsung dari daftar
 * resmi di lib/iklan.js — supaya isi templat tidak pernah beda dengan yang
 * diterima aplikasi (dan formulir Facebook).
 *
 *   node templat/buat-templat.js            menulis public/templat-pilihan-nilai.csv
 *   node templat/buat-templat.js --periksa  hanya memeriksa, keluar 1 bila beda
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JENIS_KENDARAAN, TIPE_BODI, WARNA, KONDISI, BAHAN_BAKAR, TRANSMISI } from '../lib/iklan.js';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BERKAS_PILIHAN = path.join(AKAR, 'public', 'templat-pilihan-nilai.csv');
export const BERKAS_STOK = path.join(AKAR, 'public', 'templat-stok-kendaraan.csv');

/** Urutan kolom templat = urutan isian pada formulir kendaraan Facebook. */
export const KOLOM_TEMPLAT = [
  'No Polisi (Kunci Unik)', 'Jenis Kendaraan', 'Tahun', 'Merek', 'Model', 'Jarak Tempuh (km)', 'Harga',
  'Tipe Bodi', 'Warna Eksterior', 'Kondisi Kendaraan', 'Jenis Bahan Bakar', 'Transmisi',
  'Lokasi', 'Deskripsi', 'Folder Foto (di PC)', 'URL Foto'
];

const PILIHAN = [
  ['Jenis Kendaraan', JENIS_KENDARAAN, 'wajib'],
  ['Tipe Bodi', TIPE_BODI, 'wajib untuk Mobil/Truk'],
  ['Warna Eksterior', WARNA, 'wajib'],
  ['Kondisi Kendaraan', KONDISI, 'boleh kosong'],
  ['Jenis Bahan Bakar', BAHAN_BAKAR, 'boleh kosong'],
  ['Transmisi', TRANSMISI, 'boleh kosong']
];

const sel = (s) => (/[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));

export function isiPilihan() {
  const baris = [['Kolom', 'Keterangan', 'Pilihan yang diterima']];
  PILIHAN.forEach(([kolom, daftar, ket]) => baris.push([kolom, ket, daftar.join(' | ')]));
  baris.push(['Tahun', 'wajib', '4 angka, mis. 2019']);
  baris.push(['Jarak Tempuh (km)', 'wajib', 'angka saja, mis. 15770 (titik/koma boleh, akan dibersihkan)']);
  baris.push(['Harga', 'wajib', 'angka saja, mis. 156400000 (boleh "Rp 156.400.000")']);
  baris.push(['Folder Foto (di PC)', 'isi salah satu: folder ATAU URL Foto', 'mis. D:\\Foto Mobil\\B1590DYA']);
  baris.push(['URL Foto', 'isi salah satu: folder ATAU URL Foto', 'alamat gambar publik, pisahkan dengan koma']);
  return baris.map((b) => b.map(sel).join(',')).join('\r\n') + '\r\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const isi = isiPilihan();
  const lama = fs.existsSync(BERKAS_PILIHAN) ? fs.readFileSync(BERKAS_PILIHAN, 'utf8') : '';
  if (process.argv.includes('--periksa')) {
    if (lama !== isi) { console.error('templat-pilihan-nilai.csv sudah tidak sesuai lib/iklan.js — jalankan: node templat/buat-templat.js'); process.exit(1); }
    console.log('Templat pilihan nilai sesuai.');
  } else {
    fs.writeFileSync(BERKAS_PILIHAN, isi);
    console.log('Ditulis: ' + BERKAS_PILIHAN);
  }
}
