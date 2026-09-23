'use client';
import { useState } from 'react';
import { susunImpor, terapkanUbahan, TARGET } from '../lib/impor.js';
import { simpanImpor } from '../lib/aksi.js';
import { rupiah } from '../lib/util.js';
import { untukInput, dariInput } from '../lib/waktu.js';

/** Waktu sekarang menurut zona dasbor, siap dipakai input datetime-local. */
const sekarang = (zona) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: zona || 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false
}).format(new Date()).replace(' ', 'T').slice(0, 16);

export default function Impor({ sheetUrl, zona, akun = [] }) {
  const [url, setUrl] = useState(sheetUrl || '');
  const [sumber, setSumber] = useState(null);       // hasil /api/impor
  const [peta, setPeta] = useState({});
  const [opsi, setOpsi] = useState({ barisAwal: 2, mulai: sekarang(zona), jedaMenit: 15, cara: 'otomatis', akun: '', status: 'draf', lewatiDuplikat: true });
  const [ubahan, setUbahan] = useState({});      // suntingan per baris pratinjau
  const [akunMassal, setAkunMassal] = useState('');
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
      setUbahan({});
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

  const dasar = sumber ? susunImpor(sumber.baris, {
    peta, barisAwal: Number(opsi.barisAwal) || 1,
    mulai: new Date(opsi.mulai).toISOString(), jedaMenit: Number(opsi.jedaMenit) || 0, akun: opsi.akun,
    cara: opsi.cara, status: opsi.status, namaSumber: sumber.nama,
    kunciSudahAda: opsi.lewatiDuplikat ? sumber.kunciTerpakai : [],
    lewatiDuplikat: opsi.lewatiDuplikat
  }) : null;

  // Suntingan per baris menimpa setelan massal di langkah 3 (tanpa mengubah sumbernya).
  const baris = dasar ? terapkanUbahan(dasar.hasil, ubahan) : [];
  const hasil = dasar ? { ...dasar, hasil: baris } : null;
  const terpilih = baris.filter((b) => b.ikut);
  const bermasalah = terpilih.filter((b) => b.masalah.length).length;
  const aturBaris = (nomor, patch) => setUbahan((u) => ({ ...u, [nomor]: { ...(u[nomor] || {}), ...patch } }));
  const terapkanKeTerpilih = (patch) => setUbahan((u) => {
    const baru = { ...u };
    terpilih.forEach((b) => { baru[b.baris] = { ...(baru[b.baris] || {}), ...patch }; });
    return baru;
  });

  async function jalankan() {
    setSibuk('impor');
    setPesan(null);
    try {
      const r = await simpanImpor(terpilih.map((h) => h.iklan));
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
              <div>
                <label htmlFor="akunTujuan">Akun Facebook tujuan</label>
                <select id="akunTujuan" value={opsi.akun} onChange={(e) => setOpsi({ ...opsi, akun: e.target.value })}>
                  <option value="">Akun mana saja</option>
                  <option value="*">Semua akun (satu per satu)</option>
                  {akun.map((a) => <option key={a.nama} value={a.nama}>{a.nama}{a.aktif ? ' · aktif' : ''}</option>)}
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
            <div className="bantuan">Zona waktu {zona}. {akun.length ? 'Pilihan akun berlaku untuk semua baris yang diimpor; tiap iklan masih bisa diubah sendiri nanti.' : 'Belum ada akun terdaftar — isi "Nama akun Facebook di Chrome ini" pada popup ekstensi tiap Chrome.'}</div>
          </div>

          <div className="kartu">
            <h3>4. Pratinjau</h3>
            <div className={'pesan ' + (bermasalah ? 'waspada' : 'ok')}>
              {terpilih.length} dari {baris.length} iklan akan diimpor
              {hasil.dilewati.length ? ` · ${hasil.dilewati.length} dilewati (sudah pernah diimpor)` : ''}
              {bermasalah ? ` · ⚠️ ${bermasalah} belum lengkap` : ''}
            </div>

            <div className="baris-aksi" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="kecil">Untuk {terpilih.length} baris terpilih:</span>
              <select value={akunMassal} onChange={(e) => setAkunMassal(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Akun mana saja</option>
                <option value="*">Semua akun (satu per satu)</option>
                {akun.map((a) => <option key={a.nama} value={a.nama}>{a.nama}</option>)}
              </select>
              <button className="btn" onClick={() => terapkanKeTerpilih({ akun: akunMassal })} disabled={!terpilih.length}>
                Terapkan akun ini
              </button>
              <button className="btn" onClick={() => setUbahan({})} disabled={!Object.keys(ubahan).length}>
                Kembalikan seperti semula
              </button>
            </div>

            <div style={{ maxHeight: 460, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <input type="checkbox" style={{ width: 'auto' }}
                        checked={!!baris.length && terpilih.length === baris.length}
                        onChange={(e) => setUbahan((u) => {
                          const baru = { ...u };
                          baris.forEach((b) => { baru[b.baris] = { ...(baru[b.baris] || {}), ikut: e.target.checked }; });
                          return baru;
                        })} />
                    </th>
                    <th>Judul</th><th>Harga</th><th style={{ width: 190 }}>Jadwal tayang</th>
                    <th style={{ width: 180 }}>Akun tujuan</th><th>Rincian</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((h) => (
                    <tr key={h.baris} style={h.ikut ? undefined : { opacity: 0.45 }}>
                      <td><input type="checkbox" style={{ width: 'auto' }} checked={h.ikut}
                        onChange={(e) => aturBaris(h.baris, { ikut: e.target.checked })} /></td>
                      <td><b>{h.iklan.judul || '(tanpa judul)'}</b>
                        <div className="kecil">baris {h.baris}{h.iklan.kunci ? ' · ' + h.iklan.kunci : ''}{h.disunting ? ' · ✏️ disesuaikan' : ''}</div>
                        {!!h.masalah.length && <div className="kecil" style={{ color: 'var(--merah)' }}>⚠️ {h.masalah.join(' ')}</div>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{rupiah(h.iklan.harga)}</td>
                      <td>
                        <input type="datetime-local" value={untukInput(h.iklan.jadwal, zona)}
                          onChange={(e) => aturBaris(h.baris, { jadwal: dariInput(e.target.value, zona) || undefined })} />
                      </td>
                      <td>
                        <select value={h.iklan.akun || ''} onChange={(e) => aturBaris(h.baris, { akun: e.target.value })}>
                          <option value="">Akun mana saja</option>
                          <option value="*">Semua akun</option>
                          {akun.map((a) => <option key={a.nama} value={a.nama}>{a.nama}</option>)}
                          {h.iklan.akun && h.iklan.akun !== '*' && !akun.some((a) => a.nama === h.iklan.akun) &&
                            <option value={h.iklan.akun}>{h.iklan.akun}</option>}
                        </select>
                      </td>
                      <td className="kecil">{[h.iklan.kendaraan?.merek, h.iklan.kendaraan?.model, h.iklan.kendaraan?.tahun,
                        h.iklan.kendaraan?.jarakTempuh ? h.iklan.kendaraan.jarakTempuh + ' km' : '', h.iklan.kendaraan?.warna,
                        h.iklan.foto?.folder || (h.iklan.foto?.url || []).join(', ')].filter(Boolean).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bantuan" style={{ marginTop: 8 }}>
              Centang baris yang ingin diimpor, lalu ubah jadwal atau akun tujuannya sendiri-sendiri — atau pilih beberapa baris
              dan tekan <b>Terapkan akun ini</b>. Isi iklannya (judul, harga, foto, dll.) disunting setelah impor lewat menu <b>Iklan</b>.
            </div>
            <div className="baris-aksi" style={{ marginTop: 12 }}>
              <button className="btn utama" onClick={jalankan} disabled={!terpilih.length || sibuk === 'impor'}>
                {sibuk === 'impor' ? <span className="putar" /> : null} Impor {terpilih.length} iklan
              </button>
              <button className="btn" onClick={() => setSumber(null)}>Batal</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
