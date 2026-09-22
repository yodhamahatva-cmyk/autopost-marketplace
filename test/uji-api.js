/**
 * Uji HTTP terhadap server yang sedang berjalan (bawaan http://localhost:3110).
 * Menyiapkan data di folder DATA_DIR server, lalu memanggil API seperti ekstensi Chrome.
 *   node test/uji-api.js [urlDasar]
 */
import fs from 'node:fs';
import path from 'node:path';

const DASAR = process.argv[2] || 'http://localhost:3110';
const DATA = process.env.DATA_DIR || path.join(process.cwd(), 'data');

let lulus = 0;
let gagal = 0;
const bagian = (n) => console.log('\n■ ' + n);
function cek(k, label, info) {
  if (k) { lulus++; console.log('  ✔ ' + label); }
  else { gagal++; console.log('  ✘ ' + label + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
}

const KUNCI = 'kunci-uji-api-0123456789';
const kirim = (isi) => fetch(DASAR + '/api/ekstensi', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kunci: KUNCI, ...isi })
}).then((r) => r.json());

// ---------------------------------------------------------------- siapkan data server
const iso = (m) => new Date(Date.now() + m * 60000).toISOString();
const IKLAN = {
  id: 'uji-mobil-1', kunci: 'B1590DYA', jenis: 'kendaraan', judul: '2025 Daihatsu Ayla 1.0 X',
  harga: 156400000, kategori: 'Kendaraan', kondisi: 'Bekas - Baik', lokasi: 'Jakarta Pusat',
  deskripsi: 'Mobil siap pakai, dokumen lengkap.',
  foto: { tipe: 'folder', folder: 'D:\\Foto Mobil\\B1590DYA' },
  kendaraan: { jenis: 'Mobil/Truk', tahun: '2025', merek: 'Daihatsu', model: 'Ayla 1.0 X', jarakTempuh: 15770,
    transmisi: 'Otomatis', bahanBakar: 'Bensin', warna: 'Kuning', tipeBodi: 'Hatchback' },
  cara: 'otomatis', jadwal: iso(-5), status: 'terjadwal', keterangan: '', langkah: '', token: null, klaim: null,
  hasilUrl: '', sumber: { nama: 'uji', baris: 2 }, dibuat: iso(-60), diubah: iso(-60)
};
fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(path.join(DATA, 'iklan.json'), JSON.stringify([IKLAN], null, 2));
fs.writeFileSync(path.join(DATA, 'setelan.json'), JSON.stringify({
  kunciEkstensi: KUNCI, modeUji: true, jedaMenit: 10, batasHarian: 10, zona: 'Asia/Jakarta'
}, null, 2));

// ---------------------------------------------------------------- uji
bagian('Titik sambung ekstensi');
const info = await fetch(DASAR + '/api/ekstensi').then((r) => r.json());
cek(info.ok && info.versi, 'GET /api/ekstensi menyebut versi', info);
const salah = await fetch(DASAR + '/api/ekstensi', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aksi: 'ping', kunci: 'salah' })
});
cek(salah.status === 401 && (await salah.json()).kode === 'kunci', 'kunci salah → 401');
const opsi = await fetch(DASAR + '/api/ekstensi', { method: 'OPTIONS' });
cek(opsi.status === 204 && opsi.headers.get('access-control-allow-origin') === '*', 'CORS untuk ekstensi (OPTIONS)');

const p = await kirim({ aksi: 'ping' });
cek(p.ok && p.uji === true && p.batas === 10, 'ping membaca setelan server', p);

bagian('Alur pemasangan iklan');
const a = await kirim({ aksi: 'ambil' });
cek(a.tugas?.id === IKLAN.id && a.tugas.jenis === 'kendaraan' && a.tugas.foto.folder === IKLAN.foto.folder &&
  a.tugas.kendaraan.merek === 'Daihatsu' && a.tugas.uji === true, 'ambil: tugas kendaraan + folder foto', a.tugas);
