'use server';
/**
 * Aksi server yang dipanggil dari halaman & komponen (simpan iklan, ubah status, impor, setelan).
 *
 * Di produksi Next.js menyembunyikan isi galat yang DILEMPAR ("Application error: a server-side
 * exception…"). Karena itu setiap aksi menangkap galatnya sendiri dan mengembalikannya sebagai
 * pesan (atau mengalihkan ke halaman dengan ?galat=…), supaya penyebabnya terbaca di layar.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, setelanLengkap } from './data/index.js';
import { rapikanIklan, periksaIklan, STATUS, AKHIR } from './iklan.js';
import { wajibMasuk } from './auth.js';
import { tokenBaru } from './rahasia.js';
import { dariInput } from './waktu.js';

const segarkan = () => { revalidatePath('/'); revalidatePath('/iklan'); };

/** Jalankan fn; galat apa pun menjadi { ok:false, galat } alih-alih crash. */
async function aman(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error('[aksi]', e);
    return { ok: false, galat: e?.message || String(e) };
  }
}

const denganGalat = (jalur, pesan) => jalur + (jalur.includes('?') ? '&' : '?') + 'galat=' + encodeURIComponent(String(pesan).slice(0, 500));

/** Simpan dari formulir iklan (baru atau ubah). */
export async function simpanIklanForm(formData) {
  await wajibMasuk();
  const ambil = (k) => String(formData.get(k) || '').trim();
  const id = ambil('id');
  const hasil = await aman(async () => {
    const setelan = await setelanLengkap();
    const lama = id ? await db().ambilIklan(id) : null;
    const tipeFoto = ambil('fotoTipe') || 'unggahan';
    let berkas = [];
    try { berkas = JSON.parse(ambil('fotoBerkas') || '[]'); } catch { berkas = []; }
    const foto = tipeFoto === 'folder'
      ? { tipe: 'folder', folder: ambil('fotoFolder') }
      : tipeFoto === 'url' ? { tipe: 'url', url: ambil('fotoUrl') } : { tipe: 'unggahan', berkas };

    const iklan = rapikanIklan({
      ...(lama || {}),
      id: id || undefined,
      kunci: ambil('kunci'),
      jenis: ambil('jenis') === 'kendaraan' ? 'kendaraan' : 'barang',
      judul: ambil('judul'),
      harga: ambil('harga'),
      kategori: ambil('kategori'),
      kondisi: ambil('kondisi'),
      lokasi: ambil('lokasi'),
      deskripsi: ambil('deskripsi'),
      foto,
      kendaraan: {
        jenis: ambil('kJenis'), tahun: ambil('kTahun'), merek: ambil('kMerek'), model: ambil('kModel'),
        jarakTempuh: ambil('kJarak'), transmisi: ambil('kTransmisi'), bahanBakar: ambil('kBahanBakar'),
        warna: ambil('kWarna'), tipeBodi: ambil('kTipeBodi')
      },
      cara: ambil('cara'),
      jadwal: dariInput(ambil('jadwal'), setelan.zona),
      status: ambil('status') || (lama ? lama.status : STATUS.DRAF)
    });

    // Status Terjadwal hanya boleh bila datanya lengkap; selain itu simpan sebagai Draf + beri tahu.
    let catatan = '';
    if (iklan.status === STATUS.TERJADWAL) {
      const cek = periksaIklan(iklan);
      if (!cek.siap || !iklan.jadwal) {
        iklan.status = STATUS.DRAF;
        catatan = 'Disimpan sebagai Draf karena belum bisa dijadwalkan: ' + (cek.galat.join(' ') || 'tanggal & jam belum diisi.');
      }
    }
    const tersimpan = await db().simpanIklan(iklan);
    return { ok: true, id: tersimpan.id, catatan };
  });

  // redirect() harus di luar try/catch (ia bekerja dengan melempar).
  if (!hasil.ok) redirect(denganGalat(id ? '/iklan/' + id : '/iklan/baru', hasil.galat));
  segarkan();
  redirect('/iklan/' + hasil.id + (hasil.catatan ? '?' + 'galat=' + encodeURIComponent(hasil.catatan) : '?simpan=1'));
}

