'use server';
/** Aksi server yang dipanggil dari halaman & komponen (simpan iklan, ubah status, impor, setelan). */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, setelanLengkap } from './data/index.js';
import { rapikanIklan, periksaIklan, STATUS } from './iklan.js';
import { susunImpor } from './impor.js';
import { wajibMasuk } from './auth.js';
import { tokenBaru } from './rahasia.js';
import { dariInput } from './waktu.js';

const segarkan = () => { revalidatePath('/'); revalidatePath('/iklan'); };

/** Simpan dari formulir iklan (baru atau ubah). */
export async function simpanIklanForm(formData) {
  await wajibMasuk();
  const ambil = (k) => String(formData.get(k) || '').trim();
  const setelan = await setelanLengkap();
  const id = ambil('id');
  const lama = id ? await db().ambilIklan(id) : null;
  const tipeFoto = ambil('fotoTipe') || 'unggahan';
  const foto = tipeFoto === 'folder'
    ? { tipe: 'folder', folder: ambil('fotoFolder') }
    : tipeFoto === 'url'
      ? { tipe: 'url', url: ambil('fotoUrl') }
      : { tipe: 'unggahan', berkas: JSON.parse(ambil('fotoBerkas') || '[]') };

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
  const tersimpan = await db().simpanIklan(iklan);
  segarkan();
  redirect('/iklan/' + tersimpan.id + '?simpan=1');
}

export async function ubahStatusIklan(id, status) {
  await wajibMasuk();
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
}

export async function hapusIklan(id) {
  await wajibMasuk();
  await db().hapusIklan(id);
  segarkan();
  return { ok: true };
}

export async function duplikatIklan(id, jadwalBaru) {
  await wajibMasuk();
  const iklan = await db().ambilIklan(id);
  if (!iklan) return { ok: false, galat: 'Iklan tidak ditemukan.' };
  const salinan = rapikanIklan({
    ...iklan, id: undefined, kunci: '', status: STATUS.DRAF, keterangan: '', hasilUrl: '', token: null, klaim: null,
    jadwal: jadwalBaru || new Date(Date.now() + 86400000).toISOString()
  });
  const baru = await db().simpanIklan(salinan);
  segarkan();
  return { ok: true, id: baru.id };
}

/** Tulis hasil impor (daftar iklan yang sudah disusun di pratinjau). */
export async function simpanImpor(daftar) {
  await wajibMasuk();
  if (!daftar?.length) return { ok: false, galat: 'Tidak ada baris untuk diimpor.' };
  const tersimpan = await db().simpanBanyak(daftar.map((x) => rapikanIklan(x)));
  await db().tambahLog({ jenis: 'impor', pesan: tersimpan.length + ' iklan diimpor.' });
  segarkan();
  revalidatePath('/impor');
  return { ok: true, jumlah: tersimpan.length };
}

export async function simpanSetelanForm(formData) {
  await wajibMasuk();
  const ambil = (k) => String(formData.get(k) || '').trim();
  const angkaAman = (k, min, maks, bawaan) => {
    const n = Number(ambil(k));
    return isFinite(n) && n >= min && n <= maks ? Math.round(n) : bawaan;
  };
  await db().simpanSetelan({
    modeUji: formData.get('modeUji') === 'on',
    jedaMenit: angkaAman('jedaMenit', 3, 240, 10),
    batasHarian: angkaAman('batasHarian', 1, 50, 10),
    zona: ambil('zona') || 'Asia/Jakarta',
    sheetUrl: ambil('sheetUrl')
  });
  revalidatePath('/pengaturan');
  return { ok: true };
}

export async function buatKunciEkstensi() {
  await wajibMasuk();
  const kunci = tokenBaru();
  await db().simpanSetelan({ kunciEkstensi: kunci });
  revalidatePath('/pengaturan');
  return { ok: true, kunci };
}