cek((await kirim({ aksi: 'progres', id: IKLAN.id, token: a.tugas.token, langkah: 'mengisi merek' })).ok, 'progres diterima');
const setelahProgres = JSON.parse(fs.readFileSync(path.join(DATA, 'iklan.json'), 'utf8'))[0];
cek(setelahProgres.status === 'diproses' && setelahProgres.langkah === 'mengisi merek', 'langkah tersimpan di data', setelahProgres.langkah);
const uji = await kirim({ aksi: 'lapor', id: IKLAN.id, token: a.tugas.token, hasil: 'uji' });
cek(uji.status === 'draf', 'lapor mode uji → kembali Draf');

// mode uji dimatikan → terbit sungguhan
fs.writeFileSync(path.join(DATA, 'setelan.json'), JSON.stringify({
  kunciEkstensi: KUNCI, modeUji: false, jedaMenit: 10, batasHarian: 10, zona: 'Asia/Jakarta'
}, null, 2));
const semua = JSON.parse(fs.readFileSync(path.join(DATA, 'iklan.json'), 'utf8'));
semua[0] = { ...semua[0], status: 'terjadwal', jadwal: iso(-5), token: null, klaim: null };
fs.writeFileSync(path.join(DATA, 'iklan.json'), JSON.stringify(semua, null, 2));

const a2 = await kirim({ aksi: 'ambil' });
cek(a2.tugas?.uji === false, 'ambil tanpa mode uji');
const terbit = await kirim({ aksi: 'lapor', id: IKLAN.id, token: a2.tugas.token, hasil: 'terbit', url: 'https://www.facebook.com/marketplace/item/123' });
const akhir = JSON.parse(fs.readFileSync(path.join(DATA, 'iklan.json'), 'utf8'))[0];
cek(terbit.status === 'terbit' && akhir.status === 'terbit' && akhir.hasilUrl.includes('item/123'), 'lapor terbit tersimpan', akhir.status);
const jeda = await kirim({ aksi: 'ambil' });
cek(!jeda.tugas, 'antrean kosong setelah terbit');

// mode draf → iklan tersimpan di Facebook tetapi tidak diterbitkan
fs.writeFileSync(path.join(DATA, 'setelan.json'), JSON.stringify({
  kunciEkstensi: KUNCI, akhir: 'draf', modeUji: false, jedaMenit: 10, batasHarian: 10, zona: 'Asia/Jakarta'
}, null, 2));
const ulang = JSON.parse(fs.readFileSync(path.join(DATA, 'iklan.json'), 'utf8'));
ulang[0] = { ...ulang[0], status: 'terjadwal', jadwal: iso(-5), token: null, klaim: null, hasilUrl: '' };
fs.writeFileSync(path.join(DATA, 'iklan.json'), JSON.stringify(ulang, null, 2));
const aDraf = await kirim({ aksi: 'ambil' });
cek(aDraf.tugas?.draf === true && aDraf.tugas.uji === false, 'ambil dalam mode draf: tugas bertanda draf', aDraf.tugas && { draf: aDraf.tugas.draf, uji: aDraf.tugas.uji });
const draf = await kirim({ aksi: 'lapor', id: IKLAN.id, token: aDraf.tugas.token, hasil: 'draf' });
const stDraf = JSON.parse(fs.readFileSync(path.join(DATA, 'iklan.json'), 'utf8'))[0];
cek(draf.status === 'draf-fb' && stDraf.status === 'draf-fb' && /Draf/.test(stDraf.keterangan), 'lapor draf → status Draf di Facebook', stDraf.status);
cek((await kirim({ aksi: 'rekam', diagnosa: { url: 'https://www.facebook.com/marketplace/create/vehicle' } })).ok, 'rekam formulir diterima');

