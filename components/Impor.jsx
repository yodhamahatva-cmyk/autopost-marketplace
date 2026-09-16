'use client';
import { useState } from 'react';
import { susunImpor, TARGET } from '../lib/impor.js';
import { simpanImpor } from '../lib/aksi.js';
import { rupiah } from '../lib/util.js';

const besok = () => {
  const d = new Date(Date.now() + 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 11) + '09:00';
};

export default function Impor({ sheetUrl, zona }) {
  const [url, setUrl] = useState(sheetUrl || '');
  const [sumber, setSumber] = useState(null);       // hasil /api/impor
  const [peta, setPeta] = useState({});
  const [opsi, setOpsi] = useState({ barisAwal: 2, mulai: besok(), jedaMenit: 60, cara: 'otomatis', status: 'draf', lewatiDuplikat: true });
  const [pesan, setPesan] = useState(null);
  const [sibuk, setSibuk] = useState('');

  async function muatSumber(kirim) {
    setSibuk('muat');
    setPesan(null);
    try {
      const res = await fetch('/api/impor', kirim);
      const j = await res.json();
      if (!j.ok) throw new Error(j.galat);
      setSumber(j);
      setPeta(j.tebakan || {});
      setOpsi((o) => ({ ...o, barisAwal: j.barisAwal }));
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e.message });
      setSumber(null);
    } finally {
      setSibuk('');
    }
  }

  const dariUrl = () => muatSumber({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
  const dariBerkas = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const fd = new FormData();
    fd.set('berkas', f);
    muatSumber({ method: 'POST', body: fd });
  };

  const ubahPeta = (k, bagian, nilai) => setPeta((p) => ({ ...p, [k]: { ...(p[k] || {}), [bagian]: nilai } }));

  const contohIsi = (k) => {
    if (!sumber) return '';
    const a = peta[k] || {};
    const isiKolom = (huruf) => (sumber.kolom.find((x) => x.huruf === String(huruf).toUpperCase()) || {}).contoh || '';
    if (a.teks) {
      return /\{[A-Za-z]+\}/.test(a.teks) ? a.teks.replace(/\{([A-Za-z]+)\}/g, (_, h) => isiKolom(h)).replace(/\s+/g, ' ').trim() : a.teks;
    }
    return a.kolom ? isiKolom(a.kolom) : '';
  };

  const hasil = sumber ? susunImpor(sumber.baris, {
    peta, barisAwal: Number(opsi.barisAwal) || 1,
    mulai: new Date(opsi.mulai).toISOString(), jedaMenit: Number(opsi.jedaMenit) || 0,
    cara: opsi.cara, status: opsi.status, namaSumber: sumber.nama,
    kunciSudahAda: opsi.lewatiDuplikat ? sumber.kunciTerpakai : [],
    lewatiDuplikat: opsi.lewatiDuplikat
  }) : null;
  const bermasalah = hasil ? hasil.hasil.filter((h) => h.masalah.length).length : 0;

  async function jalankan() {
    setSibuk('impor');
    setPesan(null);
    try {
      const r = await simpanImpor(hasil.hasil.map((h) => h.iklan));
      if (!r.ok) throw new Error(r.galat);
      setPesan({ jenis: 'ok', teks: `${r.jumlah} iklan diimpor. Buka menu Iklan untuk memeriksanya.` });
      setSumber(null);
    } catch (e) {
      setPesan({ jenis: 'galat', teks: e.message });
    } finally {
      setSibuk('');
    }
  }

  return (
    <>
      {pesan && <div className={'pesan ' + pesan.jenis}>{pesan.teks}</div>}

      <div className="kartu">
        <h3>1. Ambil data</h3>
        <label htmlFor="url">Link Google Sheet</label>
        <input type="url" id="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…" />
        <div className="bantuan">Sheet harus bisa dibaca tanpa login: <b>Bagikan → Siapa saja yang memiliki link</b>, atau <b>File → Bagikan → Publikasikan ke web → CSV</b>.</div>
        <div className="baris-aksi" style={{ marginTop: 10 }}>
          <button className="btn utama" onClick={dariUrl} disabled={!url || sibuk === 'muat'}>
            {sibuk === 'muat' ? <span className="putar" /> : null} Tarik dari Sheet
          </button>
          <span className="kecil">atau</span>
          <label className="btn" style={{ margin: 0 }}>
            Unggah CSV/XLSX
            <input type="file" accept=".csv,.xlsx,.xls" onChange={dariBerkas} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {sumber && (
        <>
          <div className="kartu">
            <h3>2. Pemetaan kolom</h3>
            <div className="kecil" style={{ marginBottom: 8 }}>
              {sumber.nama} · {sumber.jumlahBaris} baris · {sumber.kolom.length} kolom
              {sumber.barisHeader ? ` · header di baris ${sumber.barisHeader}` : ' · tidak ada baris header'}.
              Nilai tetap boleh menggabungkan kolom, mis. <code>{'{C} {D}'}</code> atau <code>{'D:\\Foto\\{A}'}</code>.
            </div>
            <table>
              <thead><tr><th>Isian iklan</th><th style={{ width: 200 }}>Kolom sumber</th><th style={{ width: 170 }}>atau nilai tetap</th><th>Contoh isi</th></tr></thead>
              <tbody>
                {TARGET.map((t) => (
                  <tr key={t.k}>
                    <td><b>{t.label}</b>{t.wajib && <span style={{ color: 'var(--merah)' }}> *</span>}
                      {t.ket && <div className="kecil">{t.ket}</div>}</td>
                    <td>
                      <select value={(peta[t.k] || {}).kolom || ''} onChange={(e) => ubahPeta(t.k, 'kolom', e.target.value)}>
                        <option value="">— kosong —</option>
                        {sumber.kolom.map((k) => <option key={k.huruf} value={k.huruf}>{k.huruf}{k.judul ? ' · ' + k.judul : ''}</option>)}
                      </select>
                    </td>
                    <td><input type="text" value={(peta[t.k] || {}).teks || ''} onChange={(e) => ubahPeta(t.k, 'teks', e.target.value)} placeholder="—" /></td>
                    <td className="kecil">{contohIsi(t.k)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="kartu">
            <h3>3. Jadwal & hasil</h3>
            <div className="grid k4">
              <div>
                <label htmlFor="barisAwal">Baris data mulai</label>
                <input type="number" id="barisAwal" min="1" value={opsi.barisAwal} onChange={(e) => setOpsi({ ...opsi, barisAwal: e.target.value })} />
              </div>
              <div>
                <label htmlFor="mulai">Iklan pertama tayang</label>
                <input type="datetime-local" id="mulai" value={opsi.mulai} onChange={(e) => setOpsi({ ...opsi, mulai: e.target.value })} />
              </div>
              <div>
                <label htmlFor="jeda">Jeda antar iklan (menit)</label>
                <input type="number" id="jeda" min="0" value={opsi.jedaMenit} onChange={(e) => setOpsi({ ...opsi, jedaMenit: e.target.value })} />
              </div>
              <div>
                <label htmlFor="cara">Cara posting</label>
                <select id="cara" value={opsi.cara} onChange={(e) => setOpsi({ ...opsi, cara: e.target.value })}>
                  <option value="otomatis">Otomatis (ekstensi)</option>
                  <option value="manual">Pasang manual</option>
                </select>
              </div>
            </div>
            <div className="baris-aksi" style={{ marginTop: 10 }}>
              <label style={{ margin: 0, fontWeight: 400, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={opsi.status === 'terjadwal'} style={{ width: 'auto' }}
                  onChange={(e) => setOpsi({ ...opsi, status: e.target.checked ? 'terjadwal' : 'draf' })} />
                Langsung berstatus Terjadwal (tanpa centang: Draf)
              </label>
              <label style={{ margin: 0, fontWeight: 400, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={opsi.lewatiDuplikat} style={{ width: 'auto' }}
                  onChange={(e) => setOpsi({ ...opsi, lewatiDuplikat: e.target.checked })} />
                Lewati yang sudah pernah diimpor (Kunci Unik)
              </label>
            </div>
            <div className="bantuan">Zona waktu {zona}.</div>
          </div>

          <div className="kartu">
            <h3>4. Pratinjau</h3>
            <div className={'pesan ' + (bermasalah ? 'waspada' : 'ok')}>
              {hasil.hasil.length} iklan siap diimpor
              {hasil.dilewati.length ? ` · ${hasil.dilewati.length} dilewati (sudah pernah diimpor)` : ''}
              {bermasalah ? ` · ⚠️ ${bermasalah} belum lengkap` : ''}
            </div>
            <table>
              <thead><tr><th>Judul</th><th>Harga</th><th>Jadwal</th><th>Rincian</th></tr></thead>
              <tbody>
                {hasil.hasil.slice(0, 6).map((h) => (
                  <tr key={h.baris}>
                    <td><b>{h.iklan.judul || '(tanpa judul)'}</b><div className="kecil">baris {h.baris}{h.iklan.kunci ? ' · ' + h.iklan.kunci : ''}</div>
                      {!!h.masalah.length && <div className="kecil" style={{ color: 'var(--merah)' }}>⚠️ {h.masalah.join(' ')}</div>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{rupiah(h.iklan.harga)}</td>
                    <td className="kecil" style={{ whiteSpace: 'nowrap' }}>{new Date(h.iklan.jadwal).toLocaleString('id-ID', { timeZone: zona, dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="kecil">{[h.iklan.kendaraan?.merek, h.iklan.kendaraan?.model, h.iklan.kendaraan?.tahun,
                      h.iklan.kendaraan?.jarakTempuh ? h.iklan.kendaraan.jarakTempuh + ' km' : '', h.iklan.kendaraan?.warna,
                      h.iklan.foto?.folder || (h.iklan.foto?.url || []).join(', ')].filter(Boolean).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasil.hasil.length > 6 && <div className="kecil">… dan {hasil.hasil.length - 6} baris lainnya.</div>}
            <div className="baris-aksi" style={{ marginTop: 12 }}>
              <button className="btn utama" onClick={jalankan} disabled={!hasil.hasil.length || sibuk === 'impor'}>
                {sibuk === 'impor' ? <span className="putar" /> : null} Impor {hasil.hasil.length} iklan
              </button>
              <button className="btn" onClick={() => setSumber(null)}>Batal</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
