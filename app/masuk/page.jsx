import { redirect } from 'next/navigation';
import { masuk, sandiDiatur, sudahMasuk } from '../../lib/auth.js';

export default async function Masuk({ searchParams }) {
  if (await sudahMasuk()) redirect('/');
  const sp = await searchParams;

  async function aksiMasuk(formData) {
    'use server';
    const r = await masuk(formData.get('sandi'));
    redirect(r.ok ? '/' : '/masuk?galat=1');
  }

  return (
    <div style={{ maxWidth: 380, margin: '60px auto' }}>
      <div className="kartu">
        <h1>Masuk</h1>
        <p className="kecil">Dasbor ini berisi data iklan dan kunci ekstensi, jadi dilindungi sandi.</p>
        {sp?.galat && <div className="pesan galat">Sandi salah.</div>}
        {!sandiDiatur() && <div className="pesan waspada">Variabel SANDI_DASBOR belum diatur, jadi dasbor terbuka tanpa sandi.</div>}
        <form action={aksiMasuk}>
          <label htmlFor="sandi">Sandi</label>
          <input type="password" id="sandi" name="sandi" autoFocus autoComplete="current-password" />
          <div className="baris-aksi" style={{ marginTop: 12 }}>
            <button className="btn utama" type="submit">Masuk</button>
          </div>
        </form>
      </div>
    </div>
  );
}
