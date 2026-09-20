# AutoPost Iklan — Panduan

Tiga bagian yang bekerja bersama:

| Bagian | Tempat | Tugas |
|---|---|---|
| **Dasbor web** | Vercel | menyimpan iklan & jadwal, impor dari Google Sheet, tempat Anda memantau |
| **Supabase** | akun klien | basis data + penyimpanan foto unggahan |
| **Ekstensi Chrome** | komputer penjual | membuka formulir Marketplace dan mengisinya pada jam jadwal |

> **Risiko yang harus disepakati dulu.** Facebook tidak punya API Marketplace. Otomatisasi lewat browser tidak didukung resmi Meta, jadi akun bisa dibatasi. Ekstensi ini tidak menyimpan kata sandi Facebook dan tidak menyamar; gunakan jeda & batas harian yang wajar, dan mulailah dengan **mode uji**.

---

## A. Siapkan Supabase (±5 menit)

1. Buat project baru di <https://supabase.com> (paket gratis cukup).
2. Buka **SQL Editor → New query**, tempel seluruh isi `skema.sql`, klik **Run**.
   Ini membuat tabel `ap_iklan`, `ap_log`, `ap_setelan`, dan bucket foto `ap-foto`.
3. Buka **Project Settings → API**, catat:
   - **Project URL** → `SUPABASE_URL`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` (rahasia; hanya untuk server)

---

## B. Deploy ke Vercel (±5 menit)

1. Unggah folder proyek ini ke GitHub klien (repo privat).
2. Di <https://vercel.com> → **Add New → Project** → pilih repo tersebut → **Deploy**.
3. Buka **Settings → Environment Variables**, isi:

   | Nama | Isi |
   |---|---|
   | `SUMBER_DATA` | `supabase` |
   | `SUPABASE_URL` | dari langkah A.3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | dari langkah A.3 |
   | `SANDI_DASBOR` | sandi untuk masuk ke dasbor |
   | `SESI_RAHASIA` | teks acak bebas (opsional tetapi disarankan) |

4. **Redeploy** agar variabelnya terpakai, lalu buka alamat aplikasinya dan masuk memakai `SANDI_DASBOR`.

---

## C. Pasang ekstensi Chrome (±3 menit)

1. Di dasbor buka **Pengaturan** → klik **Buat kunci** → salin **URL untuk ekstensi** dan **kunci rahasia**.
2. Di Chrome buka `chrome://extensions` → nyalakan **Mode pengembang** → **Muat yang belum dibuka** → pilih folder `ekstensi-chrome`.
3. Klik ikon 📣 ekstensi → tempel URL + kunci → **Simpan & tes**. Chrome akan meminta izin mengakses alamat dasbor; setujui.
4. Pastikan Chrome tersebut sudah **login Facebook** dengan akun penjual.
5. Bila memakai **foto dari folder komputer**: pada `chrome://extensions` → **Detail** ekstensi → nyalakan **“Izinkan akses ke URL file”**.

---

## D. Impor stok dari Google Sheet

1. Agar bisa dibaca tanpa login: di Google Sheet pilih **Bagikan → Siapa saja yang memiliki link (Pelihat)**, atau **File → Bagikan → Publikasikan ke web → CSV**.
2. Dasbor → **Impor** → tempel link → **Tarik dari Sheet**. Bisa juga **Unggah CSV/XLSX**.
3. Periksa **pemetaan kolom**. Sudah ditebak dari nama header (Merk → Merek, KM → Jarak Tempuh, No Polisi → Kunci Unik).
   - Kolom **nilai tetap** untuk isian yang sama di semua baris, mis. Kategori = `Kendaraan`.
   - Gabungan kolom memakai `{huruf}`, mis. Model = `{C} {D}`, atau Folder Foto = `D:\Foto Mobil\{A}`.
4. Atur **iklan pertama tayang** dan **jeda antar iklan**, lalu **Pratinjau** → **Impor**.
5. Hasil impor berstatus **Draf**. Periksa, lalu ubah ke **Terjadwal** (tombol *Jadwalkan* di daftar iklan).

**Kunci Unik** membuat baris yang sama tidak terimpor dua kali, jadi impor boleh diulang setiap ada stok baru.

---

## E. Foto

| Cara | Kapan dipakai | Catatan |
|---|---|---|
| **Unggah ke aplikasi** | foto ada di HP/komputer, ingin bisa dilihat dari mana saja | tersimpan di Supabase Storage (bucket privat) |
| **Folder di komputer** | foto sudah rapi per unit di PC penjual | mis. `D:\Foto Mobil\B1590DYA`; ekstensi membacanya langsung, tidak diunggah ke server |
| **URL gambar** | foto sudah ada di web/hosting | satu URL per baris |

Batas: 10 foto untuk barang, 20 foto untuk kendaraan (mengikuti Facebook).

---

## F. Pakai sehari-hari

