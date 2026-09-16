/**
 * Impor massal: tabel inventaris (Google Sheet / CSV / XLSX) → daftar iklan.
 * Pemetaan kolom ditebak dari nama header, boleh diubah, dan nilai tetap boleh
 * menggabungkan kolom memakai {huruf}, mis. "{C} {D}".
 */
import { angka, hurufKeIndeks } from './util.js';
import { rapikanIklan, periksaIklan } from './iklan.js';

export const TARGET = [
  { k: 'kunci', label: 'Kunci Unik', ket: 'Nomor polisi / ID unit — agar tidak terimpor dua kali.' },
  { k: 'judul', label: 'Judul', ket: 'Kosongkan untuk kendaraan: dibuat dari Tahun + Merek + Model.' },
  { k: 'harga', label: 'Harga', wajib: true },
  { k: 'fotoFolder', label: 'Folder Foto (di PC)', ket: 'mis. D:\\Foto Mobil\\B1590DYA — dibaca ekstensi dari komputer.' },
  { k: 'fotoUrl', label: 'URL Foto', ket: 'Alamat gambar publik, pisahkan dengan koma.' },
  { k: 'deskripsi', label: 'Deskripsi' },
  { k: 'kategori', label: 'Kategori', ket: 'Isi tetap "Kendaraan" untuk mobil/motor.' },
  { k: 'kondisi', label: 'Kondisi' },
  { k: 'lokasi', label: 'Lokasi' },
  { k: 'jenisKendaraan', label: 'Jenis Kendaraan' },
  { k: 'tahun', label: 'Tahun' },
  { k: 'merek', label: 'Merek' },
  { k: 'model', label: 'Model' },
  { k: 'jarakTempuh', label: 'Jarak Tempuh' },
  { k: 'transmisi', label: 'Transmisi' },
  { k: 'bahanBakar', label: 'Bahan Bakar' },
  { k: 'warna', label: 'Warna' },
  { k: 'tipeBodi', label: 'Tipe Bodi' }
];

const SINONIM = {
  kunci: ['plat', 'nopol', 'no polisi', 'nomor polisi', 'id unit', 'kode unit', 'kode', 'sku', 'stock'],
  judul: ['judul', 'title', 'nama iklan'],
  harga: ['harga', 'price', 'otr', 'harga jual'],
  fotoFolder: ['folder foto', 'folder', 'path foto', 'lokasi foto'],
  fotoUrl: ['url foto', 'link foto', 'foto', 'gambar', 'image', 'photo'],
  deskripsi: ['deskripsi', 'keterangan', 'description', 'caption', 'narasi'],
  kategori: ['kategori', 'category'],
  kondisi: ['kondisi', 'condition'],
  lokasi: ['lokasi', 'cabang', 'kota', 'showroom', 'location'],
  jenisKendaraan: ['jenis kendaraan', 'tipe kendaraan', 'jenis'],
  tahun: ['tahun', 'year', 'thn'],
  merek: ['merek', 'merk', 'brand', 'pabrikan'],
  model: ['model', 'tipe', 'type', 'varian', 'variant'],
  jarakTempuh: ['jarak tempuh', 'jarak', 'km', 'kilometer', 'odometer', 'mileage'],
  transmisi: ['transmisi', 'transmission'],
  bahanBakar: ['bahan bakar', 'bbm', 'fuel'],
  warna: ['warna', 'color', 'colour'],
  tipeBodi: ['tipe bodi', 'tipe body', 'body', 'bodi', 'body style']
};

export function tebakPemetaan(kolom) {
  const peta = {};
  const dipakai = {};
  TARGET.forEach((t) => {
    const sinonim = SINONIM[t.k] || [];
    const cocok = kolom.filter((k) => k.judul && !dipakai[k.huruf]).find((k) => {
      const j = k.judul.toLowerCase().trim();
      return sinonim.some((s) => j === s || j.includes(s));
    });
    if (cocok) { peta[t.k] = { kolom: cocok.huruf, teks: '' }; dipakai[cocok.huruf] = true; }
  });
  return peta;
}

