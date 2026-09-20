import { headers } from 'next/headers';
import { wajibMasuk, sandiDiatur } from '../../lib/auth.js';
import { db, setelanLengkap } from '../../lib/data/index.js';
import { simpanSetelanForm, buatKunciEkstensi } from '../../lib/aksi.js';
import { hitunganHariIni } from '../../lib/ekstensi.js';
import { relatif } from '../../lib/waktu.js';
import Salin from '../../components/Salin.jsx';

export const dynamic = 'force-dynamic';

export default async function Pengaturan({ searchParams }) {
  await wajibMasuk();
  const sp = await searchParams;
  const setelan = await setelanLengkap();
  const h = await headers();
  const asal = (h.get('x-forwarded-proto') || 'https') + '://' + (h.get('x-forwarded-host') || h.get('host') || 'localhost:3110');
  const urlApi = asal + '/api/ekstensi';

  return (
    <>
      <h1>Pengaturan</h1>
      {sp?.simpan && <div className="pesan ok">Pengaturan tersimpan.</div>}
      {sp?.kunci && <div className="pesan ok">Kunci baru dibuat. Tempel di ekstensi Chrome.</div>}
      {sp?.galat && <div className="pesan galat">Gagal menyimpan: {sp.galat}</div>}
      <p className="kecil">Penyimpanan: <b>{db().jenis === 'supabase' ? 'Supabase' : 'berkas lokal'}</b>{sandiDiatur() ? '' : ' · ⚠️ SANDI_DASBOR belum diatur'}</p>

      <div className="kartu">
        <h3>Ekstensi Chrome</h3>
        <p className="kecil" style={{ marginTop: 0 }}>
          Status: <b>{setelan.ekstensiTerakhir
            ? (Date.now() - new Date(setelan.ekstensiTerakhir).getTime() < 600000 ? '✅ aktif' : '💤 tidak aktif')
            : '🧩 belum pernah terhubung'}</b>
          {setelan.ekstensiTerakhir && <> · terakhir menghubungi {relatif(setelan.ekstensiTerakhir)}</>}
          {' '}· {hitunganHariIni(setelan)} terbit hari ini.
        </p>
        <label>URL untuk ekstensi</label>
        <Salin nilai={urlApi} />
        <label style={{ marginTop: 12 }}>Kunci rahasia</label>
        {setelan.kunciEkstensi
          ? <Salin nilai={setelan.kunciEkstensi} rahasia />
          : <div className="bantuan">Belum ada kunci. Buat dulu, lalu tempel di ekstensi.</div>}
        <form action={buatKunciEkstensi} style={{ marginTop: 10 }}>
          <button className="btn" type="submit">{setelan.kunciEkstensi ? 'Buat kunci baru' : 'Buat kunci'}</button>
        </form>
        <div className="bantuan" style={{ marginTop: 10 }}>
          Pasang folder <code>ekstensi-chrome</code> lewat <code>chrome://extensions</code> → Mode pengembang → Muat yang belum dibuka,
          lalu klik ikon ekstensi dan tempel URL + kunci di atas. Untuk foto dari folder komputer, nyalakan
          “Izinkan akses ke URL file” pada halaman detail ekstensi.
        </div>
      </div>

      <form action={simpanSetelanForm}>
        <div className="grid k2">
          <div className="kartu">
            <h3>Cara posting</h3>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400 }}>
              <input type="checkbox" name="modeUji" defaultChecked={setelan.modeUji} style={{ width: 'auto', marginTop: 3 }} />
              <span><b>Mode uji</b> — ekstensi mengisi formulir sampai halaman terakhir tetapi <b>tidak</b> menekan Terbitkan.
                Matikan setelah yakin isiannya benar.</span>
            </label>
            <div className="grid k2" style={{ gap: '0 12px' }}>
              <div>
                <label htmlFor="jedaMenit">Jeda antar posting (menit)</label>
                <input type="number" id="jedaMenit" name="jedaMenit" min="3" max="240" defaultValue={setelan.jedaMenit} />
              </div>
              <div>
                <label htmlFor="batasHarian">Maksimal posting per hari</label>
                <input type="number" id="batasHarian" name="batasHarian" min="1" max="50" defaultValue={setelan.batasHarian} />
              </div>
            </div>
            <div className="bantuan">Posting beruntun mudah ditandai spam oleh Facebook. Bawaan aman: 10 menit, 10 per hari.</div>
          </div>

          <div className="kartu">
            <h3>Umum</h3>
            <label htmlFor="zona">Zona waktu</label>
            <select id="zona" name="zona" defaultValue={setelan.zona}>
              {['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <label htmlFor="sheetUrl">Link Google Sheet (diingat untuk impor)</label>
            <input type="url" id="sheetUrl" name="sheetUrl" defaultValue={setelan.sheetUrl} placeholder="https://docs.google.com/spreadsheets/d/…" />
            <div className="baris-aksi" style={{ marginTop: 12 }}>
              <button className="btn utama" type="submit">Simpan</button>
            </div>
          </div>
        </div>
      </form>

      <div className="kartu">
        <h3>Catatan risiko</h3>
        <p className="kecil" style={{ margin: 0 }}>
          Facebook tidak menyediakan API Marketplace. Ekstensi bekerja seperti Anda sendiri di Chrome yang sudah login —
          tanpa menyimpan sandi dan tanpa menyamar — tetapi otomatisasi tetap tidak didukung resmi oleh Meta, sehingga akun bisa dibatasi.
          Gunakan jeda dan batas harian yang wajar, dan periksa hasilnya secara berkala.
        </p>
      </div>
    </>
  );
}