export async function ubahStatusIklan(id, status) {
  await wajibMasuk();
  return aman(async () => {
    const iklan = await db().ambilIklan(id);
    if (!iklan) return { ok: false, galat: 'Iklan tidak ditemukan.' };
    if (status === STATUS.TERJADWAL) {
      const cek = periksaIklan(iklan);
      if (!cek.siap) return { ok: false, galat: cek.galat.join(' ') };
      if (!iklan.jadwal) return { ok: false, galat: 'Tanggal & jam belum diisi.' };
    }
    await db().simpanIklan({
      ...iklan, status, token: null, klaim: null, langkah: '',
      keterangan: status === STATUS.TERJADWAL ? 'Menunggu giliran ekstensi Chrome.' : iklan.keterangan,
      diubah: new Date().toISOString()
    });
    await db().tambahLog({ iklanId: id, jenis: status, pesan: 'Status diubah dari dasbor.' });
    segarkan();
    return { ok: true };
  });
}

export async function hapusIklan(id) {
  await wajibMasuk();
  return aman(async () => {
    await db().hapusIklan(id);
    segarkan();
    return { ok: true };
  });
}

export async function duplikatIklan(id, jadwalBaru) {
  await wajibMasuk();
  return aman(async () => {
    const iklan = await db().ambilIklan(id);
    if (!iklan) return { ok: false, galat: 'Iklan tidak ditemukan.' };
    const salinan = rapikanIklan({
      ...iklan, id: undefined, kunci: '', status: STATUS.DRAF, keterangan: '', hasilUrl: '', token: null, klaim: null,
      jadwal: jadwalBaru || new Date(Date.now() + 86400000).toISOString()
    });
    const baru = await db().simpanIklan(salinan);
    segarkan();
    return { ok: true, id: baru.id };
  });
}

/** Tulis hasil impor (daftar iklan yang sudah disusun di pratinjau). */
export async function simpanImpor(daftar) {
  await wajibMasuk();
  return aman(async () => {
    if (!daftar?.length) return { ok: false, galat: 'Tidak ada baris untuk diimpor.' };
    const tersimpan = await db().simpanBanyak(daftar.map((x) => rapikanIklan(x)));
    await db().tambahLog({ jenis: 'impor', pesan: tersimpan.length + ' iklan diimpor.' });
    segarkan();
    revalidatePath('/impor');
    return { ok: true, jumlah: tersimpan.length };
  });
}

export async function simpanSetelanForm(formData) {
  await wajibMasuk();
  const ambil = (k) => String(formData.get(k) || '').trim();
  const angkaAman = (k, min, maks, bawaan) => {
    const n = Number(ambil(k));
    return isFinite(n) && n >= min && n <= maks ? Math.round(n) : bawaan;
  };
  const hasil = await aman(async () => {
    const akhir = AKHIR.includes(ambil('akhir')) ? ambil('akhir') : 'uji';
    await db().simpanSetelan({
      akhir,
      modeUji: akhir === 'uji',   // dibiarkan selaras agar ekstensi/dasbor versi lama tetap benar
      jedaMenit: angkaAman('jedaMenit', 3, 240, 10),
      batasHarian: angkaAman('batasHarian', 1, 50, 10),
      zona: ambil('zona') || 'Asia/Jakarta',
      sheetUrl: ambil('sheetUrl')
    });
    return { ok: true };
  });
  revalidatePath('/pengaturan');
  redirect(hasil.ok ? '/pengaturan?simpan=1' : denganGalat('/pengaturan', hasil.galat));
}

export async function buatKunciEkstensi() {
  await wajibMasuk();
  const hasil = await aman(async () => {
    await db().simpanSetelan({ kunciEkstensi: tokenBaru() });
    return { ok: true };
  });
  revalidatePath('/pengaturan');
  redirect(hasil.ok ? '/pengaturan?kunci=1' : denganGalat('/pengaturan', hasil.galat));
}
