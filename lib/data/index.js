/**
 * Pemilih penyimpanan: SUMBER_DATA=supabase (produksi) atau berkas (pengembangan).
 * Bagian aplikasi lain cukup memanggil db() dan tidak peduli penyimpanannya apa.
 */
import { buatPenyimpananBerkas } from './berkas.js';
import { buatPenyimpananSupabase } from './supabase.js';

let instans = null;

const diVercel = () => !!process.env.VERCEL;

function pilihan() {
  return (process.env.SUMBER_DATA || (process.env.SUPABASE_URL ? 'supabase' : 'berkas')).toLowerCase();
}

export const PESAN_BELUM_SUPABASE =
  'Supabase belum diatur di Vercel. Isi variabel SUMBER_DATA=supabase, SUPABASE_URL, dan SUPABASE_SERVICE_ROLE_KEY ' +
  '(Vercel → Settings → Environment Variables), lalu Redeploy. Tanpa itu data tidak bisa disimpan, karena disk Vercel hanya-baca.';

export function db() {
  if (instans) return instans;
  if (pilihan() === 'supabase') {
    instans = buatPenyimpananSupabase();
  } else if (diVercel()) {
    // Disk Vercel hanya-baca: baca tetap jalan (data kosong), tetapi setiap tulis memberi pesan yang jelas.
    const berkas = buatPenyimpananBerkas();
    const tolak = async () => { throw new Error(PESAN_BELUM_SUPABASE); };
    instans = {
      ...berkas,
      jenis: 'berkas',
      simpanSetelan: tolak, simpanIklan: tolak, simpanBanyak: tolak, hapusIklan: tolak,
      tambahLog: async () => true, simpanFoto: tolak, hapusFoto: tolak
    };
  } else {
    instans = buatPenyimpananBerkas();
  }
  return instans;
}

/** Hanya untuk pengujian. */
export function pakaiPenyimpanan(x) {
  instans = x;
  cache = null;
}

/** Masalah konfigurasi yang perlu ditampilkan di dasbor (disimpan 60 detik agar tidak memeriksa tiap permintaan). */
let cache = null;
export async function periksaKonfigurasi() {
  if (cache && Date.now() - cache.waktu < 60000) return cache.masalah;
  let masalah = [];
  if (pilihan() !== 'supabase' && diVercel()) {
    masalah = [PESAN_BELUM_SUPABASE];
  } else if (pilihan() === 'supabase') {
    try {
      masalah = (await db().periksa?.()) || [];
    } catch (e) {
      masalah = [e.message];
    }
  }
  if (!process.env.SANDI_DASBOR && diVercel()) {
    masalah.push('SANDI_DASBOR belum diatur, sehingga dasbor bisa dibuka siapa saja yang tahu alamatnya. Isi variabel itu di Vercel lalu Redeploy.');
  }
  // Hasil baik disimpan; hasil bermasalah diperiksa ulang lebih cepat setelah diperbaiki.
  cache = { waktu: masalah.length ? Date.now() - 45000 : Date.now(), masalah };
  return masalah;
}

export const SETELAN_BAWAAN = {
  kunciEkstensi: '',
  akhir: '',         // terbit | draf | uji — kosong berarti ikut modeUji (setelan lama); lihat caraAkhir di lib/iklan.js
  modeUji: true,     // disimpan selaras dengan "akhir" demi setelan & ekstensi versi lama
  jedaMenit: 10,
  batasHarian: 30,
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
