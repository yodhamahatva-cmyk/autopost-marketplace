/** Titik sambung ekstensi Chrome. Dilindungi kunci rahasia, bukan sesi dasbor. */
import { prosesEkstensi, VERSI } from '../../../lib/ekstensi.js';

export const dynamic = 'force-dynamic';

const KEPALA = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store'
};

const balas = (isi, status = 200) => Response.json(isi, { status, headers: KEPALA });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: KEPALA });
}

export async function GET() {
  return balas({ ok: true, aplikasi: 'AutoPost Iklan', versi: VERSI, pesan: 'Titik sambung ekstensi aktif. Hubungkan lewat ekstensi Chrome.' });
}

export async function POST(req) {
  let isi;
  try {
    isi = await req.json();
  } catch {
    return balas({ ok: false, galat: 'Permintaan tidak valid.' }, 400);
  }
  const hasil = await prosesEkstensi(isi);
  return balas(hasil, hasil.ok ? 200 : (hasil.kode === 'kunci' ? 401 : 200));
}
