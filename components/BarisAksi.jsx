'use client';
import { useState, useTransition } from 'react';
import { ubahStatusIklan, hapusIklan, duplikatIklan } from '../lib/aksi.js';

export default function BarisAksi({ id, status, siap }) {
  const [sibuk, mulai] = useTransition();
  const [galat, setGalat] = useState('');

  const jalankan = (fn) => mulai(async () => {
    const r = await fn();
    setGalat(r && r.ok === false ? r.galat : '');
  });

  return (
    <div className="baris-aksi" style={{ gap: 4 }}>
      {status !== 'terjadwal' && status !== 'diproses' && (
        <button className="btn kecil" disabled={sibuk || !siap} title={siap ? 'Jadwalkan' : 'Lengkapi dulu datanya'}
          onClick={() => jalankan(() => ubahStatusIklan(id, 'terjadwal'))}>Jadwalkan</button>
      )}
      {status === 'terjadwal' && (
        <button className="btn kecil" disabled={sibuk} onClick={() => jalankan(() => ubahStatusIklan(id, 'draf'))}>Tunda</button>
      )}
      <button className="btn kecil" disabled={sibuk} onClick={() => jalankan(() => duplikatIklan(id))}>Gandakan</button>
      <button className="btn kecil bahaya" disabled={sibuk}
        onClick={() => { if (confirm('Hapus iklan ini? Tidak bisa dibatalkan.')) jalankan(() => hapusIklan(id)); }}>Hapus</button>
      {sibuk && <span className="putar" />}
      {galat && <div className="kecil" style={{ color: 'var(--merah)', flexBasis: '100%' }}>{galat}</div>}
    </div>
  );
}
