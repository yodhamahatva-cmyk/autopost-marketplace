import { wajibMasuk } from '../lib/auth.js';
import { db, setelanLengkap } from '../lib/data/index.js';
import { LABEL_STATUS, STATUS, caraAkhir } from '../lib/iklan.js';
import { hitunganHariIni } from '../lib/ekstensi.js';
import { formatWaktu, relatif } from '../lib/waktu.js';
import { rupiah } from '../lib/util.js';

export const dynamic = 'force-dynamic';

export default async function Dasbor() {
  await wajibMasuk();
  const setelan = await setelanLengkap();
  const semua = await db().daftarIklan({ batas: 1000 });
  const log = await db().daftarLog(12);

  const hitung = {};
  Object.keys(LABEL_STATUS).forEach((s) => { hitung[s] = 0; });
  semua.forEach((x) => { hitung[x.status] = (hitung[x.status] || 0) + 1; });

  const kini = Date.now();
  const antre = semua
    .filter((x) => x.status === STATUS.TERJADWAL && x.jadwal)
    .sort((a, b) => String(a.jadwal).localeCompare(String(b.jadwal)));
  const manual = antre.filter((x) => x.cara === 'manual' && new Date(x.jadwal).getTime() <= kini);
  const ekstensiAktif = setelan.ekstensiTerakhir && kini - new Date(setelan.ekstensiTerakhir).getTime() < 10 * 60000;

  return (
    <>
      <h1>Dasbor</h1>
      <p className="kecil">Ringkasan iklan Facebook Marketplace Anda.</p>

      {!setelan.kunciEkstensi && (
        <div className="pesan waspada">
          Ekstensi Chrome belum dihubungkan. Buka <a href="/pengaturan">Pengaturan</a> untuk membuat kunci dan memasang ekstensinya.
        </div>
      )}

      <div className="grid k4">
        {[
          ['Terjadwal', hitung.terjadwal, 'l-terjadwal'],
          ['Terbit', hitung.terbit, 'l-terbit'],
          // Kartu draf hanya muncul bila memang dipakai, supaya barisnya tetap rapi berempat.
          ...(hitung['draf-fb'] ? [['Draf di Facebook', hitung['draf-fb'], 'l-draf-fb']] : []),
          ['Diproses', hitung.diproses, 'l-diproses'],
          ['Perlu dicek', (hitung.gagal || 0) + (hitung.terlewat || 0), 'l-gagal']
        ].map(([label, nilai, kelas]) => (
          <div className="kartu" key={label}>
            <h3>{label}</h3>
            <div className={'angka ' + (kelas === 'l-gagal' && nilai ? 'merah' : '')}>{nilai || 0}</div>
            <span className={'lencana ' + kelas}>{label}</span>
          </div>
        ))}
      </div>

      <div className="grid k2">
        <div className="kartu">
          <h3>Ekstensi Chrome</h3>
          <p style={{ margin: '0 0 6px' }}>
            <b>{ekstensiAktif ? '✅ Aktif' : setelan.ekstensiTerakhir ? '💤 Tidak aktif' : '🧩 Belum pernah terhubung'}</b>
            {setelan.ekstensiTerakhir && <span className="kecil"> · terakhir {relatif(setelan.ekstensiTerakhir)}</span>}
          </p>
          <div className="kecil">
            {{
              uji: '🧪 Mode uji AKTIF — formulir diisi tetapi tidak diterbitkan.',
              draf: '📝 Disimpan sebagai draf di Facebook — Anda yang menerbitkannya sendiri.',
              terbit: '🚀 Iklan akan langsung diterbitkan.'
            }[caraAkhir(setelan)]}<br />
            Jeda {setelan.jedaMenit} menit · maksimal {setelan.batasHarian}/hari · hari ini {hitunganHariIni(setelan)} terbit.
          </div>
        </div>

        <div className="kartu">
          <h3>Perlu dipasang manual</h3>
          {manual.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {manual.slice(0, 5).map((x) => (
                <li key={x.id}><a href={'/iklan/' + x.id}>{x.judul}</a> <span className="kecil">· {rupiah(x.harga)}</span></li>
              ))}
            </ul>
          ) : <div className="kosong">Tidak ada. Iklan bertanda “Pasang manual” muncul di sini saat jadwalnya tiba.</div>}
        </div>
      </div>

      <h2>Antrean berikutnya</h2>
      <div className="kartu rapat">
        {antre.length ? (
          <table>
            <thead><tr><th>Jadwal</th><th>Iklan</th><th>Harga</th><th>Cara</th></tr></thead>
            <tbody>
              {antre.slice(0, 8).map((x) => (
                <tr key={x.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatWaktu(x.jadwal, setelan.zona)}<div className="kecil">{relatif(x.jadwal)}</div></td>
                  <td><a href={'/iklan/' + x.id}>{x.judul || '(tanpa judul)'}</a><div className="kecil">{x.kunci}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{rupiah(x.harga)}</td>
                  <td className="kecil">{x.cara === 'manual' ? 'Pasang manual' : 'Otomatis'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="kosong">Belum ada iklan berstatus Terjadwal. <a href="/impor">Impor dari Google Sheet</a> atau <a href="/iklan/baru">buat iklan baru</a>.</div>}
      </div>

      <h2>Aktivitas terakhir</h2>
      <div className="kartu rapat">
        {log.length ? (
          <table>
            <thead><tr><th>Waktu</th><th>Jenis</th><th>Pesan</th></tr></thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }} className="kecil">{formatWaktu(l.waktu, setelan.zona)}</td>
                  <td><span className={'lencana l-' + (LABEL_STATUS[l.jenis] ? l.jenis : 'draf')}>{LABEL_STATUS[l.jenis] || l.jenis}</span></td>
                  <td className="kecil">{l.pesan}{l.iklanId && <> · <a href={'/iklan/' + l.iklanId}>lihat iklan</a></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="kosong">Belum ada aktivitas.</div>}
      </div>
    </>
  );
}
