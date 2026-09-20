import './globals.css';
import { sudahMasuk, sandiDiatur, keluar } from '../lib/auth.js';
import { periksaKonfigurasi } from '../lib/data/index.js';

export const metadata = {
  title: 'AutoPost Iklan — Marketplace',
  description: 'Jadwalkan dan pasang iklan Facebook Marketplace dari satu dasbor.'
};

const MENU = [
  ['/', 'Dasbor'],
  ['/iklan', 'Iklan'],
  ['/impor', 'Impor'],
  ['/pengaturan', 'Pengaturan']
];

export default async function Layout({ children }) {
  const masuk = await sudahMasuk();
  const masalah = masuk ? await periksaKonfigurasi() : [];
  async function aksiKeluar() {
    'use server';
    await keluar();
  }
  return (
    <html lang="id">
      <body>
        <header className="atas">
          <div className="wadah">
            <span className="merek">📣 AutoPost Iklan</span>
            {masuk && (
              <nav>
                {MENU.map(([href, label]) => (
                  <a key={href} href={href}>{label}</a>
                ))}
              </nav>
            )}
            {masuk && sandiDiatur() && (
              <form action={aksiKeluar}>
                <button className="btn kecil" type="submit">Keluar</button>
              </form>
            )}
          </div>
        </header>
        <main>
          {masalah.map((m) => (
            <div className="pesan galat" key={m}><b>Perlu diperbaiki:</b> {m}</div>
          ))}
          {children}
        </main>
      </body>
    </html>
  );
}
