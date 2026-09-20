'use client';

/** Tampil bila sebuah halaman gagal dimuat. Pesan konfigurasi (bila ada) sudah tampil di atasnya dari layout. */
export default function Galat({ error, reset }) {
  return (
    <div className="kartu">
      <h1>Halaman gagal dimuat</h1>
      <p className="kecil">
        Biasanya karena pengaturan server belum lengkap — lihat kotak merah <b>“Perlu diperbaiki”</b> di atas bila ada.
        Penyebab yang paling sering: variabel Supabase belum diisi di Vercel, atau <code>skema.sql</code> belum dijalankan di Supabase.
      </p>
      {error?.digest && <p className="kecil">Kode galat: <code>{error.digest}</code> (cari kode ini di Vercel → Logs untuk rinciannya).</p>}
      <div className="baris-aksi">
        <button className="btn utama" onClick={() => reset()}>Coba lagi</button>
        <a className="btn" href="/">Ke dasbor</a>
      </div>
    </div>
  );
}
