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
const { rapikanIklan, periksaIklan, jumlahFoto, STATUS, caraAkhir } = await import('../lib/iklan.js');
const { db, setelanLengkap } = await import('../lib/data/index.js');
const { prosesEkstensi, hitunganHariIni, alamatGambar, unduhGambar } = await import('../lib/ekstensi.js');
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
const imporAkun = susunImpor(tabel, { peta: petaPakai, barisAwal: 2, mulai, jedaMenit: 15, akun: '*', status: 'terjadwal' });
cek(imporAkun.hasil.every((h) => h.iklan.akun === '*') && imporAkun.hasil[0].iklan.status === 'terjadwal',
  'akun tujuan dari halaman Impor dipakai semua baris', imporAkun.hasil.map((h) => h.iklan.akun));
cek(susunImpor(tabel, { peta: petaPakai, barisAwal: 2, mulai }).hasil.every((h) => h.iklan.akun === ''),
  'tanpa pilihan akun → tetap "akun mana saja"');

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

// ---- Mode draf: iklan disimpan di Facebook tetapi tidak diterbitkan
bagian('Mode draf Facebook');
cek(caraAkhir({ modeUji: true }) === 'uji' && caraAkhir({ modeUji: false }) === 'terbit' && caraAkhir({ akhir: 'draf', modeUji: true }) === 'draf',
  'setelan lama tanpa akhir tetap terbaca (modeUji jadi cadangan)');
await db().simpanSetelan({ akhir: 'draf', modeUji: false, postTerakhir: '', hitungHarian: '', batasHarian: 10 });
await db().simpanIklan({ ...mobil, status: STATUS.TERJADWAL, jadwal: dulu, token: null, hasilUrl: '' });
const pingDraf = await kirim({ aksi: 'ping' });
cek(pingDraf.akhir === 'draf' && pingDraf.draf === true && pingDraf.uji === false, 'ping memberi tahu ekstensi bahwa mode draf aktif', pingDraf);
const aDraf = await kirim({ aksi: 'ambil' });
cek(aDraf.tugas && aDraf.tugas.draf === true && aDraf.tugas.uji === false, 'tugas membawa penanda draf', aDraf.tugas && { draf: aDraf.tugas.draf, uji: aDraf.tugas.uji });
const lDraf = await kirim({ aksi: 'lapor', id: mobil.id, token: aDraf.tugas.token, hasil: 'draf' });
const stDraf = await db().ambilIklan(mobil.id);
cek(lDraf.status === STATUS.DRAF_FB && /draf di Facebook Marketplace/i.test(stDraf.keterangan) && stDraf.hasilUrl.includes('marketplace/you'),
  'lapor draf → status Draf di Facebook + tautan ke daftar draf', [stDraf.status, stDraf.keterangan]);
cek(hitunganHariIni(await setelanLengkap()) === 1, 'draf ikut dihitung pada jeda & batas harian');

// ---- Banyak akun: tiap Chrome menyebut namanya, kuota & antrean per akun
bagian('Banyak akun Facebook');
const { daftarPerangkat, cocokAkun, labelAkun } = await import('../lib/perangkat.js');
await db().simpanSetelan({ akhir: 'terbit', modeUji: false, postTerakhir: '', hitungHarian: '', perangkat: {}, batasHarian: 10, jedaMenit: 10 });
const kirimA = (o) => prosesEkstensi({ kunci: 'kunci-uji-123456789', perangkat: 'Showroom A', versiEkstensi: '2.4.0', ...o });
const kirimB = (o) => prosesEkstensi({ kunci: 'kunci-uji-123456789', perangkat: 'Showroom B', ...o });
await kirimA({ aksi: 'ping' });
await kirimB({ aksi: 'ping' });
const perangkatTerdaftar = daftarPerangkat(await setelanLengkap());
cek(perangkatTerdaftar.length === 2 && perangkatTerdaftar[0].nama === 'Showroom A' && perangkatTerdaftar[0].aktif && perangkatTerdaftar[0].versi === '2.4.0',
  'tiap Chrome tercatat sendiri lengkap dengan kontak terakhir & versi', perangkatTerdaftar.map((p) => p.nama));

