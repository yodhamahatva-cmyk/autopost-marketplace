/** Unggah foto iklan dari dasbor. */
import { sudahMasuk } from '../../../lib/auth.js';
import { db } from '../../../lib/data/index.js';

export const dynamic = 'force-dynamic';
const MAKS_MB = 12;

export async function POST(req) {
  if (!(await sudahMasuk())) return Response.json({ ok: false, galat: 'Belum masuk.' }, { status: 401 });
  const form = await req.formData();
  const iklanId = String(form.get('iklanId') || '');
  if (!iklanId) return Response.json({ ok: false, galat: 'Simpan iklan dulu sebelum mengunggah foto.' }, { status: 400 });

  const masuk = form.getAll('foto').filter((f) => typeof f === 'object' && f.size);
  const berkas = [];
  for (const f of masuk) {
    if (!/^image\//.test(f.type || '')) return Response.json({ ok: false, galat: `"${f.name}" bukan gambar.` }, { status: 400 });
    if (f.size > MAKS_MB * 1048576) return Response.json({ ok: false, galat: `"${f.name}" lebih dari ${MAKS_MB} MB.` }, { status: 400 });
    berkas.push({ nama: f.name, mime: f.type, data: Buffer.from(await f.arrayBuffer()) });
  }
  if (!berkas.length) return Response.json({ ok: false, galat: 'Tidak ada foto yang diunggah.' }, { status: 400 });

  const hasil = await db().simpanFoto(iklanId, berkas);
  const iklan = await db().ambilIklan(iklanId);
  if (iklan && iklan.foto?.tipe === 'unggahan') {
    await db().simpanIklan({ ...iklan, foto: { tipe: 'unggahan', berkas: [...(iklan.foto.berkas || []), ...hasil] } });
  }
  return Response.json({ ok: true, berkas: hasil });
}
