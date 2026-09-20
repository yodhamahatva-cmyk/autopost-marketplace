/**
 * Tiruan klien Supabase untuk pengujian, yang PATUH pada skema.sql:
 * kolom yang tidak ada, tabel yang belum dibuat, atau nilai yang salah tipe
 * ditolak dengan pesan galat seperti PostgREST sungguhan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** { namaTabel: { kolom: tipe } } dan daftar bucket, dibaca dari skema.sql. */
export function bacaSkema(teks = fs.readFileSync(path.join(AKAR, 'skema.sql'), 'utf8')) {
  const tabel = {};
  const re = /create table if not exists (\w+)\s*\(([\s\S]*?)\n\);/gi;
  let m;
  while ((m = re.exec(teks))) {
    const kolom = {};
    m[2].split('\n').forEach((baris) => {
      const b = baris.replace(/--.*$/, '').trim();
      const k = b.match(/^(\w+)\s+(\w+)/);
      if (k && !/^(primary|unique|constraint|foreign)$/i.test(k[1])) kolom[k[1]] = k[2].toLowerCase();
    });
    tabel[m[1]] = kolom;
  }
  const bucket = [...teks.matchAll(/insert into storage\.buckets[\s\S]*?values\s*\('([^']+)'/gi)].map((x) => x[1]);
  return { tabel, bucket };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cekNilai(t, kolom, tipe, nilai) {
  if (nilai === null || nilai === undefined) return null;
  if (tipe === 'uuid' && !UUID.test(String(nilai))) return `invalid input syntax for type uuid: "${nilai}"`;
  if (tipe === 'bigint' && !(Number.isInteger(nilai))) return `invalid input syntax for type bigint: "${nilai}"`;
  if (tipe === 'timestamptz' && isNaN(new Date(nilai).getTime())) return `invalid input syntax for type timestamp with time zone: "${nilai}"`;
  if (tipe === 'text' && typeof nilai !== 'string') return `column "${kolom}" of relation "${t}" is of type text but value is ${typeof nilai}`;
  return null;
}

export function buatSupabaseTiruan({ skema = bacaSkema(), tabelHilang = [] } = {}) {
  const data = {};
  Object.keys(skema.tabel).forEach((t) => { data[t] = []; });
  const berkas = {};
  const galat = (message) => ({ data: null, error: { message } });
  const klon = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

  function from(t) {
    const q = { op: 'select', baris: null, filter: [], urut: null, batas: null, satu: null, kepala: false, conflict: null, ilike: null, kembalikan: false };
    const tidakAda = !skema.tabel[t] || tabelHilang.includes(t);
    const kolom = skema.tabel[t] || {};

    const pembangun = {
      select(_kol, opsi) { if (q.op !== 'select') q.kembalikan = true; if (opsi?.head) q.kepala = true; return pembangun; },
      insert(b) { q.op = 'insert'; q.baris = Array.isArray(b) ? b : [b]; return pembangun; },
      upsert(b, o) { q.op = 'upsert'; q.baris = Array.isArray(b) ? b : [b]; q.conflict = o?.onConflict || 'id'; return pembangun; },
      delete() { q.op = 'delete'; return pembangun; },
      eq(k, v) { q.filter.push([k, (x) => x[k] === v]); return pembangun; },
      not(k, op, v) { q.filter.push([k, (x) => !(op === 'is' && v === null && (x[k] === null || x[k] === undefined))]); return pembangun; },
      or(s) {
        const bagian = String(s).split(',').map((p) => p.match(/^(\w+)\.ilike\.%(.*)%$/)).filter(Boolean);
        if (!bagian.length) q.salahOr = s;
        bagian.forEach(([, k]) => q.filter.push([k, () => true]));
        q.ilike = bagian.map(([, k, v]) => [k, v.toLowerCase()]);
        return pembangun;
      },
      order(k, o) { q.urut = [k, o?.ascending !== false]; return pembangun; },
      limit(n) { q.batas = n; return pembangun; },
      single() { q.satu = 'single'; return pembangun; },
      maybeSingle() { q.satu = 'maybe'; return pembangun; },
      then(ok, gagal) { return Promise.resolve().then(jalankan).then(ok, gagal); }
    };

    function jalankan() {
      if (tidakAda) return galat(`Could not find the table 'public.${t}' in the schema cache`);
      if (q.salahOr) return galat('failed to parse logic tree (' + q.salahOr + ')');
      for (const [k] of q.filter) if (!kolom[k]) return galat(`column ${t}.${k} does not exist`);
      if (q.urut && !kolom[q.urut[0]]) return galat(`column ${t}.${q.urut[0]} does not exist`);

      if (q.op === 'insert' || q.op === 'upsert') {
        const hasil = [];
        for (const b of q.baris) {
          for (const [k, v] of Object.entries(b)) {
            if (!kolom[k]) return galat(`Could not find the '${k}' column of '${t}' in the schema cache`);
            const salah = cekNilai(t, k, kolom[k], v);
            if (salah) return galat(salah);
          }
          const kunci = q.conflict || Object.keys(kolom)[0];
          const i = data[t].findIndex((x) => x[kunci] === b[kunci]);
          if (q.op === 'insert' && i >= 0) return galat(`duplicate key value violates unique constraint "${t}_pkey"`);
          const baru = { ...(i >= 0 ? data[t][i] : {}), ...klon(b) };
          if (i >= 0) data[t][i] = baru; else data[t].push(baru);
          hasil.push(klon(baru));
        }
        if (!q.kembalikan) return { data: null, error: null };
        return q.satu ? { data: hasil[0], error: null } : { data: hasil, error: null };
      }

      let baris = data[t].filter((x) => q.filter.every(([, f]) => f(x)));
      if (q.ilike) baris = baris.filter((x) => q.ilike.some(([k, v]) => String(x[k] || '').toLowerCase().includes(v)));
      if (q.op === 'delete') {
        data[t] = data[t].filter((x) => !baris.includes(x));
        return { data: null, error: null };
      }
      if (q.urut) {
        const [k, naik] = q.urut;
        baris = [...baris].sort((a, b) => (a[k] === b[k] ? 0 : (a[k] == null) ? 1 : (b[k] == null) ? -1 : (a[k] < b[k] ? -1 : 1) * (naik ? 1 : -1)));
      }
      if (q.batas) baris = baris.slice(0, q.batas);
      if (q.kepala) return { data: null, count: baris.length, error: null };
      if (q.satu === 'single') return baris.length === 1 ? { data: klon(baris[0]), error: null } : galat('JSON object requested, multiple (or no) rows returned');
      if (q.satu === 'maybe') return { data: baris[0] ? klon(baris[0]) : null, error: null };
      return { data: klon(baris), error: null };
    }
    return pembangun;
  }

  const storage = {
    from(ember) {
      const ada = skema.bucket.includes(ember);
      const tolak = () => ({ data: null, error: { message: 'Bucket not found' } });
      return {
        async upload(jalur, buf) { if (!ada) return tolak(); berkas[ember + '/' + jalur] = Buffer.from(buf); return { data: { path: jalur }, error: null }; },
        async list(awalan) {
          if (!ada) return tolak();
          const pref = ember + '/' + awalan + '/';
          return { data: Object.keys(berkas).filter((k) => k.startsWith(pref)).map((k) => ({ name: k.slice(pref.length) })), error: null };
        },
        async download(jalur) {
          if (!ada) return tolak();
          const b = berkas[ember + '/' + jalur];
          return b ? { data: { arrayBuffer: async () => b }, error: null } : { data: null, error: { message: 'Object not found' } };
        },
        async remove(jalur) { if (!ada) return tolak(); jalur.forEach((j) => delete berkas[ember + '/' + j]); return { data: [], error: null }; }
      };
    },
    async getBucket(id) {
      return skema.bucket.includes(id) ? { data: { id }, error: null } : { data: null, error: { message: 'Bucket not found' } };
    }
  };

  return { from, storage, _data: data, _berkas: berkas };
}
