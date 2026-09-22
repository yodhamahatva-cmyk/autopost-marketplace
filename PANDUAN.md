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

### Templat sheet (paling aman dari salah kolom)

Di dasbor → **Impor**, unduh **Templat lengkap (XLSX)**. Satu berkas, tiga tab:

| Tab | Isi |
|---|---|
| **Stok** | tempat Anda mengisi; urutan kolomnya persis formulir kendaraan Facebook. Tab inilah yang dibaca aplikasi saat diunggah — biarkan tetap paling depan |
| **Pilihan Nilai** | satu kolom per isian berisi nilai yang sah (Jenis Kendaraan, Tipe Bodi, Warna, Kondisi, Bahan Bakar, Transmisi) |
| **Petunjuk** | penjelasan singkat tiap kolom |

Cara pakai: Google Sheet baru → **File → Impor → Unggah** → pilih templatnya → *Ganti spreadsheet* → ganti barisnya dengan stok Anda. Jangan mengubah baris header; menambah kolom sendiri di sebelah kanan boleh.

**Dropdown seperti di Facebook (opsional).** Blok satu kolom di tab Stok → **Data → Validasi data** → *Kriteria: Dari rentang* → tunjuk kolom yang sesuai di tab **Pilihan Nilai**. Setelah itu isian yang salah ketik langsung ketahuan.

Versi CSV-nya (tab Stok saja, dan petunjuk kolom saja) tetap disediakan untuk yang memakai Excel/Notepad — CSV memang hanya bisa memuat satu tab, karena itu terpisah.

| Kolom | Wajib | Catatan |
|---|---|---|
| No Polisi (Kunci Unik) | – | mencegah satu unit terimpor dua kali |
| Jenis Kendaraan | ya | `Mobil/Truk` atau `Sepeda Motor` |
| Tahun | ya | 4 angka |
| Merek | ya | harus ada di daftar Facebook (mis. Daihatsu, Toyota) |
| Model | ya | mis. `Ayla 1.0 X` |
| Jarak Tempuh (km) | ya | angka; `15.770` juga diterima |
| Harga | ya | angka; `Rp 156.400.000` juga diterima |
| Tipe Bodi | ya untuk mobil | sepeda motor tidak punya kolom ini di Facebook |
| Warna Eksterior | ya | **bukan** warna interior |
| Kondisi Kendaraan, Jenis Bahan Bakar, Transmisi | – | ikuti daftar pilihan |
| Lokasi | – | kosong = memakai lokasi bawaan akun Facebook |
| Deskripsi | ya | boleh banyak baris & emoji |
| Folder Foto (di PC) / URL Foto | salah satu | lihat bagian E |

Judul iklan dibuat otomatis dari **Tahun + Merek + Model**, jadi tidak perlu kolom judul.

### Bila memakai sheet sendiri

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

> **Link Google Drive.** Link berbagi Drive (`drive.google.com/file/d/…/view`) bukan alamat gambar — yang terkirim halaman web, bukan foto, sehingga Facebook tidak menerimanya dan tombol *Berikutnya* tetap mati. Aplikasi ini otomatis mengubahnya menjadi alamat gambar langsung, tetapi itu hanya berhasil bila berkasnya dibagikan **“Siapa saja yang memiliki link (Pelihat)”**. Bila masih gagal, pesannya menyebutkan link mana yang bermasalah.

Batas: 10 foto untuk barang, 20 foto untuk kendaraan (mengikuti Facebook).

---

## F. Pakai sehari-hari

1. Pastikan Chrome berisi ekstensi **terbuka dan login Facebook** pada jam jadwal.
2. Iklan berstatus **Terjadwal** + cara **Otomatis** akan diambil ekstensi saat jadwalnya tiba.
3. Dasbor menampilkan langkah yang sedang dikerjakan ekstensi, lalu status akhirnya: **Terbit** (dengan tautan) atau **Gagal** (dengan alasannya).
4. Iklan bercara **Pasang manual** tidak disentuh ekstensi; iklan tersebut muncul di dasbor sebagai daftar “Perlu dipasang manual”.

### Beberapa akun Facebook (banyak Chrome)

Satu dasbor bisa melayani beberapa akun Facebook sekaligus — satu akun = satu Chrome yang dipasangi ekstensi.

