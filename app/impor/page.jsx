import { wajibMasuk } from '../../lib/auth.js';
import { setelanLengkap } from '../../lib/data/index.js';
import Impor from '../../components/Impor.jsx';

export const dynamic = 'force-dynamic';

export default async function HalamanImpor() {
  await wajibMasuk();
  const setelan = await setelanLengkap();
  return (
    <>
      <h1>Impor dari Google Sheet</h1>
      <p className="kecil">Tiap baris stok menjadi satu iklan, dengan jadwal berurutan. Pemetaan kolom ditebak dari nama header.</p>

      <div className="kartu">
        <h3>Templat sheet kendaraan</h3>
        <p className="kecil" style={{ marginTop: 0 }}>
          Urutan kolomnya persis mengikuti formulir kendaraan Facebook Marketplace, jadi pemetaannya langsung benar dan
          isian iklan tidak tertukar. Unduh, buka di Google Sheet lewat <b>File → Impor</b>, lalu ganti isinya dengan stok Anda.
        </p>
        <div className="baris-aksi">
          <a className="btn" href="/templat-stok-kendaraan.csv" download>⬇ Templat stok (CSV)</a>
          <a className="btn" href="/templat-pilihan-nilai.csv" download>⬇ Daftar pilihan nilai</a>
        </div>
        <div className="bantuan" style={{ marginTop: 10 }}>
          Kolom yang wajib: Tahun, Merek, Model, Jarak Tempuh, Harga, Warna Eksterior, Deskripsi, foto (folder atau URL),
          ditambah Tipe Bodi untuk mobil. Isi <b>Jenis Kendaraan</b>, <b>Tipe Bodi</b>, <b>Warna Eksterior</b>, <b>Kondisi</b>,
          <b> Bahan Bakar</b>, dan <b>Transmisi</b> sesuai daftar pilihan — nilai di luar daftar ditolak Facebook.
        </div>
      </div>
      <Impor sheetUrl={setelan.sheetUrl} zona={setelan.zona} />
    </>
  );
}