const [khususB, bebas] = await db().simpanBanyak([
  { ...mobil, id: undefined, kunci: 'AKUN-B', akun: 'Showroom B', status: STATUS.TERJADWAL, jadwal: dulu, token: null, terbitAkun: {} },
  { ...mobil, id: undefined, kunci: 'AKUN-BEBAS', akun: '', status: STATUS.TERJADWAL, jadwal: dulu, token: null, terbitAkun: {} }
]);
cek(cocokAkun(khususB, 'Showroom B') && !cocokAkun(khususB, 'Showroom A') && cocokAkun(bebas, 'Showroom A'),
  'iklan berakun khusus hanya boleh diambil Chrome yang namanya cocok');
const ambilA = await kirimA({ aksi: 'ambil' });
cek(ambilA.tugas && ambilA.tugas.id === bebas.id, 'Chrome A melewati iklan milik akun B dan mengambil yang bebas', ambilA.tugas && ambilA.tugas.judul);
const ambilB = await kirimB({ aksi: 'ambil' });
cek(ambilB.tugas && ambilB.tugas.id === khususB.id, 'Chrome B mengambil iklan yang ditujukan kepadanya — jeda akun A tidak menahannya', ambilB.tunggu);
await kirimA({ aksi: 'lapor', id: bebas.id, token: ambilA.tugas.token, hasil: 'terbit', url: 'https://facebook.com/marketplace/item/9' });
await kirimB({ aksi: 'lapor', id: khususB.id, token: ambilB.tugas.token, hasil: 'terbit', url: 'https://facebook.com/marketplace/item/8' });
const setelahDua = await setelanLengkap();
cek(hitunganHariIni(setelahDua, 'Showroom A') === 1 && hitunganHariIni(setelahDua, 'Showroom B') === 1,
  'hitungan harian dihitung per akun (masing-masing 1)', [hitunganHariIni(setelahDua, 'Showroom A'), hitunganHariIni(setelahDua, 'Showroom B')]);
cek(/akun "Showroom B"/.test((await db().ambilIklan(khususB.id)).keterangan), 'keterangan menyebut akun yang memasang');

// ---- Satu iklan untuk SEMUA akun: dipasang bergiliran, selesai setelah semua kebagian
const [serentak] = await db().simpanBanyak([
  { ...mobil, id: undefined, kunci: 'AKUN-SEMUA', akun: '*', status: STATUS.TERJADWAL, jadwal: dulu, token: null, terbitAkun: {} }
]);
cek(labelAkun(serentak) === 'Semua akun' && labelAkun(bebas) === 'Akun mana saja', 'label akun terbaca manusia');
await db().simpanSetelan({ perangkat: { 'Showroom A': { terakhir: new Date().toISOString() }, 'Showroom B': { terakhir: new Date().toISOString() } } });
const s1 = await kirimA({ aksi: 'ambil' });
cek(s1.tugas && s1.tugas.id === serentak.id, 'iklan "semua akun" diambil akun pertama', s1.tunggu);
const l1 = await kirimA({ aksi: 'lapor', id: serentak.id, token: s1.tugas.token, hasil: 'terbit', url: 'https://facebook.com/marketplace/item/1' });
const setelahA = await db().ambilIklan(serentak.id);
cek(l1.status === STATUS.TERJADWAL && l1.sisaAkun.join() === 'Showroom B' && setelahA.terbitAkun['Showroom A'] &&
  /Menunggu akun berikutnya: Showroom B/.test(setelahA.keterangan),
  'setelah akun A: kembali mengantre untuk akun B', [setelahA.status, setelahA.keterangan]);
cek(!cocokAkun(setelahA, 'Showroom A') && cocokAkun(setelahA, 'Showroom B'), 'akun A tidak akan memasangnya dua kali');
await db().simpanIklan({ ...setelahA, jadwal: dulu });
await db().simpanSetelan({ perangkat: { ...(await setelanLengkap()).perangkat, 'Showroom B': { terakhir: new Date().toISOString() } } });
const s2 = await kirimB({ aksi: 'ambil' });
cek(s2.tugas && s2.tugas.id === serentak.id, 'akun B kebagian iklan yang sama', s2.tunggu);
const l2 = await kirimB({ aksi: 'lapor', id: serentak.id, token: s2.tugas.token, hasil: 'terbit', url: 'https://facebook.com/marketplace/item/2' });
const setelahB = await db().ambilIklan(serentak.id);
cek(l2.status === STATUS.TERBIT && Object.keys(setelahB.terbitAkun).join() === 'Showroom A,Showroom B',
  'setelah semua akun kebagian → status Terbit dengan daftar akunnya', [setelahB.status, Object.keys(setelahB.terbitAkun)]);

