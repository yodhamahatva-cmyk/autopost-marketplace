/** Tampilkan foto iklan di dasbor (hanya untuk yang sudah masuk). */
import { sudahMasuk } from '../../../../../lib/auth.js';
import { db } from '../../../../../lib/data/index.js';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  if (!(await sudahMasuk())) return new Response('Belum masuk.', { status: 401 });
  const { iklanId, fotoId } = await params;
  try {
    const f = await db().bacaFoto(iklanId, fotoId);
    return new Response(f.data, {
      headers: { 'Content-Type': tebakMime(f.nama), 'Cache-Control': 'private, max-age=3600' }
    });
  } catch (e) {
    return new Response('Foto tidak ditemukan.', { status: 404 });
  }
}

function tebakMime(nama) {
  const ext = String(nama || '').toLowerCase().split('.').pop();
  return { png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' }[ext] || 'image/jpeg';
}
