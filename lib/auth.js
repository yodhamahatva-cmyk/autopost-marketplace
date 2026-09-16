/** Gerbang sandi sederhana: satu sandi pemilik, sesi disimpan di cookie bertanda tangan. */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { samaAman, tandaTangan } from './rahasia.js';

const NAMA_COOKIE = 'ap_sesi';
const UMUR_HARI = 30;

const rahasia = () => process.env.SESI_RAHASIA || process.env.SANDI_DASBOR || 'autopost-tanpa-sandi';
const tanda = (nilai) => tandaTangan(nilai, rahasia());

export function sandiDiatur() {
  return !!process.env.SANDI_DASBOR;
}

export async function sudahMasuk() {
  if (!sandiDiatur()) return true; // pengembangan lokal tanpa sandi
  const c = (await cookies()).get(NAMA_COOKIE);
  if (!c) return false;
  const [nilai, ttd] = String(c.value).split('.');
  return !!nilai && !!ttd && samaAman(ttd, tanda(nilai));
}

export async function wajibMasuk() {
  if (!(await sudahMasuk())) redirect('/masuk');
}

export async function masuk(sandi) {
  if (!sandiDiatur()) return { ok: true };
  if (!samaAman(String(sandi || ''), process.env.SANDI_DASBOR)) return { ok: false, galat: 'Sandi salah.' };
  const nilai = Date.now().toString(36);
  (await cookies()).set(NAMA_COOKIE, nilai + '.' + tanda(nilai), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: UMUR_HARI * 86400
  });
  return { ok: true };
}

export async function keluar() {
  (await cookies()).delete(NAMA_COOKIE);
}
