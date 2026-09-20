import { notFound } from 'next/navigation';
import { wajibMasuk } from '../../../lib/auth.js';
import { db, setelanLengkap } from '../../../lib/data/index.js';
import { LABEL_STATUS, periksaIklan } from '../../../lib/iklan.js';
import { formatWaktu } from '../../../lib/waktu.js';
import FormIklan from '../../../components/FormIklan.jsx';

export const dynamic = 'force-dynamic';

export default async function UbahIklan({ params, searchParams }) {
  await wajibMasuk();
  const { id } = await params;
  const sp = await searchParams;
  const iklan = await db().ambilIklan(id);
  if (!iklan) notFound();
  const setelan = await setelanLengkap();
  const cek = periksaIklan(iklan);
  const log = (await db().daftarLog(200)).filter((l) => l.iklanId === id).slice(0, 8);

  return (
    <>
      <div className="baris-aksi" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>{iklan.judul || '(tanpa judul)'}</h1>
          <p className="kecil">
            <span className={'lencana l-' + iklan.status}>{LABEL_STATUS[iklan.status]}</span>
            {iklan.jadwal && <> · dijadwalkan {formatWaktu(iklan.jadwal, setelan.zona)}</>}
            {iklan.sumber?.nama && <> · dari {iklan.sumber.nama} baris {iklan.sumber.baris}</>}
          </p>
        </div>
        <a className="btn" href="/iklan">← Daftar iklan</a>
      </div>

      {sp?.simpan && <div className="pesan ok">Perubahan tersimpan.</div>}
      {sp?.galat && <div className="pesan galat">{sp.galat}</div>}
      {iklan.keterangan && <div className="pesan info">{iklan.keterangan}</div>}
      {!cek.siap && <div className="pesan waspada">Belum bisa dijadwalkan: {cek.galat.join(' ')}</div>}
      {!!cek.saran.length && <div className="pesan info">Catatan: {cek.saran.join(' ')}</div>}

      <FormIklan iklan={iklan} zona={setelan.zona} />

      {!!log.length && (
        <>
          <h2>Riwayat</h2>
          <div className="kartu rapat">
            <table>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }} className="kecil">{formatWaktu(l.waktu, setelan.zona)}</td>
                    <td><span className={'lencana l-' + (LABEL_STATUS[l.jenis] ? l.jenis : 'draf')}>{LABEL_STATUS[l.jenis] || l.jenis}</span></td>
                    <td className="kecil">{l.pesan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
