/**
 * Membaca tabel dari Google Sheet tanpa akun Google:
 * - link "Publikasikan ke web" (CSV) atau link sheet biasa yang bisa diakses "siapa pun dengan link"
 * - berkas CSV / XLSX yang diunggah
 */
import * as XLSX from 'xlsx';
import { huruf } from './util.js';

/** Ubah berbagai bentuk link Google Sheet menjadi URL ekspor CSV. */
export function urlCsv(url) {
  const s = String(url || '').trim();
  if (!s) throw new Error('Link Google Sheet belum diisi.');
  if (!/^https?:\/\//i.test(s)) throw new Error('Link harus diawali https://');
  if (/\/pub\?|\/pub$|output=csv|format=csv/i.test(s)) return s.includes('output=csv') || s.includes('format=csv') ? s : s + '&output=csv';
  const m = s.match(/\/spreadsheets\/d\/(?:e\/)?([\w-]+)/);
  if (!m) throw new Error('Bukan link Google Sheet. Salin dari bilah alamat spreadsheet, atau pakai File → Bagikan → Publikasikan ke web → CSV.');
  const gid = (s.match(/[#&?]gid=(\d+)/) || [])[1] || '0';
  return /\/spreadsheets\/d\/e\//.test(s)
    ? 'https://docs.google.com/spreadsheets/d/e/' + m[1] + '/pub?gid=' + gid + '&single=true&output=csv'
    : 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv&gid=' + gid;
}

export async function ambilDariUrl(url, fetchImpl = fetch) {
  const tujuan = urlCsv(url);
  let res;
  try {
    res = await fetchImpl(tujuan, { redirect: 'follow', headers: { 'User-Agent': 'AutoPost-Iklan' } });
  } catch (e) {
    throw new Error('Tidak bisa menghubungi Google Sheet (' + e.message + ').');
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Google menolak akses (HTTP ' + res.status + '). Buka Sheet → Bagikan → ubah ke "Siapa saja yang memiliki link" (Pelihat), atau File → Bagikan → Publikasikan ke web → CSV.');
  }
  if (!res.ok) throw new Error('Gagal mengambil Sheet (HTTP ' + res.status + ').');
  const teks = await res.text();
  if (/<html/i.test(teks.slice(0, 200))) {
    throw new Error('Yang terunduh halaman login Google, bukan data. Pakai link "Publikasikan ke web → CSV", atau bagikan sheet ke "Siapa saja yang memiliki link".');
  }
  return uraiCsv(teks);
}

/** CSV → array of array (mendukung tanda kutip, koma & titik koma, baris baru di dalam sel). */
export function uraiCsv(teks) {
  const isi = String(teks || '').replace(/^﻿/, '');
  const pemisah = (isi.split('\n')[0].match(/;/g) || []).length > (isi.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const baris = [];
  let sel = '';
  let kini = [];
  let kutip = false;
  for (let i = 0; i < isi.length; i++) {
    const c = isi[i];
    if (kutip) {
      if (c === '"') {
        if (isi[i + 1] === '"') { sel += '"'; i++; } else kutip = false;
      } else sel += c;
      continue;
    }
    if (c === '"') kutip = true;
    else if (c === pemisah) { kini.push(sel); sel = ''; }
    else if (c === '\n') { kini.push(sel); baris.push(kini); kini = []; sel = ''; }
    else if (c !== '\r') sel += c;
  }
  if (sel !== '' || kini.length) { kini.push(sel); baris.push(kini); }
  return baris.map((r) => r.map((v) => String(v).trim()));
}

/** Berkas CSV/XLSX (ArrayBuffer/Buffer) → array of array. */
export function uraiBerkas(nama, data) {
  if (/\.csv$/i.test(nama || '')) return uraiCsv(Buffer.from(data).toString('utf8'));
  const wb = XLSX.read(data, { type: 'buffer' });
  const lembar = wb.Sheets[wb.SheetNames[0]];
  if (!lembar) throw new Error('Berkas tidak berisi lembar apa pun.');
  return XLSX.utils.sheet_to_json(lembar, { header: 1, raw: false, defval: '' })
    .map((r) => r.map((v) => String(v == null ? '' : v).trim()));
}

/**
 * Ringkasan tabel: deteksi baris header, daftar kolom + contoh isi.
 * { barisHeader, barisAwal, jumlahBaris, kolom:[{huruf,judul,contoh}] }
 */
export function ringkasTabel(tabel) {
  const baris = (tabel || []).filter((r) => r.some((v) => String(v).trim()));
  let barisHeader = 0;
  for (let i = 0; i < Math.min(baris.length, 10); i++) {
    const teks = baris[i].filter((v) => String(v).trim() && !/^[\d.,\s%]+$/.test(String(v)));
    if (teks.length >= 3) { barisHeader = i + 1; break; }
  }
  const lebar = baris.reduce((m, r) => Math.max(m, r.length), 0);
  const judul = barisHeader ? baris[barisHeader - 1] : [];
  const kolom = [];
  for (let c = 0; c < lebar; c++) {
    const contoh = baris.slice(barisHeader).map((r) => r[c]).find((v) => String(v || '').trim()) || '';
    kolom.push({ huruf: huruf(c + 1), judul: String(judul[c] || '').trim(), contoh: String(contoh).slice(0, 80) });
  }
  return { barisHeader, barisAwal: barisHeader + 1, jumlahBaris: baris.length, kolom, baris };
}
