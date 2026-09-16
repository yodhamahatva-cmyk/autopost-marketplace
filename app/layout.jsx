import './globals.css';
import { sudahMasuk, sandiDiatur, keluar } from '../lib/auth.js';

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
        <main>{children}</main>
      </body>
    </html>
  );
}