/** Nilai satu target untuk satu baris sumber; templat "{C} {D}" menggabungkan kolom. */
export function nilaiSumber(aturan, baris) {
  if (!aturan) return '';
  const ambil = (h) => {
    const i = hurufKeIndeks(h);
    return i && i <= baris.length ? String(baris[i - 1] == null ? '' : baris[i - 1]).trim() : '';
  };
  const teks = String(aturan.teks || '').trim();
  if (teks) {
    return /\{[A-Za-z]+\}/.test(teks)
      ? teks.replace(/\{([A-Za-z]+)\}/g, (_, h) => ambil(h)).replace(/\s+/g, ' ').trim()
      : teks;
  }
  return aturan.kolom ? ambil(aturan.kolom) : '';
}

/** Rapikan nilai mentah dari sheet agar cocok dengan pilihan Facebook. */
export function rapikanNilai(target, nilai) {
  const s = String(nilai == null ? '' : nilai).trim();
  if (!s) return '';
  if (target === 'tahun') { const m = s.match(/(19|20)\d{2}/); return m ? m[0] : s; }
  if (target === 'harga' || target === 'jarakTempuh') return angka(s);
  if (target === 'transmisi') return /manual|\bmt\b|m\/t/i.test(s) ? 'Manual' : /otomat|matic|\bat\b|a\/t|cvt/i.test(s) ? 'Otomatis' : s;
  if (target === 'bahanBakar') {
    return /bensin|gasoline|petrol/i.test(s) ? 'Bensin' : /diesel|solar/i.test(s) ? 'Diesel'
      : /listrik|electric|\bev\b/i.test(s) ? 'Listrik' : /hybrid|hibrida/i.test(s) ? 'Hibrida' : s;
  }
  if (target === 'jenisKendaraan') return /motor/i.test(s) ? 'Sepeda Motor' : /mobil|truk|car|truck/i.test(s) ? 'Mobil/Truk' : s;
  if (target === 'warna') return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s;
}

/**
 * Susun calon iklan dari tabel sumber.
 * opsi: { peta, barisAwal, mulai (ISO), jedaMenit, cara, status, kunciSudahAda:Set|Array }
 */
export function susunImpor(tabel, opsi) {
  const peta = opsi.peta || {};
  const awal = Math.max(1, Number(opsi.barisAwal) || 1);
  const jeda = Math.max(0, Number(opsi.jedaMenit) || 0);
  const mulai = opsi.mulai ? new Date(opsi.mulai).getTime() : Date.now() + 3600000;
  const sudah = new Set((opsi.kunciSudahAda || []).map((x) => String(x)));
  const hasil = [];
  const dilewati = [];
  let ke = 0;

  (tabel || []).slice(awal - 1).forEach((barisSumber, i) => {
    const nomor = awal + i;
    const n = {};
    TARGET.forEach((t) => { n[t.k] = rapikanNilai(t.k, nilaiSumber(peta[t.k], barisSumber)); });
    const adaIsi = TARGET.some((t) => n[t.k] !== '' && n[t.k] !== null && n[t.k] !== undefined);
    if (!adaIsi) return;
    if (n.kunci && sudah.has(String(n.kunci)) && opsi.lewatiDuplikat !== false) {
      dilewati.push({ baris: nomor, kunci: n.kunci, alasan: 'sudah pernah diimpor' });
      return;
    }
    const jadwal = new Date(mulai + ke * jeda * 60000).toISOString();
    ke++;
    const foto = n.fotoFolder ? { tipe: 'folder', folder: n.fotoFolder }
      : n.fotoUrl ? { tipe: 'url', url: n.fotoUrl }
        : { tipe: 'unggahan', berkas: [] };
    const iklan = rapikanIklan({
      kunci: n.kunci, judul: n.judul, harga: n.harga, kategori: n.kategori, kondisi: n.kondisi,
      lokasi: n.lokasi, deskripsi: n.deskripsi, foto,
      kendaraan: {
        jenis: n.jenisKendaraan, tahun: n.tahun, merek: n.merek, model: n.model, jarakTempuh: n.jarakTempuh,
        transmisi: n.transmisi, bahanBakar: n.bahanBakar, warna: n.warna, tipeBodi: n.tipeBodi
      },
      cara: opsi.cara === 'manual' ? 'manual' : 'otomatis',
      jadwal, status: opsi.status || 'draf',
      sumber: { nama: opsi.namaSumber || 'impor', baris: nomor }
    });
    const cek = periksaIklan(iklan);
    hasil.push({ baris: nomor, iklan, masalah: cek.galat });
  });
  return { hasil, dilewati };
}
