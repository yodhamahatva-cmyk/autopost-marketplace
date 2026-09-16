'use client';
import { useState } from 'react';
import { simpanIklanForm } from '../lib/aksi.js';
import { KONDISI, JENIS_KENDARAAN, TRANSMISI, BAHAN_BAKAR, TIPE_BODI, WARNA, MAKS_FOTO } from '../lib/iklan.js';

const untukInputLokal = (iso, zona) => {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('sv-SE', {
    timeZone: zona || 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(iso));
  return p.replace(' ', 'T').slice(0, 16);
};

export default function FormIklan({ iklan, zona }) {
  const [jenis, setJenis] = useState(iklan.jenis);
  const [fotoTipe, setFotoTipe] = useState(iklan.foto?.tipe || 'unggahan');
  const [berkas, setBerkas] = useState(iklan.foto?.berkas || []);
  const [unggah, setUnggah] = useState('');
  const k = iklan.kendaraan || {};
  const maks = MAKS_FOTO[jenis];

  async function pilihFoto(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    if (berkas.length + files.length > maks) return setUnggah(`Maksimal ${maks} foto untuk iklan ${jenis}.`);
    setUnggah('Mengunggah ' + files.length + ' foto…');
    const fd = new FormData();
    fd.set('iklanId', iklan.id || '');
    files.forEach((f) => fd.append('foto', f));
    try {
      const res = await fetch('/api/unggah', { method: 'POST', body: fd });
      const j = await res.json();
      if (!j.ok) throw new Error(j.galat);
      setBerkas((b) => [...b, ...j.berkas]);
      setUnggah('');
    } catch (err) {
      setUnggah('Gagal mengunggah: ' + err.message);
    }
  }

  return (
    <form action={simpanIklanForm}>
      <input type="hidden" name="id" defaultValue={iklan.id || ''} />
      <input type="hidden" name="fotoTipe" value={fotoTipe} />
      <input type="hidden" name="fotoBerkas" value={JSON.stringify(berkas)} />

      <div className="grid k2">
        <div className="kartu">
          <h3>Data iklan</h3>
          <div className="grid k2" style={{ gap: '0 12px' }}>
            <div>
              <label htmlFor="jenis">Jenis iklan</label>
              <select id="jenis" name="jenis" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                <option value="barang">Barang</option>
                <option value="kendaraan">Kendaraan (mobil/motor)</option>
              </select>
            </div>
            <div>
              <label htmlFor="kunci">Kunci unik</label>
              <input type="text" id="kunci" name="kunci" defaultValue={iklan.kunci} placeholder="mis. B1590DYA" />
            </div>
          </div>

          {jenis === 'barang' && (
            <>
              <label htmlFor="judul">Judul</label>
              <input type="text" id="judul" name="judul" defaultValue={iklan.judul} required />
            </>
          )}
          <div className="grid k2" style={{ gap: '0 12px' }}>
            <div>
              <label htmlFor="harga">Harga</label>
              <input type="text" id="harga" name="harga" defaultValue={iklan.harga ?? ''} inputMode="numeric" placeholder="156400000" />
            </div>
            <div>
              <label htmlFor="lokasi">Lokasi</label>
              <input type="text" id="lokasi" name="lokasi" defaultValue={iklan.lokasi} placeholder="Jakarta Pusat" />
            </div>
          </div>
          <div className="grid k2" style={{ gap: '0 12px' }}>
            <div>
              <label htmlFor="kategori">Kategori</label>
              <input type="text" id="kategori" name="kategori" defaultValue={iklan.kategori} placeholder={jenis === 'kendaraan' ? 'Kendaraan' : 'mis. Perabotan'} />
            </div>
            <div>
              <label htmlFor="kondisi">Kondisi</label>
              <select id="kondisi" name="kondisi" defaultValue={iklan.kondisi}>
                <option value="">—</option>
                {KONDISI.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <label htmlFor="deskripsi">Deskripsi</label>
          <textarea id="deskripsi" name="deskripsi" defaultValue={iklan.deskripsi} rows={7} />
        </div>

        <div>
          {jenis === 'kendaraan' && (
            <div className="kartu">
              <h3>Data kendaraan (wajib di Facebook)</h3>
              <div className="grid k2" style={{ gap: '0 12px' }}>
                <div>
                  <label htmlFor="kJenis">Jenis kendaraan</label>
                  <select id="kJenis" name="kJenis" defaultValue={k.jenis || 'Mobil/Truk'}>
                    {JENIS_KENDARAAN.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="kTahun">Tahun</label>
                  <input type="text" id="kTahun" name="kTahun" defaultValue={k.tahun || ''} inputMode="numeric" placeholder="2025" />
                </div>
                <div>
                  <label htmlFor="kMerek">Merek</label>
                  <input type="text" id="kMerek" name="kMerek" defaultValue={k.merek || ''} placeholder="Daihatsu" />
                </div>
                <div>
                  <label htmlFor="kModel">Model</label>
                  <input type="text" id="kModel" name="kModel" defaultValue={k.model || ''} placeholder="Ayla 1.0 X" />
                </div>
                <div>
                  <label htmlFor="kJarak">Jarak tempuh (km)</label>
                  <input type="text" id="kJarak" name="kJarak" defaultValue={k.jarakTempuh ?? ''} inputMode="numeric" placeholder="15770" />
                </div>
                <div>
                  <label htmlFor="kTipeBodi">Tipe bodi</label>
                  <select id="kTipeBodi" name="kTipeBodi" defaultValue={k.tipeBodi || ''}>
                    <option value="">—</option>
                    {TIPE_BODI.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="kWarna">Warna</label>
                  <select id="kWarna" name="kWarna" defaultValue={k.warna || ''}>
                    <option value="">—</option>
                    {WARNA.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="kTransmisi">Transmisi</label>
                  <select id="kTransmisi" name="kTransmisi" defaultValue={k.transmisi || ''}>
                    <option value="">—</option>
                    {TRANSMISI.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="kBahanBakar">Bahan bakar</label>
                  <select id="kBahanBakar" name="kBahanBakar" defaultValue={k.bahanBakar || ''}>
                    <option value="">—</option>
                    {BAHAN_BAKAR.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              </div>
              <div className="bantuan">Judul dibuat otomatis: Tahun + Merek + Model.</div>
            </div>
          )}

          <div className="kartu">
            <h3>Foto (maksimal {maks})</h3>
            <div className="baris-aksi" style={{ marginBottom: 8 }}>
              {[['unggahan', 'Unggah ke aplikasi'], ['folder', 'Folder di komputer'], ['url', 'URL gambar']].map(([v, l]) => (
                <label key={v} style={{ fontWeight: 400, margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name="_fotoTipe" checked={fotoTipe === v} onChange={() => setFotoTipe(v)} style={{ width: 'auto' }} /> {l}
                </label>
              ))}
            </div>

            {fotoTipe === 'unggahan' && (
              <>
                <input type="file" accept="image/*" multiple onChange={pilihFoto} disabled={!iklan.id} />
                {!iklan.id && <div className="bantuan">Simpan iklan dulu, lalu foto bisa diunggah.</div>}
                {unggah && <div className="bantuan">{unggah}</div>}
                <div className="foto-grid" style={{ marginTop: 10 }}>
                  {berkas.map((f) => (
                    <figure key={f.id}>
                      <img src={`/api/foto/${iklan.id}/${f.id}`} alt={f.nama} />
                      <button type="button" title="Hapus foto" onClick={() => setBerkas((b) => b.filter((x) => x.id !== f.id))}>✕</button>
                    </figure>
                  ))}
                </div>
              </>
            )}

            {fotoTipe === 'folder' && (
              <>
                <label htmlFor="fotoFolder">Folder foto di komputer</label>
                <input type="text" id="fotoFolder" name="fotoFolder" defaultValue={iklan.foto?.folder || ''} placeholder="D:\Foto Mobil\B1590DYA" />
                <div className="bantuan">Ekstensi Chrome membaca foto langsung dari komputer Anda, jadi tidak perlu diunggah. Aktifkan “Izinkan akses ke URL file” pada ekstensi.</div>
              </>
            )}

            {fotoTipe === 'url' && (
              <>
                <label htmlFor="fotoUrl">URL gambar</label>
                <textarea id="fotoUrl" name="fotoUrl" defaultValue={(iklan.foto?.url || []).join('\n')} rows={4} placeholder="https://… (satu per baris)" />
              </>
            )}
          </div>

          <div className="kartu">
            <h3>Jadwal</h3>
            <div className="grid k2" style={{ gap: '0 12px' }}>
              <div>
                <label htmlFor="jadwal">Tanggal & jam tayang</label>
                <input type="datetime-local" id="jadwal" name="jadwal" defaultValue={untukInputLokal(iklan.jadwal, zona)} />
              </div>
              <div>
                <label htmlFor="cara">Cara posting</label>
                <select id="cara" name="cara" defaultValue={iklan.cara}>
                  <option value="otomatis">Otomatis (ekstensi Chrome)</option>
                  <option value="manual">Pasang manual</option>
                </select>
              </div>
            </div>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={iklan.status}>
              <option value="draf">Draf</option>
              <option value="terjadwal">Terjadwal</option>
            </select>
            <div className="bantuan">Zona waktu: {zona}.</div>
          </div>
        </div>
      </div>

      <div className="baris-aksi">
        <button className="btn utama" type="submit">Simpan</button>
        <a className="btn" href="/iklan">Batal</a>
      </div>
    </form>
  );
}
