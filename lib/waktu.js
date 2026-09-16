/** Waktu: semua disimpan sebagai ISO UTC, ditampilkan memakai zona waktu setelan. */
export const ZONA_BAWAAN = 'Asia/Jakarta';

const bagian = (iso, zona, opsi) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: zona, ...opsi }).formatToParts(new Date(iso))
    .reduce((h, p) => (h[p.type] = p.value, h), {});

/** "16/09/2026 19:30" */
export function formatWaktu(iso, zona = ZONA_BAWAAN) {
  if (!iso) return '—';
  const p = bagian(iso, zona, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function formatTanggal(iso, zona = ZONA_BAWAAN) {
  if (!iso) return '—';
  const p = bagian(iso, zona, { day: '2-digit', month: 'short', year: 'numeric' });
  return `${p.day} ${p.month} ${p.year}`;
}

/** Nilai untuk <input type="datetime-local"> pada zona setelan. */
export function untukInput(iso, zona = ZONA_BAWAAN) {
  if (!iso) return '';
  const p = bagian(iso, zona, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "2026-09-20T09:00" pada zona setelan → ISO UTC. */
export function dariInput(teks, zona = ZONA_BAWAAN) {
  const m = String(teks || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, bl, d, j, mn] = m;
  const kira = Date.UTC(+y, +bl - 1, +d, +j, +mn);
  // Koreksi selisih zona (termasuk bila zona berubah oleh DST).
  const beda = kira - new Date(new Date(kira).toLocaleString('sv-SE', { timeZone: zona }) + 'Z').getTime();
  return new Date(kira + beda).toISOString();
}

export function relatif(iso) {
  if (!iso) return '';
  const menit = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const abs = Math.abs(menit);
  const teks = abs < 60 ? `${abs} menit` : abs < 1440 ? `${Math.round(abs / 60)} jam` : `${Math.round(abs / 1440)} hari`;
  return menit >= 0 ? `dalam ${teks}` : `lewat ${teks}`;
}

export function hariIni(zona = ZONA_BAWAAN, iso = new Date().toISOString()) {
  const p = bagian(iso, zona, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.year}-${p.month}-${p.day}`;
}
