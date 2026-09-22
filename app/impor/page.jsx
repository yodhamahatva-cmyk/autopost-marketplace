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
          isian iklan tidak tertukar. Satu berkas XLSX sudah memuat <b>tiga tab</b>: <b>Stok</b> (diisi), <b>Pilihan Nilai</b> (acuan
          dropdown), dan <b>Petunjuk</b>. Unduh → Google Sheet baru → <b>File → Impor → Unggah</b> → pilih <i>Ganti spreadsheet</i>,
          lalu ganti barisnya dengan stok Anda.
        </p>
        <div className="baris-aksi">
          <a className="btn utama" href="/templat-stok-kendaraan.xlsx" download>⬇ Templat lengkap (XLSX, 3 tab)</a>
          <a className="btn" href="/templat-stok-kendaraan.csv" download>CSV: tab Stok</a>
          <a className="btn" href="/templat-pilihan-nilai.csv" download>CSV: petunjuk kolom</a>
        </div>
        <div className="bantuan" style={{ marginTop: 8 }}>
          Berkas CSV hanya bisa memuat satu tab — itulah kenapa versi CSV-nya terpisah. Pakai XLSX bila ingin semuanya jadi satu.
          Ingin dropdown seperti di Facebook? Di Google Sheet: blok kolomnya → <b>Data → Validasi data</b> → <i>Kriteria: Dari rentang</i> →
          tunjuk kolom yang sesuai di tab <b>Pilihan Nilai</b>.
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
