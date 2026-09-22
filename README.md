# AutoPost Iklan — Web

Dasbor web untuk menjadwalkan dan memasang iklan **Facebook Marketplace**: impor stok dari **Google Sheet** (tanpa akun Google), atur jadwal, lalu **ekstensi Chrome** memasang iklannya di Chrome Anda yang sudah login.

- **Tanpa Google Drive.** Foto boleh diunggah ke aplikasi, diambil dari **folder di komputer** (dibaca langsung oleh ekstensi, tidak diunggah ke mana pun), atau berupa URL gambar.
- **Impor Google Sheet** lewat link berbagi/publikasi, atau unggah CSV/XLSX. Pemetaan kolom ditebak dari nama header — ada **templat sheet siap pakai** (`public/templat-stok-kendaraan.xlsx` — tab Stok + Pilihan Nilai + Petunjuk) yang urutan kolomnya persis formulir kendaraan Facebook.
- **Anti isian tertukar**: penebak kolom menilai semua kemungkinan (Varian ≠ Model, Jenis Bahan Bakar ≠ Jenis Kendaraan, Warna Interior ≠ Warna eksterior), dan ekstensi mencocokkan ulang seluruh isian sebelum iklan dipasang.
- **Iklan kendaraan** memakai formulir khusus Facebook (Jenis kendaraan, Tahun, Merek, Model, Jarak tempuh, Tipe body, Warna eksterior).
- **Banyak akun Facebook**: tiap Chrome menyebut nama akunnya sendiri; iklan bisa diarahkan ke satu akun, ke akun mana saja, atau ke **semua akun** (dipasang bergiliran). Jeda & batas harian dihitung per akun.
- **Tiga cara menutup formulir**: mode uji (mengisi tanpa menekan apa pun), **simpan sebagai draf di Facebook** (pemilik akun yang menerbitkan sendiri), atau terbitkan langsung.
- **Pengaman**: jeda antar posting, batas harian, dan pencegah impor dobel lewat Kunci Unik.

> Facebook tidak menyediakan API Marketplace. Ekstensi bekerja seperti Anda sendiri di Chrome — tanpa menyimpan sandi dan tanpa menyamar — tetapi otomatisasi tetap tidak didukung resmi oleh Meta, sehingga akun bisa dibatasi. Lihat [PANDUAN.md](PANDUAN.md).

## Susunan

| Bagian | Isi |
|---|---|
| `app/` | halaman dasbor (Next.js App Router) + API `/api/ekstensi`, `/api/impor`, `/api/unggah`, `/api/foto` |
| `components/` | formulir iklan, alur impor, tombol aksi |
| `lib/` | aturan iklan, impor & pembaca Sheet, protokol ekstensi, lapisan data |
| `lib/data/` | penyimpanan: `supabase.js` (produksi) atau `berkas.js` (folder lokal) |
| `lib/perangkat.js` | daftar akun/Chrome yang terhubung + aturan penyaluran iklan per akun |
| `ekstensi-chrome/` | ekstensi Chrome (Manifest V3) pengisi formulir Marketplace |
| `public/` | templat sheet yang bisa diunduh dari halaman Impor |
| `templat/buat-templat.js` | membuat templat XLSX 3 tab + CSV pilihan nilai dari daftar resmi di `lib/iklan.js` |
| `skema.sql` | tabel + bucket Supabase |
| `test/` | `uji.js` (inti, tanpa server) dan `uji-api.js` (HTTP ke server berjalan) |

## Jalankan lokal

```bash
npm install
cp .env.contoh .env.local   # untuk coba-coba cukup: SUMBER_DATA=berkas
npm run dev                 # http://localhost:3110
```

## Uji

```bash
npm run uji                 # 47 pemeriksaan inti (tanpa server, tanpa akun)
node test/uji-api.js        # uji HTTP: jalankan `npm run dev` dulu
```

Pemasangan dan cara pakai sehari-hari: **[PANDUAN.md](PANDUAN.md)**.
