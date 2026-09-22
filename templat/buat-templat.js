/**
 * Membuat templat Google Sheet dari daftar resmi di lib/iklan.js — supaya isi
 * templat tidak pernah beda dengan yang diterima aplikasi (dan formulir Facebook).
 *
 * Hasilnya tiga berkas di public/:
 *   templat-stok-kendaraan.xlsx   satu berkas, tiga tab: Stok + Pilihan Nilai + Petunjuk
 *   templat-stok-kendaraan.csv    tab Stok saja (CSV memang hanya bisa satu tab)
 *   templat-pilihan-nilai.csv     tab Petunjuk saja
 *
 *   node templat/buat-templat.js            menulis ulang ketiganya
 *   node templat/buat-templat.js --periksa  hanya memeriksa, keluar 1 bila beda
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { JENIS_KENDARAAN, TIPE_BODI, WARNA, KONDISI, BAHAN_BAKAR, TRANSMISI } from '../lib/iklan.js';
import { uraiCsv } from '../lib/sheet.js';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BERKAS_PILIHAN = path.join(AKAR, 'public', 'templat-pilihan-nilai.csv');
export const BERKAS_STOK = path.join(AKAR, 'public', 'templat-stok-kendaraan.csv');
export const BERKAS_XLSX = path.join(AKAR, 'public', 'templat-stok-kendaraan.xlsx');
export const NAMA_TAB = { stok: 'Stok', pilihan: 'Pilihan Nilai', petunjuk: 'Petunjuk' };

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

export function barisPilihan() {
  const baris = [['Kolom', 'Keterangan', 'Pilihan yang diterima']];
  PILIHAN.forEach(([kolom, daftar, ket]) => baris.push([kolom, ket, daftar.join(' | ')]));
  baris.push(['Tahun', 'wajib', '4 angka, mis. 2019']);
  baris.push(['Jarak Tempuh (km)', 'wajib', 'angka saja, mis. 15770 (titik/koma boleh, akan dibersihkan)']);
  baris.push(['Harga', 'wajib', 'angka saja, mis. 156400000 (boleh "Rp 156.400.000")']);
  baris.push(['Folder Foto (di PC)', 'isi salah satu: folder ATAU URL Foto', 'mis. D:\\Foto Mobil\\B1590DYA']);
  baris.push(['URL Foto', 'isi salah satu: folder ATAU URL Foto', 'alamat gambar publik, pisahkan dengan koma']);
  return baris;
}

export function isiPilihan() {
  return barisPilihan().map((b) => b.map(sel).join(',')).join('\r\n') + '\r\n';
}

/**
 * Pilihan dalam bentuk tabel: satu kolom per isian, satu nilai per sel —
 * bentuk yang bisa langsung dipakai Google Sheet untuk "Validasi data → Dari rentang".
 */
export function barisMatriks() {
  const kepala = PILIHAN.map(([kolom]) => kolom);
  const tinggi = Math.max(...PILIHAN.map(([, daftar]) => daftar.length));
  const baris = [kepala];
  for (let i = 0; i < tinggi; i++) baris.push(PILIHAN.map(([, daftar]) => daftar[i] || ''));
  return baris;
}

const lebar = (baris) => baris[0].map((_, i) => ({
  wch: Math.min(60, Math.max(12, ...baris.map((b) => String(b[i] == null ? '' : b[i]).split('\n')[0].length + 2)))
}));

/** Satu berkas, tiga tab: Stok (diisi pengguna), Pilihan Nilai (acuan), Petunjuk. */
export function buatXlsx() {
  const wb = XLSX.utils.book_new();
  const tambah = (baris, nama) => {
    const lembar = XLSX.utils.aoa_to_sheet(baris);
    lembar['!cols'] = lebar(baris);
    XLSX.utils.book_append_sheet(wb, lembar, nama);
  };
  // Tab Stok harus paling depan: lembar pertama itulah yang dibaca saat diunggah.
  tambah(uraiCsv(fs.readFileSync(BERKAS_STOK, 'utf8')), NAMA_TAB.stok);
  tambah(barisMatriks(), NAMA_TAB.pilihan);
  tambah(barisPilihan(), NAMA_TAB.petunjuk);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const isi = isiPilihan();
  const lama = fs.existsSync(BERKAS_PILIHAN) ? fs.readFileSync(BERKAS_PILIHAN, 'utf8') : '';
  if (process.argv.includes('--periksa')) {
    if (lama !== isi) { console.error('templat-pilihan-nilai.csv sudah tidak sesuai lib/iklan.js — jalankan: node templat/buat-templat.js'); process.exit(1); }
    console.log('Templat pilihan nilai sesuai.');
  } else {
    fs.writeFileSync(BERKAS_PILIHAN, isi);
    fs.writeFileSync(BERKAS_XLSX, buatXlsx());
    console.log('Ditulis: ' + BERKAS_PILIHAN + '\nDitulis: ' + BERKAS_XLSX);
  }
}
