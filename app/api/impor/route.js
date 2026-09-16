/**
 * Baca tabel sumber untuk halaman Impor:
 *  - { url }            → tarik dari Google Sheet (link publikasi/berbagi)
 *  - berkas (FormData)  → unggahan CSV/XLSX
 * Mengembalikan ringkasan kolom + tebakan pemetaan + seluruh baris (untuk pratinjau di browser).
 */
import { sudahMasuk } from '../../../lib/auth.js';
import { ambilDariUrl, uraiBerkas, ringkasTabel } from '../../../lib/sheet.js';
import { tebakPemetaan } from '../../../lib/impor.js';
import { db } from '../../../lib/data/index.js';

export const dynamic = 'force-dynamic';
const MAKS_BARIS = 2000;

export async function POST(req) {
  if (!(await sudahMasuk())) return Response.json({ ok: false, galat: 'Belum masuk.' }, { status: 401 });
  try {
    const jenisIsi = req.headers.get('content-type') || '';
    let tabel;
    let nama;
    if (jenisIsi.includes('application/json')) {
      const { url } = await req.json();
      tabel = await ambilDariUrl(url);
      nama = 'Google Sheet';
      await db().simpanSetelan({ sheetUrl: String(url || '') });
    } else {
      const form = await req.formData();
      const f = form.get('berkas');
      if (!f || !f.size) throw new Error('Berkas belum dipilih.');
      tabel = uraiBerkas(f.name, Buffer.from(await f.arrayBuffer()));
      nama = f.name;
    }
    if (!tabel.length) throw new Error('Tabel kosong.');
    const r = ringkasTabel(tabel.slice(0, MAKS_BARIS));
    return Response.json({
      ok: true, nama, barisHeader: r.barisHeader, barisAwal: r.barisAwal, jumlahBaris: r.jumlahBaris,
      kolom: r.kolom, baris: r.baris, tebakan: tebakPemetaan(r.kolom),
      kunciTerpakai: await db().kunciTerpakai()
    });
  } catch (e) {
    return Response.json({ ok: false, galat: e.message }, { status: 400 });
  }
}