// ---- Templat Google Sheet resmi: harus terpetakan 100% tanpa diutak-atik
bagian('Templat sheet kendaraan');
const { KOLOM_TEMPLAT, isiPilihan, BERKAS_PILIHAN, BERKAS_STOK } = await import('../templat/buat-templat.js');
const isiTemplat = fs.readFileSync(BERKAS_STOK, 'utf8');
const tabelTemplat = uraiCsv(isiTemplat);
cek(tabelTemplat[0].join('|') === KOLOM_TEMPLAT.join('|'), 'header templat sama dengan daftar kolom resmi', tabelTemplat[0]);
const ringkasTemplat = ringkasTabel(tabelTemplat);
const petaTemplat = tebakPemetaan(ringkasTemplat.kolom);
const HARUS = {
  kunci: 'A', jenisKendaraan: 'B', tahun: 'C', merek: 'D', model: 'E', jarakTempuh: 'F', harga: 'G',
  tipeBodi: 'H', warna: 'I', kondisi: 'J', bahanBakar: 'K', transmisi: 'L', lokasi: 'M', deskripsi: 'N',
  fotoFolder: 'O', fotoUrl: 'P'
};
const salahPeta = Object.entries(HARUS).filter(([k, h]) => (petaTemplat[k] || {}).kolom !== h)
  .map(([k, h]) => k + ' → ' + ((petaTemplat[k] || {}).kolom || '-') + ' (harusnya ' + h + ')');
cek(!salahPeta.length, 'setiap kolom templat terpetakan ke isian yang benar', salahPeta);
const imporTemplat = susunImpor(tabelTemplat, { peta: petaTemplat, barisAwal: 2, mulai, jedaMenit: 30, cara: 'otomatis', status: 'terjadwal' });
cek(imporTemplat.hasil.length === 3 && imporTemplat.hasil.every((h) => !h.masalah.length), '3 baris contoh langsung lolos pemeriksaan',
  imporTemplat.hasil.map((h) => h.masalah));
const motor = imporTemplat.hasil[2].iklan;
cek(motor.kendaraan.jenis === 'Sepeda Motor' && !motor.kendaraan.tipeBodi && periksaIklan(motor).siap, 'sepeda motor sah tanpa Tipe Bodi', periksaIklan(motor).galat);
const mobilTemplat = imporTemplat.hasil[0].iklan;
cek(mobilTemplat.kendaraan.warna === 'Kuning' && mobilTemplat.kendaraan.tipeBodi === 'Hatchback' && mobilTemplat.kendaraan.model === 'Ayla 1.0 X' &&
  mobilTemplat.kendaraan.bahanBakar === 'Bensin' && mobilTemplat.kendaraan.jarakTempuh === 15770 && mobilTemplat.foto.tipe === 'folder',
  'nilai baris contoh masuk ke tempat yang benar', mobilTemplat.kendaraan);
cek(fs.readFileSync(BERKAS_PILIHAN, 'utf8') === isiPilihan(), 'daftar pilihan nilai masih sama dengan aturan aplikasi (jalankan node templat/buat-templat.js bila beda)');

// Satu berkas untuk semuanya: tab Stok + Pilihan Nilai + Petunjuk
const { BERKAS_XLSX, NAMA_TAB, barisMatriks } = await import('../templat/buat-templat.js');
const bukuXlsx = (await import('xlsx')).read(fs.readFileSync(BERKAS_XLSX), { type: 'buffer' });
cek(bukuXlsx.SheetNames.join('|') === [NAMA_TAB.stok, NAMA_TAB.pilihan, NAMA_TAB.petunjuk].join('|'),
  'XLSX berisi tiga tab dengan Stok di urutan pertama (itu yang dibaca aplikasi)', bukuXlsx.SheetNames);
const dariXlsxTemplat = uraiBerkas('templat.xlsx', fs.readFileSync(BERKAS_XLSX));
cek(dariXlsxTemplat[0].join('|') === KOLOM_TEMPLAT.join('|') && dariXlsxTemplat.length === 4,
  'unggahan XLSX terbaca sebagai tabel stok yang sama dengan CSV', dariXlsxTemplat.length);
