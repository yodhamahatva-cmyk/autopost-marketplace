/**
 * Pemilih penyimpanan: SUMBER_DATA=supabase (produksi) atau berkas (pengembangan).
 * Bagian aplikasi lain cukup memanggil db() dan tidak peduli penyimpanannya apa.
 */
import { buatPenyimpananBerkas } from './berkas.js';
import { buatPenyimpananSupabase } from './supabase.js';

let instans = null;

export function db() {
  if (instans) return instans;
  const pilihan = (process.env.SUMBER_DATA || (process.env.SUPABASE_URL ? 'supabase' : 'berkas')).toLowerCase();
  instans = pilihan === 'supabase' ? buatPenyimpananSupabase() : buatPenyimpananBerkas();
  return instans;
}

/** Hanya untuk pengujian. */
export function pakaiPenyimpanan(x) {
  instans = x;
}

export const SETELAN_BAWAAN = {
  kunciEkstensi: '',
  modeUji: true,
  jedaMenit: 10,
  batasHarian: 10,
  zona: 'Asia/Jakarta',
  ekstensiTerakhir: '',
  postTerakhir: '',
  hitungHarian: '',
  imporPeta: null,
  sheetUrl: ''
};

export async function setelanLengkap() {
  return { ...SETELAN_BAWAAN, ...(await db().setelan()) };
}
