/**
 * Uji inti aplikasi tanpa server & tanpa akun mana pun.
 *   node test/uji.js
 * Data uji ditulis ke folder sementara, lalu dihapus.
 */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const AKAR_UJI = fs.mkdtempSync(path.join(os.tmpdir(), 'autopost-uji-'));
process.env.DATA_DIR = AKAR_UJI;
process.env.SUMBER_DATA = 'berkas';

const { uraiCsv, urlCsv, ringkasTabel, ambilDariUrl, uraiBerkas } = await import('../lib/sheet.js');
const { tebakPemetaan, susunImpor, nilaiSumber, rapikanNilai } = await import('../lib/impor.js');
const { rapikanIklan, periksaIklan, jumlahFoto, STATUS } = await import('../lib/iklan.js');
const { db, setelanLengkap } = await import('../lib/data/index.js');
const { prosesEkstensi, hitunganHariIni } = await import('../lib/ekstensi.js');
const { dariInput, formatWaktu, untukInput } = await import('../lib/waktu.js');

let lulus = 0;
let gagal = 0;
const bagian = (n) => console.log('\n■ ' + n);
function cek(kondisi, label, info) {
  if (kondisi) { lulus++; console.log('  ✔ ' + label); }
  else { gagal++; console.log('  ✘ ' + label + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
}

// ================================================================ Sheet
bagian('Membaca Google Sheet & berkas');
const csv = 'No Polisi,Merk,Model,Varian,Tahun,Transmisi,KM,Harga,Warna,Deskripsi\n' +
  'B1590DYA,Daihatsu,Ayla,1.0 X Bensin-AT,2025,OTOMATIS,15770,"Rp 156.400.000",KUNING,"Mobil siap pakai,\ndokumen lengkap"\n' +
  'B2233XYZ,Toyota,Avanza,1.3 G MT,2021,MANUAL,48000,175000000,Hitam,"Service record ""lengkap"""\n';
const tabel = uraiCsv(csv);
cek(tabel.length === 3 && tabel[1][9] === 'Mobil siap pakai,\ndokumen lengkap', 'CSV: koma & baris baru di dalam tanda kutip', tabel[1][9]);
cek(tabel[2][9] === 'Service record "lengkap"', 'CSV: tanda kutip ganda di dalam sel', tabel[2][9]);
cek(uraiCsv('a;b;c\n1;2;3')[1][2] === '3', 'CSV: pemisah titik koma terdeteksi');

cek(urlCsv('https://docs.google.com/spreadsheets/d/1wMwwaY-Nqii/edit?gid=2079566429#gid=2079566429')
  === 'https://docs.google.com/spreadsheets/d/1wMwwaY-Nqii/export?format=csv&gid=2079566429', 'link sheet biasa → URL ekspor CSV');
cek(/\/pub\?gid=0&single=true&output=csv$/.test(urlCsv('https://docs.google.com/spreadsheets/d/e/2PACX-1vABC/pubhtml')), 'link "publikasikan ke web" → CSV');
cek(urlCsv('https://docs.google.com/spreadsheets/d/e/2PACX/pub?gid=5&single=true&output=csv').includes('output=csv'), 'link CSV dibiarkan apa adanya');
let eUrl = '';
try { urlCsv('https://contoh.com/data'); } catch (e) { eUrl = e.message; }
cek(/Bukan link Google Sheet/.test(eUrl), 'link bukan Sheet ditolak dengan petunjuk');

const palsuHtml = async () => ({ ok: true, status: 200, text: async () => '<html><body>Masuk ke Google' });
let eLogin = '';
try { await ambilDariUrl('https://docs.google.com/spreadsheets/d/1abc/edit', palsuHtml); } catch (e) { eLogin = e.message; }
cek(/Publikasikan ke web/.test(eLogin), 'halaman login Google → pesan cara membagikan sheet', eLogin);
const palsuCsv = async () => ({ ok: true, status: 200, text: async () => csv });
cek((await ambilDariUrl('https://docs.google.com/spreadsheets/d/1abc/edit', palsuCsv)).length === 3, 'ambil CSV dari URL');

const ringkas = ringkasTabel(tabel);
cek(ringkas.barisHeader === 1 && ringkas.barisAwal === 2 && ringkas.kolom[6].judul === 'KM' && ringkas.kolom[6].contoh === '15770',
  'baris header terdeteksi + contoh isi tiap kolom', [ringkas.barisHeader, ringkas.kolom[6]]);

// ================================================================ Impor
bagian('Impor & pemetaan kolom');
const peta = tebakPemetaan(ringkas.kolom);
cek(peta.merek.kolom === 'B' && peta.tahun.kolom === 'E' && peta.jarakTempuh.kolom === 'G' && peta.harga.kolom === 'H' &&
  peta.warna.kolom === 'I' && peta.kunci.kolom === 'A' && peta.deskripsi.kolom === 'J',
  'pemetaan ditebak dari header (Merk→Merek, KM→Jarak Tempuh, No Polisi→Kunci Unik)', peta);
cek(nilaiSumber({ teks: '{C} {D}' }, tabel[1]) === 'Ayla 1.0 X Bensin-AT', 'templat gabungan {C} {D}');
cek(nilaiSumber({ teks: 'Kendaraan' }, tabel[1]) === 'Kendaraan', 'nilai tetap');
cek(rapikanNilai('harga', 'Rp 156.400.000') === 156400000 && rapikanNilai('transmisi', 'OTOMATIS') === 'Otomatis' &&
  rapikanNilai('warna', 'KUNING') === 'Kuning' && rapikanNilai('bahanBakar', 'solar') === 'Diesel',
  'nilai dirapikan sesuai pilihan Facebook');

const petaPakai = {
  ...peta,
  model: { kolom: '', teks: '{C} {D}' },
  kategori: { kolom: '', teks: 'Kendaraan' },
  tipeBodi: { kolom: '', teks: 'Hatchback' },
  bahanBakar: { kolom: '', teks: 'Bensin' },
  fotoFolder: { kolom: '', teks: 'D:\\Foto Mobil\\{A}' }
};
const mulai = dariInput('2026-09-20T09:00');
const hasilImpor = susunImpor(tabel, { peta: petaPakai, barisAwal: 2, mulai, jedaMenit: 60, cara: 'otomatis', status: 'terjadwal', namaSumber: 'Stok Mobil' });
cek(hasilImpor.hasil.length === 2 && !hasilImpor.dilewati.length, 'dua baris jadi dua iklan');
const iklan1 = hasilImpor.hasil[0].iklan;
cek(iklan1.jenis === 'kendaraan' && iklan1.judul === '2025 Daihatsu Ayla 1.0 X Bensin-AT' && iklan1.harga === 156400000 &&
  iklan1.kendaraan.jarakTempuh === 15770 && iklan1.kendaraan.warna === 'Kuning' && iklan1.kendaraan.transmisi === 'Otomatis',
  'iklan kendaraan tersusun lengkap (judul dari Tahun+Merek+Model)', { judul: iklan1.judul, km: iklan1.kendaraan.jarakTempuh });
cek(iklan1.foto.tipe === 'folder' && iklan1.foto.folder === 'D:\\Foto Mobil\\B1590DYA', 'folder foto dari templat {A}', iklan1.foto);
cek(formatWaktu(iklan1.jadwal) === '20/09/2026 09:00' && formatWaktu(hasilImpor.hasil[1].iklan.jadwal) === '20/09/2026 10:00',
  'jadwal berurutan sesuai jeda 60 menit', [formatWaktu(iklan1.jadwal), formatWaktu(hasilImpor.hasil[1].iklan.jadwal)]);
cek(!hasilImpor.hasil[0].masalah.length && !hasilImpor.hasil[1].masalah.length, 'kedua iklan lolos pemeriksaan', hasilImpor.hasil.map((h) => h.masalah));
const lagi = susunImpor(tabel, { peta: petaPakai, barisAwal: 2, mulai, jedaMenit: 60, kunciSudahAda: ['B1590DYA'] });
cek(lagi.hasil.length === 1 && lagi.dilewati[0].kunci === 'B1590DYA', 'baris yang sudah pernah diimpor dilewati');
const tanpaBodi = susunImpor(tabel, { peta: { ...petaPakai, tipeBodi: { kolom: '', teks: '' } }, barisAwal: 2, mulai });
cek(/Tipe bodi/.test(tanpaBodi.hasil[0].masalah[0] || ''), 'kolom wajib kendaraan yang kosong ditandai', tanpaBodi.hasil[0].masalah);
cek(untukInput(mulai) === '2026-09-20T09:00', 'waktu bolak-balik input ⇄ ISO tetap sama');

// ================================================================ Iklan
bagian('Aturan iklan');
const barang = rapikanIklan({ judul: 'Kursi Rotan', harga: 350000, kategori: 'Perabotan', kondisi: 'Bekas - Baik', deskripsi: 'Kokoh', foto: { tipe: 'unggahan', berkas: [{ id: 'a' }, { id: 'b' }] } });
cek(barang.jenis === 'barang' && jumlahFoto(barang) === 2 && periksaIklan(barang).siap, 'iklan barang valid');
const tanpaJudul = rapikanIklan({ harga: 1000, foto: { tipe: 'unggahan', berkas: [{ id: 'a' }] } });
cek(/Judul wajib/.test(periksaIklan(tanpaJudul).galat[0]), 'barang tanpa judul ditolak');
const banyakFoto = rapikanIklan({ judul: 'x', harga: 1, foto: { tipe: 'unggahan', berkas: Array.from({ length: 11 }, (_, i) => ({ id: i })) } });
cek(/Maksimal 10 foto/.test(periksaIklan(banyakFoto).galat[0]), 'barang maksimal 10 foto');
const mobil20 = rapikanIklan({ ...iklan1, foto: { tipe: 'unggahan', berkas: Array.from({ length: 20 }, (_, i) => ({ id: i })) } });
cek(periksaIklan(mobil20).siap, 'kendaraan boleh sampai 20 foto');
cek(/Folder foto belum diisi/.test(periksaIklan(rapikanIklan({ ...iklan1, foto: { tipe: 'folder', folder: '' } })).galat[0]), 'folder foto kosong ditolak');

// ================================================================ Ekstensi
bagian('Protokol ekstensi');
await db().simpanSetelan({ kunciEkstensi: 'kunci-uji-123456789', modeUji: true, jedaMenit: 10, batasHarian: 2, zona: 'Asia/Jakarta' });
const kirim = (o) => prosesEkstensi({ kunci: 'kunci-uji-123456789', ...o });
cek((await prosesEkstensi({ aksi: 'ping', kunci: 'salah' })).kode === 'kunci', 'kunci salah ditolak');
const p = await kirim({ aksi: 'ping' });
cek(p.ok && p.uji === true && p.batas === 2 && p.versi, 'ping mengembalikan setelan & versi', p);

const dulu = new Date(Date.now() - 5 * 60000).toISOString();
const [mobil, barangSiap, belumLengkap] = await db().simpanBanyak([
  { ...iklan1, jadwal: dulu, status: STATUS.TERJADWAL, cara: 'otomatis' },
  { ...barang, jadwal: dulu, status: STATUS.TERJADWAL, cara: 'otomatis', foto: { tipe: 'unggahan', berkas: [] } },
  { ...rapikanIklan({ judul: 'Tanpa harga', foto: { tipe: 'unggahan', berkas: [{ id: 'z' }] } }), jadwal: dulu, status: STATUS.TERJADWAL }
]);
const foto1 = await db().simpanFoto(barangSiap.id, [{ nama: 'satu.jpg', mime: 'image/jpeg', data: Buffer.from([1, 2, 3, 4, 5]) }]);
await db().simpanIklan({ ...barangSiap, foto: { tipe: 'unggahan', berkas: foto1 } });

const a1 = await kirim({ aksi: 'ambil' });
cek(a1.tugas && a1.tugas.id === mobil.id && a1.tugas.jenis === 'kendaraan' && a1.tugas.foto.tipe === 'folder' &&
  a1.tugas.foto.folder === 'D:\\Foto Mobil\\B1590DYA' && a1.tugas.kendaraan.merek === 'Daihatsu',
  'ambil: iklan kendaraan + info folder foto diserahkan', a1.tugas && { jenis: a1.tugas.jenis, foto: a1.tugas.foto });
cek((await db().ambilIklan(mobil.id)).status === STATUS.DIPROSES, 'iklan ditandai Diproses');
const eFolder = await kirim({ aksi: 'foto', id: mobil.id, token: a1.tugas.token, i: 0 });
cek(!eFolder.ok && /folder komputer/.test(eFolder.galat), 'foto folder tidak dilayani server (dibaca ekstensi di PC)', eFolder.galat);
cek(!(await kirim({ aksi: 'progres', id: mobil.id, token: 'palsu', langkah: 'x' })).ok, 'token palsu ditolak');
await kirim({ aksi: 'progres', id: mobil.id, token: a1.tugas.token, langkah: 'mengunggah foto' });
cek((await db().ambilIklan(mobil.id)).langkah === 'mengunggah foto', 'langkah ekstensi tercatat di iklan');
const lu = await kirim({ aksi: 'lapor', id: mobil.id, token: a1.tugas.token, hasil: 'uji' });
cek(lu.status === STATUS.DRAF && /MODE UJI/.test((await db().ambilIklan(mobil.id)).keterangan), 'mode uji → kembali Draf + penjelasan');

await db().simpanSetelan({ modeUji: false });
await db().simpanIklan({ ...mobil, status: STATUS.TERJADWAL, jadwal: dulu, token: null });
const a2 = await kirim({ aksi: 'ambil' });
cek(a2.tugas.id === mobil.id && a2.tugas.uji === false, 'ambil lagi tanpa mode uji');
const lt = await kirim({ aksi: 'lapor', id: mobil.id, token: a2.tugas.token, hasil: 'terbit', url: 'https://www.facebook.com/marketplace/item/1' });
const setelahTerbit = await db().ambilIklan(mobil.id);
cek(lt.status === STATUS.TERBIT && setelahTerbit.hasilUrl.includes('marketplace/item') && hitunganHariIni(await setelanLengkap()) === 1,
  'lapor terbit → status Terbit, tautan tersimpan, hitungan harian naik', [setelahTerbit.status, setelahTerbit.hasilUrl]);
cek(!(await kirim({ aksi: 'lapor', id: mobil.id, token: a2.tugas.token, hasil: 'terbit' })).ok, 'laporan ganda ditolak');

const jeda = await kirim({ aksi: 'ambil' });
cek(!jeda.tugas && /Jeda antar-posting/.test(jeda.tunggu), 'jeda antar-posting dihormati', jeda.tunggu);
await db().simpanSetelan({ postTerakhir: new Date(Date.now() - 11 * 60000).toISOString() });
const a3 = await kirim({ aksi: 'ambil' });
cek(a3.tugas && a3.tugas.id === barangSiap.id, 'setelah jeda lewat → iklan berikutnya diambil', a3.tugas && a3.tugas.judul);
const fotoServer = await kirim({ aksi: 'foto', id: barangSiap.id, token: a3.tugas.token, i: 0 });
cek(fotoServer.ok && Buffer.from(fotoServer.data, 'base64').length === 5 && fotoServer.nama === 'satu.jpg', 'foto unggahan dikirim sebagai base64', fotoServer.galat);
await kirim({ aksi: 'lapor', id: barangSiap.id, token: a3.tugas.token, hasil: 'gagal', pesan: 'Kategori tidak ada di pilihan', pasti: true });
cek(/Ekstensi gagal memposting: Kategori/.test((await db().ambilIklan(barangSiap.id)).keterangan), 'gagal (belum terbit) → alasan tercatat');

await db().simpanSetelan({ postTerakhir: '', hitungHarian: '' });
await db().simpanIklan({ ...belumLengkap, status: STATUS.TERJADWAL, jadwal: dulu });
const a4 = await kirim({ aksi: 'ambil' });
const cekBelum = await db().ambilIklan(belumLengkap.id);
cek(!a4.tugas && cekBelum.status === STATUS.GAGAL && /Harga wajib/.test(cekBelum.keterangan), 'iklan tak lengkap langsung Gagal, tidak diserahkan', cekBelum.keterangan);

await db().simpanIklan({ ...belumLengkap, status: STATUS.DIPROSES, token: 'lama', klaim: new Date(Date.now() - 25 * 60000).toISOString() });
await kirim({ aksi: 'ambil' });
cek(/tidak melaporkan hasil/.test((await db().ambilIklan(belumLengkap.id)).keterangan), 'tugas macet >20 menit → Gagal (cek manual)');

await db().simpanSetelan({ hitungHarian: (await setelanLengkap()).zona ? new Date().toISOString().slice(0, 10) + ':2' : '' });
await db().simpanIklan({ ...mobil, status: STATUS.TERJADWAL, jadwal: dulu, token: null });
const batas = await kirim({ aksi: 'ambil' });
cek(!batas.tugas && /Batas 2 posting/.test(batas.tunggu || ''), 'batas harian dihormati', batas.tunggu);

await kirim({ aksi: 'rekam', diagnosa: { url: 'https://www.facebook.com/marketplace/create/vehicle', pilihan: { merek: ['Daihatsu', 'Toyota'] } } });
const log = await db().daftarLog(10);
cek(log.some((l) => l.jenis === 'rekaman' && /vehicle/.test(l.pesan)) && log.some((l) => l.jenis === 'terbit'), 'log mencatat rekaman & riwayat status', log.map((l) => l.jenis));

// ================================================================ XLSX
bagian('Unggahan XLSX');
const XLSX = await import('xlsx');
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Merk', 'Tahun'], ['Honda', 2019]]), 'Stok');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const dariXlsx = uraiBerkas('stok.xlsx', buf);
cek(dariXlsx[1][0] === 'Honda' && dariXlsx[1][1] === '2019', 'berkas XLSX terbaca', dariXlsx[1]);

fs.rmSync(AKAR_UJI, { recursive: true, force: true });
console.log('\n' + (gagal ? '❌' : '✅') + ' ' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
