/** Utilitas kecil yang aman dipakai di server maupun browser (tanpa modul Node). */

export function angka(nilai) {
  if (typeof nilai === 'number' && isFinite(nilai)) return Math.round(nilai);
  const d = String(nilai == null ? '' : nilai).replace(/,\d{1,2}$/, '').replace(/[^\d]/g, '');
  return d ? Number(d) : null;
}

export function rupiah(n) {
  if (n === null || n === undefined || n === '') return '—';
  return 'Rp' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function potong(teks, n = 120) {
  const s = String(teks == null ? '' : teks).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function huruf(n) {
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function hurufKeIndeks(h) {
  let n = 0;
  String(h || '').toUpperCase().replace(/[^A-Z]/g, '').split('').forEach((c) => { n = n * 26 + (c.charCodeAt(0) - 64); });
  return n;
}