bagian('Banyak akun lewat API');
const kirimAkun = (nama, o) => fetch(DASAR + '/api/ekstensi', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ kunci: KUNCI, perangkat: nama, versiEkstensi: '2.4.0', ...o })
}).then((r) => r.json());
fs.writeFileSync(path.join(DATA, 'setelan.json'), JSON.stringify({
  kunciEkstensi: KUNCI, akhir: 'terbit', modeUji: false, jedaMenit: 10, batasHarian: 10, zona: 'Asia/Jakarta',
  perangkat: { 'Akun 1': { terakhir: new Date().toISOString() }, 'Akun 2': { terakhir: new Date().toISOString() } }
}, null, 2));
const sebelumAkun = JSON.parse(fs.readFileSync(path.join(DATA, 'iklan.json'), 'utf8'));
fs.writeFileSync(path.join(DATA, 'iklan.json'), JSON.stringify([
  ...sebelumAkun,
  { ...IKLAN, id: '11111111-1111-4111-8111-111111111111', kunci: 'SEMUA', akun: '*', terbitAkun: {}, status: 'terjadwal', jadwal: iso(-5), token: null, klaim: null, hasilUrl: '' }
], null, 2));
const p1 = await kirimAkun('Akun 1', { aksi: 'ping' });
cek(p1.perangkat === 'Akun 1', 'ping menyebut nama akun yang terdaftar', p1.perangkat);
const t1 = await kirimAkun('Akun 1', { aksi: 'ambil' });
cek(t1.tugas?.id === '11111111-1111-4111-8111-111111111111', 'akun 1 mengambil iklan "semua akun"', t1.tunggu);
const r1 = await kirimAkun('Akun 1', { aksi: 'lapor', id: t1.tugas.id, token: t1.tugas.token, hasil: 'terbit', url: 'https://www.facebook.com/marketplace/item/1' });
cek(r1.status === 'terjadwal' && r1.sisaAkun?.join() === 'Akun 2', 'setelah akun 1 → antre lagi untuk akun 2', r1);
const simpanan = JSON.parse(fs.readFileSync(path.join(DATA, 'iklan.json'), 'utf8')).find((x) => x.kunci === 'SEMUA');
cek(simpanan.terbitAkun['Akun 1']?.hasil === 'terbit' && /Menunggu akun berikutnya: Akun 2/.test(simpanan.keterangan),
  'riwayat per akun tersimpan di berkas data', simpanan.keterangan);
const t1b = await kirimAkun('Akun 1', { aksi: 'ambil' });
cek(!t1b.tugas, 'akun 1 tidak mengambilnya untuk kedua kali', t1b.tunggu);

bagian('Impor CSV lewat API');
const csv = 'No Polisi,Merk,Model,Varian,Tahun,Transmisi,KM,Harga,Warna,Deskripsi\n' +
  'B7788ABC,Honda,Brio,1.2 RS CVT,2022,OTOMATIS,32000,"Rp 168.000.000",Merah,Unit terawat\n';
const fd = new FormData();
fd.set('berkas', new Blob([csv], { type: 'text/csv' }), 'stok.csv');
const imp = await fetch(DASAR + '/api/impor', { method: 'POST', body: fd }).then((r) => r.json());
cek(imp.ok && imp.jumlahBaris === 2 && imp.barisHeader === 1, 'CSV terbaca (header + 1 baris data)', imp.galat || imp.jumlahBaris);
cek(imp.tebakan?.merek?.kolom === 'B' && imp.tebakan?.jarakTempuh?.kolom === 'G' && imp.tebakan?.kunci?.kolom === 'A',
  'pemetaan kolom ditebak dari header', imp.tebakan);
cek(imp.kunciTerpakai?.includes('B1590DYA'), 'kunci yang sudah terpakai ikut dikirim (untuk cegah dobel)', imp.kunciTerpakai);
const impSalah = await fetch(DASAR + '/api/impor', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://contoh.com/bukan-sheet' })
}).then((r) => r.json());
cek(!impSalah.ok && /Bukan link Google Sheet/.test(impSalah.galat), 'link bukan Google Sheet ditolak dengan petunjuk', impSalah.galat);

bagian('Halaman dasbor');
for (const [jalur, harus] of [['/', 'Dasbor'], ['/iklan', 'Iklan'], ['/impor', 'Impor dari Google Sheet'], ['/pengaturan', 'Ekstensi Chrome']]) {
  const html = await fetch(DASAR + jalur).then((r) => r.text());
  cek(html.includes(harus), 'halaman ' + jalur + ' termuat');
}

console.log('\n' + (gagal ? '❌' : '✅') + ' ' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
