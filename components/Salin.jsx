'use client';
import { useState } from 'react';

export default function Salin({ nilai, rahasia }) {
  const [tampil, setTampil] = useState(!rahasia);
  const [status, setStatus] = useState('');

  async function salin() {
    try {
      await navigator.clipboard.writeText(nilai);
      setStatus('Tersalin ✓');
    } catch {
      setStatus('Tekan Ctrl+C');
    }
    setTimeout(() => setStatus(''), 2000);
  }

  return (
    <div className="baris-aksi" style={{ gap: 6 }}>
      <input type="text" readOnly value={tampil ? nilai : '•'.repeat(Math.min(40, String(nilai).length))}
        onFocus={(e) => e.target.select()} style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12.5 }} />
      {rahasia && <button className="btn kecil" type="button" onClick={() => setTampil((t) => !t)}>{tampil ? 'Sembunyikan' : 'Tampilkan'}</button>}
      <button className="btn kecil" type="button" onClick={salin}>{status || 'Salin'}</button>
    </div>
  );
}
