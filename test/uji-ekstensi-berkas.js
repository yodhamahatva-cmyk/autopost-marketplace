/**
 * Pemeriksaan statis berkas ekstensi: izin, pola pencocokan, dan jalur penting
 * yang mudah hilang saat menyunting (penyuntikan skrip, pembaca folder, pesan).
 *   node test/uji-ekstensi-berkas.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ekstensi-chrome');
const baca = (n) => fs.readFileSync(path.join(AKAR, n), 'utf8');
const manifest = JSON.parse(baca('manifest.json'));
const latar = baca('latar.js');
const pengisi = baca('isi-formulir.js');
const folder = baca('baca-folder.js');
const popup = baca('popup.js');

let lulus = 0;
let gagal = 0;
const bagian = (n) => console.log('\n■ ' + n);
function cek(k, label, info) {
  if (k) { lulus++; console.log('  ✔ ' + label); }
  else { gagal++; console.log('  ✘ ' + label + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
}

bagian('Manifes');
cek(manifest.manifest_version === 3 && /^\d+\.\d+\.\d+$/.test(manifest.version), 'Manifest V3 dengan nomor versi', manifest.version);
cek(['alarms', 'storage', 'tabs', 'scripting', 'notifications'].every((p) => manifest.permissions.includes(p)),
  'izin lengkap (termasuk scripting untuk menyuntik skrip pengisi)', manifest.permissions);
cek(manifest.host_permissions.some((h) => /facebook\.com/.test(h)), 'izin situs Facebook (syarat executeScript)', manifest.host_permissions);
cek(manifest.optional_host_permissions?.includes('https://*/*'), 'izin situs dasbor diminta saat dipakai (opsional)');
const cs = manifest.content_scripts;
cek(cs.some((c) => c.js.includes('isi-formulir.js') && c.matches.every((m) => m.includes('/marketplace/create/'))),
  'skrip pengisi hanya didaftarkan untuk halaman buat iklan (tidak semua halaman Facebook)', cs[0]?.matches);
cek(cs.some((c) => c.js.includes('baca-folder.js') && c.matches.includes('file:///*')), 'pembaca folder foto terdaftar untuk file:///*');
cek(manifest.icons && manifest.action?.default_popup === 'popup.html', 'ikon & popup terdaftar');

bagian('Pekerja latar');
cek(/chrome\.scripting\.executeScript/.test(latar), 'menyuntik skrip pengisi secara aktif (tidak hanya mengandalkan pola manifes)');
cek(/suntikPengisi\(tabId\)/.test(latar) && /suntikPengisi\(tugas\.tabId\)/.test(latar), 'penyuntikan dipakai saat membuka DAN saat memuat ulang formulir');
cek(/Halaman yang terbuka: /.test(latar), 'pesan gagal menyebutkan halaman yang sebenarnya terbuka');
cek(/marketplace\/create\/vehicle/.test(latar) && /marketplace\/create\/item/.test(latar), 'alamat formulir kendaraan & barang');
cek(/Izinkan akses ke URL file/.test(latar), 'petunjuk izin file:// bila folder foto tidak terbaca');
cek(/\/api\/ekstensi/.test(popup) && /permissions\.request/.test(popup), 'popup memvalidasi URL dasbor & meminta izin situs');
for (const aksi of ['ambil', 'foto', 'progres', 'lapor', 'rekam', 'ping']) {
  cek(new RegExp("'" + aksi + "'").test(latar) || new RegExp('"' + aksi + '"').test(latar), 'aksi ' + aksi + ' dipakai');
}

bagian('Skrip halaman');
cek(/jenis === 'kendaraan'/.test(pengisi) && /isiKendaraan/.test(pengisi), 'pengisi membedakan formulir kendaraan & barang');
cek(/'hidup'/.test(pengisi), 'menjawab pemeriksa hidup-mati dari pekerja latar');
cek(/Tipe body/.test(pengisi) && /Keterangan/.test(pengisi) && /Warna eksterior/.test(pengisi),
  'penanda mengikuti label asli Facebook (Tipe body, Keterangan, Warna eksterior)');
cek(/btoa\(/.test(folder) && /GAMBAR/.test(folder), 'pembaca folder mengubah gambar menjadi base64');

console.log('\n' + (gagal ? '❌' : '✅') + ' ' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