1. Di tiap Chrome: pasang ekstensi, tempel **URL + kunci yang sama**, lalu isi **Nama akun Facebook di Chrome ini** (mis. `Showroom A`) → **Simpan & tes**.
2. Namanya langsung muncul di **Pengaturan → Akun Facebook / Chrome yang terhubung**, lengkap dengan status aktif dan pemakaian kuota hari ini.
3. Pada tiap iklan (formulir iklan → **Akun Facebook tujuan**) pilih salah satu:

| Pilihan | Artinya |
|---|---|
| **Akun mana saja** | siapa pun yang lebih dulu siap; iklan dipasang **sekali** |
| **Semua akun** | dipasang di **setiap** akun terdaftar, bergiliran satu per satu (jeda antar akun mengikuti "Jeda antar posting") |
| **nama akun tertentu** | hanya Chrome dengan nama itu yang boleh memasangnya |

Yang perlu diketahui:

- **Jeda antar posting dan batas harian berlaku per akun.** Batas 30/hari berarti 30 untuk tiap akun, bukan dibagi.
- Satu iklan tidak pernah dikerjakan dua Chrome sekaligus — tugas dikunci saat diambil.
- Iklan "semua akun" tetap berstatus **Terjadwal** sampai semua akun kebagian; keterangannya menyebut akun mana yang sudah dan siapa berikutnya. Kalau satu Chrome tidak pernah menyala, iklannya menunggu di situ (terlihat jelas di dasbor).
- Chrome yang namanya dikosongkan tetap bekerja, tetapi hanya menerima iklan bertujuan *Akun mana saja*.

> Basis data lama perlu dimutakhirkan sekali: jalankan ulang `skema.sql` di Supabase (bagian bawahnya menambahkan kolom `akun` dan `terbit_akun`, aman diulang).

### Tiga cara menutup formulir (Pengaturan → Cara posting)

| Pilihan | Yang dilakukan ekstensi | Status iklan setelahnya |
|---|---|---|
| **Mode uji** *(pakai saat pertama kali)* | mengisi formulir sampai halaman terakhir, tidak menekan apa pun | kembali **Draf** di dasbor, dengan catatan |
| **Simpan sebagai draf di Facebook** | mengisi formulir lalu memilih **Simpan draf** — iklan tidak tayang | **Draf di Facebook** |
| **Terbitkan langsung** | mengisi formulir lalu menekan *Terbitkan* | **Terbit**, lengkap dengan tautannya |

**Alur draf** cocok bila pemilik akun ingin memeriksa dulu sebelum iklan tayang: komputer penjual cukup membiarkan ekstensi bekerja sesuai jadwal, lalu pemilik membuka **Marketplace → Anda → Draf** di Facebook, memeriksa, dan menekan *Terbitkan* sendiri. Di dasbor, iklan itu berlencana **Draf di Facebook** dan punya tautan *buka draf di FB*.

