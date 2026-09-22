/**
 * Uji kontrak penyimpanan Supabase terhadap tiruan yang patuh skema.sql.
 * Menangkap kolom/tipe yang tidak cocok (mis. "iklanId" vs "iklan_id") tanpa akun Supabase.
 *   node test/uji-supabase.js
 */
import { buatSupabaseTiruan, bacaSkema } from './supabase-tiruan.js';

process.env.SUMBER_DATA = 'supabase';
const { buatPenyimpananSupabase, jelaskanGalat } = await import('../lib/data/supabase.js');
const indeks = await import('../lib/data/index.js');
const { rapikanIklan, STATUS } = await import('../lib/iklan.js');
const { prosesEkstensi } = await import('../lib/ekstensi.js');
const { idBaru } = await import('../lib/rahasia.js');

let lulus = 0;
let gagal = 0;
const bagian = (n) => console.log('\n■ ' + n);
function cek(k, label, info) {
  if (k) { lulus++; console.log('  ✔ ' + label); }
  else { gagal++; console.log('  ✘ ' + label + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
}
async function galatDari(fn) {
  try { await fn(); return ''; } catch (e) { return e.message; }
}

// ================================================================ skema
bagian('Skema');
const skema = bacaSkema();
cek(skema.tabel.ap_iklan?.hasil_url === 'text' && skema.tabel.ap_log?.iklan_id === 'uuid' && skema.tabel.ap_setelan?.nilai === 'jsonb',
  'skema.sql terbaca (tabel, kolom, tipe)', Object.keys(skema.tabel));
cek(skema.bucket.includes('ap-foto'), 'bucket ap-foto ada di skema');

// ================================================================ tiruan menolak yang salah
bagian('Tiruan patuh skema');
const t0 = buatSupabaseTiruan();
const { error: eKolom } = await t0.from('ap_log').insert({ id: idBaru(), iklanId: idBaru() });
cek(/Could not find the 'iklanId' column/.test(eKolom?.message), 'kolom salah nama ditolak (seperti bug iklanId)', eKolom);
const { error: eUuid } = await t0.from('ap_iklan').insert({ id: 'bukan-uuid' });
cek(/uuid/.test(eUuid?.message), 'id bukan uuid ditolak');

// ================================================================ adaptor
bagian('Adaptor Supabase lengkap');
const tiruan = buatSupabaseTiruan();
const s = buatPenyimpananSupabase(tiruan);
indeks.pakaiPenyimpanan(s);

cek((await s.periksa()).length === 0, 'periksa(): tabel & bucket lengkap → tidak ada masalah');
await s.simpanSetelan({ kunciEkstensi: 'kunci-supabase-0123456789', modeUji: false, jedaMenit: 10, batasHarian: 5, zona: 'Asia/Jakarta' });
const st = await s.setelan();
cek(st.kunciEkstensi === 'kunci-supabase-0123456789' && st.modeUji === false && st.batasHarian === 5, 'setelan disimpan & dibaca (jsonb: teks, boolean, angka)', st);

const dulu = new Date(Date.now() - 5 * 60000).toISOString();
const mobil = rapikanIklan({
  kunci: 'B1590DYA', jenis: 'kendaraan', harga: 156400000, deskripsi: 'Mobil siap pakai', status: STATUS.TERJADWAL, jadwal: dulu,
  foto: { tipe: 'unggahan', berkas: [] },
  kendaraan: { tahun: '2025', merek: 'Daihatsu', model: 'Ayla 1.0 X', jarakTempuh: 15770, transmisi: 'Otomatis', bahanBakar: 'Bensin', warna: 'Kuning', tipeBodi: 'Hatchback' }
});
const barang = rapikanIklan({ judul: 'Kursi Rotan', harga: 350000, kategori: 'Perabotan', deskripsi: 'Kokoh', foto: { tipe: 'url', url: 'https://contoh.com/a.jpg' } });

// simpan dari formulir (iklan baru → upsert)
const tersimpan = await s.simpanIklan(mobil);
cek(tersimpan.id && tersimpan.judul === '2025 Daihatsu Ayla 1.0 X' && tersimpan.kendaraan.merek === 'Daihatsu', 'simpan iklan baru (formulir)', tersimpan.judul);
// Kolom banyak akun harus ada di tabel (skema.sql) dan bolak-balik tanpa berubah.
const akunIklan = await s.simpanIklan(rapikanIklan({
  ...mobil, id: undefined, kunci: 'AKUN-1', status: STATUS.DRAF, akun: 'Showroom B',
  terbitAkun: { 'Showroom A': { waktu: '2026-09-22T10:00:00.000Z', url: 'https://facebook.com/marketplace/item/1', hasil: 'terbit' } }
}));
const akunKembali = await s.ambilIklan(akunIklan.id);
cek(akunKembali.akun === 'Showroom B' && akunKembali.terbitAkun['Showroom A'].hasil === 'terbit',
  'kolom akun & terbit_akun tersimpan (kontrak skema banyak akun)', [akunKembali.akun, Object.keys(akunKembali.terbitAkun)]);

const [b2] = await s.simpanBanyak([barang]);
cek(b2.id && b2.foto.url[0] === 'https://contoh.com/a.jpg', 'simpan banyak (impor)');
cek((await s.ambilIklan(tersimpan.id)).harga === 156400000, 'ambil iklan');
cek((await s.daftarIklan({ status: STATUS.TERJADWAL })).length === 1, 'daftar iklan difilter status');
cek((await s.daftarIklan({ cari: 'kursi' })).length === 1, 'pencarian judul');
cek((await s.daftarIklan({ cari: 'a,b(c)%' })).length === 0, 'pencarian dengan koma/kurung tidak merusak kueri');
cek((await s.kunciTerpakai()).includes('B1590DYA'), 'kunci terpakai');

// "Jadwalkan" dari dasbor = simpanIklan + tambahLog
await s.simpanIklan({ ...b2, status: STATUS.TERJADWAL, jadwal: dulu });
const eLog = await galatDari(() => s.tambahLog({ iklanId: b2.id, jenis: STATUS.TERJADWAL, pesan: 'Status diubah dari dasbor.' }));
cek(!eLog, 'catat log dengan iklanId (penyebab error Jadwalkan) berhasil', eLog);
const log = await s.daftarLog(5);
cek(log[0]?.iklanId === b2.id && log[0]?.jenis === 'terjadwal', 'log dibaca kembali dengan iklanId', log[0]);
cek(!(await galatDari(() => s.tambahLog({ jenis: 'impor', pesan: '2 iklan diimpor.' }))), 'log tanpa iklan (impor) berhasil');
cek(!(await galatDari(() => s.tambahLog({ jenis: 'rekaman', pesan: 'x', data: { pilihan: { merek: ['Daihatsu'] } } }))), 'log dengan data jsonb berhasil');

// foto
const foto = await s.simpanFoto(tersimpan.id, [{ nama: 'depan.jpg', mime: 'image/jpeg', data: Buffer.from([1, 2, 3]) }]);
cek((await s.bacaFoto(tersimpan.id, foto[0].id)).data.length === 3, 'unggah & baca foto dari Storage');
await s.simpanIklan({ ...(await s.ambilIklan(tersimpan.id)), foto: { tipe: 'unggahan', berkas: foto } });

// ================================================================ protokol ekstensi di atas Supabase
bagian('Protokol ekstensi di atas Supabase');
const kirim = (o) => prosesEkstensi({ kunci: 'kunci-supabase-0123456789', ...o });
const p = await kirim({ aksi: 'ping' });
cek(p.ok && p.batas === 5, 'ping', p);
const a = await kirim({ aksi: 'ambil' });
cek(a.ok && a.tugas?.id === tersimpan.id && a.tugas.jumlahFoto === 1, 'ambil tugas (klaim → simpan + log)', a.galat || a.tugas?.judul);
const f = await kirim({ aksi: 'foto', id: tersimpan.id, token: a.tugas.token, i: 0 });
cek(f.ok && Buffer.from(f.data, 'base64').length === 3, 'foto dari Storage ke ekstensi', f.galat);
cek((await kirim({ aksi: 'progres', id: tersimpan.id, token: a.tugas.token, langkah: 'mengisi merek' })).ok, 'progres');
const lp = await kirim({ aksi: 'lapor', id: tersimpan.id, token: a.tugas.token, hasil: 'terbit', url: 'https://www.facebook.com/marketplace/item/9', diagnosa: { galat: 'contoh' } });
const akhir = await s.ambilIklan(tersimpan.id);
cek(lp.ok && akhir.status === STATUS.TERBIT && akhir.hasilUrl.endsWith('/item/9') && akhir.token === null, 'lapor terbit tersimpan', lp.galat || akhir.status);
cek((await s.daftarLog(50)).some((l) => l.jenis === 'diagnosa' && l.iklanId === tersimpan.id), 'diagnosa tercatat di log');
cek((await kirim({ aksi: 'rekam', diagnosa: { url: 'https://www.facebook.com/marketplace/create/vehicle' } })).ok, 'rekam formulir');

await s.hapusIklan(tersimpan.id);
cek(!(await s.ambilIklan(tersimpan.id)) && Object.keys(tiruan._berkas).length === 0, 'hapus iklan ikut menghapus fotonya di Storage', Object.keys(tiruan._berkas));

// ================================================================ pesan galat yang menjelaskan
bagian('Pesan galat konfigurasi');
const tanpaTabel = buatPenyimpananSupabase(buatSupabaseTiruan({ tabelHilang: ['ap_log'] }));
const m1 = await tanpaTabel.periksa();
cek(/skema\.sql/.test(m1[0] || ''), 'tabel belum dibuat → periksa() menyuruh menjalankan skema.sql', m1);
const eSimpan = await galatDari(() => tanpaTabel.tambahLog({ jenis: 'x' }));
cek(/SQL Editor/.test(eSimpan), 'galat operasi juga menjelaskan cara memperbaiki', eSimpan);
cek(/SERVICE_ROLE_KEY salah/.test(jelaskanGalat({ message: 'Invalid API key' }, 'uji')), 'kunci API salah → pesan jelas');
cek(/SUPABASE_URL/.test(jelaskanGalat({ message: 'TypeError: fetch failed' }, 'uji')), 'URL salah → pesan jelas');

bagian('Vercel tanpa variabel Supabase');
delete process.env.SUMBER_DATA;
delete process.env.SUPABASE_URL;
process.env.VERCEL = '1';
indeks.pakaiPenyimpanan(null);
const eVercel = await galatDari(() => indeks.db().simpanIklan(barang));
cek(eVercel === indeks.PESAN_BELUM_SUPABASE, 'menyimpan memberi pesan "Supabase belum diatur", bukan error disk', eVercel);
const mVercel = await indeks.periksaKonfigurasi();
cek(mVercel.some((m) => /Supabase belum diatur/.test(m)) && mVercel.some((m) => /SANDI_DASBOR/.test(m)), 'banner dasbor menyebutkan variabel yang kurang', mVercel);
const eBaca = await galatDari(() => indeks.db().daftarIklan());
cek(!eBaca, 'halaman tetap bisa dibuka (membaca tidak crash)', eBaca);

console.log('\n' + (gagal ? '❌' : '✅') + ' ' + lulus + ' lulus, ' + gagal + ' gagal');
process.exit(gagal ? 1 : 0);