1. Pastikan Chrome berisi ekstensi **terbuka dan login Facebook** pada jam jadwal.
2. Iklan berstatus **Terjadwal** + cara **Otomatis** akan diambil ekstensi saat jadwalnya tiba.
3. Dasbor menampilkan langkah yang sedang dikerjakan ekstensi, lalu status akhirnya: **Terbit** (dengan tautan) atau **Gagal** (dengan alasannya).
4. Iklan bercara **Pasang manual** tidak disentuh ekstensi; iklan tersebut muncul di dasbor sebagai daftar “Perlu dipasang manual”.

### Mode uji (wajib saat pertama kali)
Pengaturan → centang **Mode uji**. Ekstensi mengisi formulir sampai halaman terakhir tetapi **tidak** menekan *Terbitkan*, dan iklan kembali ke **Draf** dengan catatan. Setelah isiannya terbukti benar, matikan mode uji.

---

## G. Mengatasi masalah

| Gejala | Solusi |
|---|---|
| “Kunci ekstensi salah” | Salin ulang kunci dari Pengaturan; pastikan URL berakhiran `/api/ekstensi`. |
| “Tidak bisa menghubungi dasbor” | Di popup ekstensi klik **Simpan & tes** lagi dan setujui permintaan izin situs. |
| “Folder tidak bisa dibaca” | `chrome://extensions` → Detail ekstensi → nyalakan **Izinkan akses ke URL file**. Periksa juga penulisan folder. |
| “Chrome ini belum login Facebook” | Login Facebook di Chrome yang dipasangi ekstensi, lalu jadwalkan ulang. |
| “Merek/Warna … tidak ada di pilihan Facebook” | Pesan galat menyebutkan pilihan yang tersedia; samakan isinya di dasbor. |
| "Skrip pengisi tidak merespons" | Ekstensi berhasil membuka tab tetapi skrip pengisinya tidak menjawab. Pesannya menyebutkan halaman apa yang terbuka. Bila bukan halaman buat iklan, buka `facebook.com/marketplace/create/vehicle` sekali secara manual di Chrome yang sama (Marketplace kadang minta verifikasi/pengaturan lokasi dulu), lalu jadwalkan ulang. Periksa juga `chrome://extensions` — ekstensi harus aktif, tanpa galat, versi 2.1.0 ke atas. |
| Status **Diproses** lama | Dasbor menampilkan langkah terakhir. Bila Chrome ditutup di tengah proses, setelah 20 menit iklan ditandai Gagal — cek Marketplace dulu sebelum menjadwalkan ulang agar tidak dobel. |
| "Application error: a server-side exception" | Buka dasbor lagi: penyebabnya kini ditulis di kotak merah **Perlu diperbaiki** di bagian atas halaman. Paling sering: variabel Supabase belum diisi di Vercel, atau `skema.sql` belum dijalankan. Setelah variabel diubah, jangan lupa **Redeploy**. |
| Tombol Simpan/Jadwalkan gagal | Pesannya muncul di halaman (bukan lagi error putih). Bila berbunyi "Supabase belum diatur", isi `SUMBER_DATA`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY` di Vercel lalu Redeploy — disk Vercel hanya-baca sehingga data harus disimpan di Supabase. |
| Google Sheet tidak terbaca | Sheet masih privat. Bagikan “Siapa saja yang memiliki link”, atau pakai Publikasikan ke web → CSV. |
| Formulir Facebook berubah | Buka halaman buat iklan di Chrome → ikon ekstensi → **Rekam formulir halaman ini**; strukturnya tersimpan di riwayat dasbor untuk diperbaiki. |

---

## Untuk pengembang

- `npm run uji` menjalankan pemeriksaan inti + kontrak Supabase + berkas ekstensi (47 + 33 + 23) (CSV/XLSX, impor, aturan iklan, protokol ekstensi) tanpa server dan tanpa akun apa pun; data uji ditulis ke folder sementara.
- `node test/uji-api.js` menguji HTTP terhadap server yang sedang berjalan (`npm run dev`), termasuk alur ekstensi ujung-ke-ujung.
- `node test/uji-supabase.js` menguji adaptor Supabase memakai tiruan yang **membaca skema.sql** dan menolak kolom/tipe yang tidak cocok — menangkap ketidakcocokan kolom tanpa perlu akun Supabase.
- Lapisan data bisa ditukar lewat `SUMBER_DATA`: `supabase` atau `berkas` (folder `./data`). Antarmukanya sama, jadi aplikasi ini bisa dijalankan tanpa Supabase bila perlu.
- Protokol ekstensi: `POST /api/ekstensi` dengan `{kunci, aksi}` — `ping`, `ambil`, `foto`, `progres`, `lapor`, `rekam`. Setiap tugas memakai token sekali pakai.
- Penanda formulir Facebook (label Indonesia/Inggris) ada di objek `PENANDA` dalam `ekstensi-chrome/isi-formulir.js`.
- Skrip pengisi disuntikkan dua jalur: pendaftaran di manifes (halaman buat iklan) dan `chrome.scripting.executeScript` dari pekerja latar, sehingga tetap jalan bila URL Facebook berbeda dari pola manifes.
- `node test/uji-formulir.js` menjalankan pengisian formulir di Chrome headless terhadap formulir tiruan (butuh puppeteer-core lewat NODE_PATH; sengaja tidak masuk package.json).
