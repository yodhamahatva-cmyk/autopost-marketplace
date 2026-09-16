import { wajibMasuk } from '../../lib/auth.js';
import { db, setelanLengkap } from '../../lib/data/index.js';
import { LABEL_STATUS, periksaIklan, ringkas } from '../../lib/iklan.js';
import { formatWaktu } from '../../lib/waktu.js';
import { rupiah } from '../../lib/util.js';
import BarisAksi from '../../components/BarisAksi.jsx';

export const dynamic = 'force-dynamic';

export default async function DaftarIklan({ searchParams }) {
  await wajibMasuk();
  const sp = await searchParams;
  const status = sp?.status || '';
  const cari = sp?.q || '';
  const setelan = await setelanLengkap();
  const daftar = await db().daftarIklan({ status, cari, batas: 300 });

  return (
    <>
      <div className="baris-aksi" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Iklan</h1>
          <p className="kecil">{daftar.length} iklan{status ? ' berstatus ' + LABEL_STATUS[status] : ''}{cari ? ` untuk “${cari}”` : ''}.</p>
        </div>
        <a className="btn utama" href="/iklan/baru">+ Iklan baru</a>
      </div>

      <form className="kartu rapat baris-aksi" method="get">
        <input type="search" name="q" defaultValue={cari} placeholder="Cari judul, kunci, merek…" style={{ maxWidth: 280 }} />
        <select name="status" defaultValue={status} style={{ maxWidth: 190 }}>
          <option value="">Semua status</option>
          {Object.entries(LABEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn" type="submit">Terapkan</button>
        {(status || cari) && <a className="btn kecil" href="/iklan">Bersihkan</a>}
      </form>

      <div className="kartu rapat">
        {daftar.length ? (
          <table>
            <thead>
              <tr><th>Iklan</th><th>Harga</th><th>Jadwal</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {daftar.map((x) => {
                const cek = periksaIklan(x);
                return (
                  <tr key={x.id}>
                    <td>
                      <a href={'/iklan/' + x.id}><b>{x.judul || '(tanpa judul)'}</b></a>
                      <div className="kecil">{ringkas(x)}</div>
                      {!cek.siap && <div className="kecil" style={{ color: 'var(--merah)' }}>⚠️ {cek.galat.join(' ')}</div>}
                      {x.keterangan && <div className="kecil">{x.keterangan}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{rupiah(x.harga)}</td>
                    <td style={{ whiteSpace: 'nowrap' }} className="kecil">{x.jadwal ? formatWaktu(x.jadwal, setelan.zona) : '—'}<div>{x.cara === 'manual' ? 'pasang manual' : 'otomatis'}</div></td>
                    <td><span className={'lencana l-' + x.status}>{LABEL_STATUS[x.status]}</span>
                      {x.hasilUrl && <div className="kecil"><a href={x.hasilUrl} target="_blank" rel="noopener">lihat di FB</a></div>}</td>
                    <td><BarisAksi id={x.id} status={x.status} siap={cek.siap} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="kosong">Belum ada iklan. <a href="/impor">Impor dari Google Sheet</a> atau <a href="/iklan/baru">buat manual</a>.</div>
        )}
      </div>
    </>
  );
}
