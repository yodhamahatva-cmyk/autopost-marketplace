/**
 * Penyimpanan Supabase (dipakai di produksi/Vercel).
 * Semua akses lewat service role key di server — tabel memakai RLS tanpa
 * kebijakan apa pun, sehingga tidak bisa dibaca dari browser. Lihat skema.sql.
 */
import { createClient } from '@supabase/supabase-js';
import { idBaru } from '../rahasia.js';

const TABEL = { iklan: 'ap_iklan', log: 'ap_log', setelan: 'ap_setelan' };
const EMBER = 'ap-foto';

let klien = null;
function sb() {
  if (klien) return klien;
  const url = process.env.SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diatur (lihat .env.contoh).');
  klien = createClient(url, kunci, { auth: { persistSession: false } });
  return klien;
}

const lempar = (galat, apa) => { if (galat) throw new Error('Supabase (' + apa + '): ' + galat.message); };

export function buatPenyimpananSupabase() {
  return {
    jenis: 'supabase',

    async setelan() {
      const { data, error } = await sb().from(TABEL.setelan).select('kunci, nilai');
      lempar(error, 'baca setelan');
      return (data || []).reduce((h, r) => (h[r.kunci] = r.nilai, h), {});
    },
    async simpanSetelan(patch) {
      const baris = Object.entries(patch).map(([kunci, nilai]) => ({ kunci, nilai, diubah: new Date().toISOString() }));
      if (baris.length) {
        const { error } = await sb().from(TABEL.setelan).upsert(baris, { onConflict: 'kunci' });
        lempar(error, 'simpan setelan');
      }
      return this.setelan();
    },

    async daftarIklan({ status, cari, batas = 500 } = {}) {
      let q = sb().from(TABEL.iklan).select('*').order('jadwal', { ascending: true, nullsFirst: false }).limit(batas);
      if (status) q = q.eq('status', status);
      if (cari) q = q.or(['judul.ilike.%' + cari + '%', 'kunci.ilike.%' + cari + '%'].join(','));
      const { data, error } = await q;
      lempar(error, 'daftar iklan');
      return (data || []).map(dariBaris);
    },
    async ambilIklan(id) {
      const { data, error } = await sb().from(TABEL.iklan).select('*').eq('id', id).maybeSingle();
      lempar(error, 'ambil iklan');
      return data ? dariBaris(data) : null;
    },
    async kunciTerpakai() {
      const { data, error } = await sb().from(TABEL.iklan).select('kunci').not('kunci', 'is', null);
      lempar(error, 'kunci terpakai');
      return (data || []).map((r) => r.kunci).filter(Boolean);
    },
    async simpanIklan(iklan) {
      const baris = keBaris({ ...iklan, id: iklan.id || idBaru() });
      const { data, error } = await sb().from(TABEL.iklan).upsert(baris, { onConflict: 'id' }).select().single();
      lempar(error, 'simpan iklan');
      return dariBaris(data);
    },
    async simpanBanyak(daftar) {
      const baris = daftar.map((x) => keBaris({ ...x, id: x.id || idBaru() }));
      const { data, error } = await sb().from(TABEL.iklan).insert(baris).select();
      lempar(error, 'simpan banyak iklan');
      return (data || []).map(dariBaris);
    },
    async hapusIklan(id) {
      const { error } = await sb().from(TABEL.iklan).delete().eq('id', id);
      lempar(error, 'hapus iklan');
      await sb().storage.from(EMBER).remove([id]).catch(() => {});
      return true;
    },

    async tambahLog(baris) {
      const { error } = await sb().from(TABEL.log).insert({ id: idBaru(), waktu: new Date().toISOString(), ...baris });
      lempar(error, 'tambah log');
      return true;
    },
    async daftarLog(batas = 50) {
      const { data, error } = await sb().from(TABEL.log).select('*').order('waktu', { ascending: false }).limit(batas);
      lempar(error, 'daftar log');
      return data || [];
    },

    async simpanFoto(iklanId, berkasBaru) {
      const hasil = [];
      for (const f of berkasBaru) {
        const id = idBaru();
        const nama = String(f.nama || 'foto.jpg').replace(/[^\w.\- ]+/g, '_');
        const jalur = iklanId + '/' + id + '__' + nama;
        const { error } = await sb().storage.from(EMBER).upload(jalur, Buffer.from(f.data), {
          contentType: f.mime || 'image/jpeg', upsert: false
        });
        lempar(error, 'unggah foto');
        hasil.push({ id, nama, mime: f.mime || 'image/jpeg', ukuran: Buffer.from(f.data).length });
      }
      return hasil;
    },
    async bacaFoto(iklanId, fotoId) {
      const { data: daftar, error } = await sb().storage.from(EMBER).list(iklanId, { limit: 200 });
      lempar(error, 'cari foto');
      const berkas = (daftar || []).find((f) => f.name.startsWith(fotoId + '__'));
      if (!berkas) throw new Error('Foto tidak ditemukan.');
      const { data, error: e2 } = await sb().storage.from(EMBER).download(iklanId + '/' + berkas.name);
      lempar(e2, 'unduh foto');
      return { nama: berkas.name.slice(fotoId.length + 2), data: Buffer.from(await data.arrayBuffer()) };
    },
    async hapusFoto(iklanId, fotoId) {
      const { data: daftar } = await sb().storage.from(EMBER).list(iklanId, { limit: 200 });
      const berkas = (daftar || []).find((f) => f.name.startsWith(fotoId + '__'));
      if (berkas) await sb().storage.from(EMBER).remove([iklanId + '/' + berkas.name]);
      return true;
    }
  };
}

// Kolom jsonb disimpan apa adanya; sisanya kolom biasa agar bisa difilter & diurutkan.
const keBaris = (x) => ({
  id: x.id, kunci: x.kunci || null, jenis: x.jenis, judul: x.judul, harga: x.harga,
  kategori: x.kategori, kondisi: x.kondisi, lokasi: x.lokasi, deskripsi: x.deskripsi,
  foto: x.foto, kendaraan: x.kendaraan, cara: x.cara, jadwal: x.jadwal, status: x.status,
  keterangan: x.keterangan, langkah: x.langkah, token: x.token, klaim: x.klaim,
  hasil_url: x.hasilUrl, sumber: x.sumber, dibuat: x.dibuat, diubah: x.diubah
});

const dariBaris = (r) => ({
  id: r.id, kunci: r.kunci || '', jenis: r.jenis, judul: r.judul, harga: r.harga,
  kategori: r.kategori || '', kondisi: r.kondisi || '', lokasi: r.lokasi || '', deskripsi: r.deskripsi || '',
  foto: r.foto || { tipe: 'unggahan', berkas: [] }, kendaraan: r.kendaraan || null, cara: r.cara,
  jadwal: r.jadwal, status: r.status, keterangan: r.keterangan || '', langkah: r.langkah || '',
  token: r.token, klaim: r.klaim, hasilUrl: r.hasil_url || '', sumber: r.sumber || null,
  dibuat: r.dibuat, diubah: r.diubah
});