const imporXlsx = susunImpor(dariXlsxTemplat, { peta: tebakPemetaan(ringkasTabel(dariXlsxTemplat).kolom), barisAwal: 2, mulai, jedaMenit: 30 });
cek(imporXlsx.hasil.length === 3 && imporXlsx.hasil.every((h) => !h.masalah.length) &&
  imporXlsx.hasil[0].iklan.kendaraan.model === 'Ayla 1.0 X' && imporXlsx.hasil[0].iklan.kendaraan.warna === 'Kuning',
  'impor dari XLSX menghasilkan iklan yang sama persis', imporXlsx.hasil.map((h) => h.masalah));
const matriks = barisMatriks();
cek(matriks[0][0] === 'Jenis Kendaraan' && matriks[1][2] === 'Hitam' && matriks.length === 14,
  'tab Pilihan Nilai berbentuk tabel (siap dipakai Validasi data → Dari rentang)', matriks[0]);

// ---- Header dealer yang mudah tertukar
const kolomJebakan = ['No Polisi', 'Merk', 'Model', 'Varian', 'Tahun', 'Jenis Bahan Bakar', 'Tipe Body', 'Warna', 'Warna Interior', 'Jenis Kendaraan']
  .map((j, i) => ({ huruf: String.fromCharCode(65 + i), judul: j }));
const petaJebakan = tebakPemetaan(kolomJebakan);
cek(petaJebakan.model.kolom === 'C' && petaJebakan.bahanBakar.kolom === 'F' && petaJebakan.tipeBodi.kolom === 'G' &&
  petaJebakan.warna.kolom === 'H' && petaJebakan.jenisKendaraan.kolom === 'J',
  'header mirip tidak tertukar: Varian≠Model, Jenis Bahan Bakar≠Jenis Kendaraan, Warna Interior≠Warna',
  Object.fromEntries(Object.entries(petaJebakan).map(([k, v]) => [k, v.kolom])));

// ================================================================ XLSX
bagian('Unggahan XLSX');
const XLSX = await import('xlsx');
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Merk', 'Tahun'], ['Honda', 2019]]), 'Stok');
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const dariXlsx = uraiBerkas('stok.xlsx', buf);
cek(dariXlsx[1][0] === 'Honda' && dariXlsx[1][1] === '2019', 'berkas XLSX terbaca', dariXlsx[1]);

// ================================================================ Foto dari URL / Google Drive
bagian('Foto dari URL');
const dariDrive = alamatGambar('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS/view?usp=sharing');
cek(dariDrive.length === 3 && dariDrive[0] === 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrS=w2048',
  'link berbagi Drive diubah jadi alamat gambar langsung', dariDrive[0]);
cek(alamatGambar('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrS')[0].includes('1AbCdEfGhIjKlMnOpQrS'), 'bentuk ?id= juga dikenali');
cek(alamatGambar('https://situs.com/foto.jpg').join() === 'https://situs.com/foto.jpg', 'URL biasa tidak diubah');

const fetchAsli = globalThis.fetch;
const balas = (tipe, isi) => ({ ok: true, status: 200, headers: { get: () => tipe }, arrayBuffer: async () => isi });
const PNG_UJI = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(900, 7)]);
globalThis.fetch = async () => balas('image/png', PNG_UJI);
const gambarOk = await unduhGambar('https://situs.com/foto.png');
cek(gambarOk.mime === 'image/png' && gambarOk.data.length === PNG_UJI.length, 'gambar sungguhan diterima', gambarOk.mime);

const diminta = [];
globalThis.fetch = async (u) => { diminta.push(u); return balas('text/html; charset=utf-8', Buffer.from('<html>Masuk ke Google</html>')); };
let galatFoto = '';
try { await unduhGambar('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrS/view'); } catch (e) { galatFoto = e.message; }
cek(diminta.length === 3 && /halaman web, bukan gambar/.test(galatFoto) && /Siapa saja yang memiliki link/.test(galatFoto),
  'link Drive yang belum dibagikan: semua alamat dicoba lalu dijelaskan cara memperbaikinya', galatFoto);
globalThis.fetch = fetchAsli;

fs.rmSync(AKAR_UJI, { recursive: true, force: true });
console.log('\n' + (gagal ? '❌' : '✅') + ' ' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