Catatan: menyimpan draf tetap membuka formulir baru di Facebook, jadi **jeda antar posting dan batas harian tetap dihitung** seperti posting biasa.

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
| "Isian tidak mau terisi" | Terjadi bila teks yang masuk jauh berbeda dari yang dikirim. Pesannya menyebutkan berapa karakter yang masuk. Perbedaan kecil (spasi, baris baru, emoji yang disaring, atau teks dipotong Facebook) tidak lagi dianggap gagal — hanya dicatat sebagai catatan pada hasil. |
| Isian iklan **tertukar** (mis. Model berisi tipe bodi) | Dua sebab. **(1) Pemetaan kolom**: header yang mirip seperti "Varian", "Jenis Bahan Bakar", atau "Warna Interior" dulu bisa tertukar — sekarang tidak, dan cara paling aman adalah memakai **templat sheet** di halaman Impor. Periksa juga tabel pemetaan sebelum menekan Impor. **(2) Formulir Facebook** kadang mengosongkan kolom yang sudah diisi. Ekstensi kini mencocokkan ulang seluruh isian sebelum iklan diterbitkan/disimpan: yang berubah diisi ulang, dan bila masih meleset iklan **tidak jadi dipasang** serta kolomnya disebut pada status Gagal. |
| "Isian tidak sesuai setelah formulir selesai" | Itu penjaga di atas bekerja — iklan sengaja tidak dipasang. Pesannya menyebut kolom, isi yang terbaca, dan isi yang seharusnya. Perbaiki datanya di dasbor (atau pilihan yang tak ada di Facebook), lalu jadwalkan ulang. |
| "Tombol Berikutnya/Terbitkan tidak aktif" | Facebook tidak pernah menyebut kolom mana yang kurang, jadi pesannya kini melampirkan keadaan formulir: **foto terpasang: n**, kolom yang masih kosong, dan isi tiap kolom. Bila tertulis *foto terpasang: 0*, masalahnya di foto (lihat baris berikutnya). Bila ada kolom kosong yang disebut, isi kolom itu di dasbor. |
| "Foto ke-n … bukan berkas gambar" | Sumber fotonya tidak mengeluarkan gambar — paling sering link Google Drive yang belum dibagikan "Siapa saja yang memiliki link", atau link halaman (bukan berkas). Perbaiki pembagiannya, atau unggah fotonya lewat dasbor. |
| "Facebook tidak menawarkan Simpan draf" | Terjadi bila tampilan Facebook tidak menyediakan pilihan draf pada akun itu. Isian **tidak dibuang** — periksa jendela Facebook yang terbuka, simpan/terbitkan manual, lalu pilih **Terbitkan langsung** atau **Mode uji** di Pengaturan. Pesannya menyebutkan pilihan apa saja yang muncul agar bisa ditambahkan ke ekstensi. |
| Status **Diproses** lama | Dasbor menampilkan langkah terakhir. Bila Chrome ditutup di tengah proses, setelah 20 menit iklan ditandai Gagal — cek Marketplace dulu sebelum menjadwalkan ulang agar tidak dobel. |
| "Application error: a server-side exception" | Buka dasbor lagi: penyebabnya kini ditulis di kotak merah **Perlu diperbaiki** di bagian atas halaman. Paling sering: variabel Supabase belum diisi di Vercel, atau `skema.sql` belum dijalankan. Setelah variabel diubah, jangan lupa **Redeploy**. |
| Tombol Simpan/Jadwalkan gagal | Pesannya muncul di halaman (bukan lagi error putih). Bila berbunyi "Supabase belum diatur", isi `SUMBER_DATA`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY` di Vercel lalu Redeploy — disk Vercel hanya-baca sehingga data harus disimpan di Supabase. |
| Google Sheet tidak terbaca | Sheet masih privat. Bagikan “Siapa saja yang memiliki link”, atau pakai Publikasikan ke web → CSV. |
| Formulir Facebook berubah | Buka halaman buat iklan di Chrome → ikon ekstensi → **Rekam formulir halaman ini**; strukturnya tersimpan di riwayat dasbor untuk diperbaiki. |

---

## Untuk pengembang

- `npm run uji` menjalankan pemeriksaan inti + kontrak Supabase + berkas ekstensi (80 + 34 + 33) (CSV/XLSX, impor, aturan iklan, protokol ekstensi) tanpa server dan tanpa akun apa pun; data uji ditulis ke folder sementara.
- `node test/uji-api.js` menguji HTTP terhadap server yang sedang berjalan (`npm run dev`), termasuk alur ekstensi ujung-ke-ujung.
- `node test/uji-supabase.js` menguji adaptor Supabase memakai tiruan yang **membaca skema.sql** dan menolak kolom/tipe yang tidak cocok — menangkap ketidakcocokan kolom tanpa perlu akun Supabase.
- Lapisan data bisa ditukar lewat `SUMBER_DATA`: `supabase` atau `berkas` (folder `./data`). Antarmukanya sama, jadi aplikasi ini bisa dijalankan tanpa Supabase bila perlu.
- Protokol ekstensi: `POST /api/ekstensi` dengan `{kunci, aksi, perangkat}` — `ping`, `ambil`, `foto`, `progres`, `lapor`, `rekam`. Setiap tugas memakai token sekali pakai; `perangkat` adalah nama akun Chrome pengirim (boleh kosong).
- Penanda formulir Facebook (label Indonesia/Inggris) ada di objek `PENANDA` dalam `ekstensi-chrome/isi-formulir.js`.
- Skrip pengisi disuntikkan dua jalur: pendaftaran di manifes (halaman buat iklan) dan `chrome.scripting.executeScript` dari pekerja latar, sehingga tetap jalan bila URL Facebook berbeda dari pola manifes.
- `node test/uji-formulir.js` menjalankan pengisian formulir di Chrome headless terhadap formulir tiruan (butuh puppeteer-core lewat NODE_PATH; sengaja tidak masuk package.json).
