/**
 * AutoPost Iklan – pengisi formulir Facebook Marketplace (barang & kendaraan).
 *
 * Dimuat di setiap halaman facebook.com/marketplace/create/*, tetapi hanya
 * bekerja bila pekerja latar menyerahkan tugas untuk tab ini (tab yang dibuka
 * ekstensi). Tab Marketplace yang Anda buka sendiri tidak disentuh — kecuali
 * Anda menekan "Rekam formulir" di popup (hanya membaca struktur, tidak mengisi).
 *
 * Bila Facebook mengubah tampilan formulir, cukup perbarui PENANDA di bawah.
 */
(() => {
  if (window.__autopostIklan) return;
  window.__autopostIklan = true;
  const INSTANS = Math.random().toString(36).slice(2);

  const PENANDA = {
    judul: ['Judul', 'Title'],
    harga: ['Harga', 'Price'],
    kategori: ['Kategori', 'Category'],
    kondisi: ['Kondisi', 'Condition'],
    deskripsi: ['Keterangan', 'Deskripsi', 'Description'],
    lokasi: ['Lokasi', 'Location'],
    berikutnya: ['Berikutnya', 'Selanjutnya', 'Lanjutkan', 'Next', 'Continue'],
    terbitkan: ['Terbitkan', 'Publikasikan', 'Posting', 'Publish', 'Post'],
    // ---- simpan sebagai draf (owner menerbitkan sendiri nanti)
    simpanDrafLangsung: ['Simpan draf', 'Simpan sebagai draf', 'Simpan draft', 'Save draft', 'Save as draft'],
    simpanDraf: ['Simpan draf', 'Simpan sebagai draf', 'Simpan draft', 'Save draft', 'Save as draft', 'Simpan', 'Save'],
    tutupFormulir: ['Tutup', 'Close', 'Kembali', 'Back'],
    buang: ['Buang', 'Buang perubahan', 'Hapus', 'Discard', 'Discard changes', 'Delete draft'], // jangan pernah diklik
    kondisiOpsi: {
      'baru': ['Baru', 'New'],
      'bekas - seperti baru': ['Bekas - Seperti Baru', 'Used - Like New'],
      'bekas - baik': ['Bekas - Baik', 'Used - Good'],
      'bekas - cukup baik': ['Bekas - Cukup Baik', 'Used - Fair']
    },
    // ---- formulir kendaraan (marketplace/create/vehicle)
    jenisKendaraan: ['Jenis kendaraan', 'Tipe kendaraan', 'Vehicle type'],
    tahun: ['Tahun', 'Year'],
    merek: ['Merek', 'Merk', 'Make', 'Brand'],
    model: ['Model'],
    jarakTempuh: ['Jarak tempuh', 'Kilometer', 'Odometer', 'Mileage'],
    tipeBodi: ['Tipe body', 'Tipe bodi', 'Gaya bodi', 'Jenis bodi', 'Body style', 'Body type'],
    warna: ['Warna eksterior', 'Warna luar', 'Exterior color', 'Exterior colour', 'Warna'],
    kondisiKendaraan: ['Kondisi kendaraan', 'Vehicle condition'],
    bahanBakar: ['Jenis bahan bakar', 'Bahan bakar', 'Fuel type'],
    transmisi: ['Transmisi', 'Transmission'],
    jenisKendaraanOpsi: {
      'mobil/truk': ['Mobil/Truk', 'Mobil/truk', 'Mobil', 'Car/Truck', 'Car/truck', 'Car'],
      'sepeda motor': ['Sepeda motor', 'Motor', 'Motorcycle']
    },
    transmisiOpsi: {
      'otomatis': ['Transmisi otomatis', 'Otomatis', 'Automatic transmission', 'Automatic'],
      'manual': ['Transmisi manual', 'Manual', 'Manual transmission']
    },
    bahanBakarOpsi: {
      'bensin': ['Bensin', 'Gasoline', 'Petrol', 'Gas'],
      'diesel': ['Diesel', 'Solar'],
      'listrik': ['Listrik', 'Electric'],
      'hibrida': ['Hibrida', 'Hybrid']
    },
    kondisiKendaraanOpsi: {
      'baru': ['Sangat baik', 'Sempurna', 'Excellent'],
      'bekas - seperti baru': ['Sangat baik', 'Sempurna', 'Excellent'],
      'bekas - baik': ['Baik', 'Bagus', 'Good', 'Very good'],
      'bekas - cukup baik': ['Cukup', 'Cukup baik', 'Fair']
    }
  };
  const SELEKTOR_ISIAN = 'input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea, [role="combobox"], [contenteditable="true"]';
  const SELEKTOR_OPSI = '[role="option"], [role="menuitemradio"], [role="menuitem"], [role="listbox"] [role="button"], ' +
    '[role="dialog"] [role="radio"], [role="dialog"] [role="button"]';

  // ---------------------------------------------------------- utilitas

  const jeda = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || '').toLowerCase().replace(/[–—]/g, '-').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const cocok = (nama, varian) => varian.some((v) => { const x = norm(v); return nama === x || nama.startsWith(x + ' ') || nama.startsWith(x + ' ('); });
  const angka = (s) => String(s || '').replace(/\D/g, '');
  const opsiDari = (peta, nilai) => (peta[norm(nilai)] || []).concat([nilai]);

  function terlihat(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const gaya = getComputedStyle(el);
    return gaya.visibility !== 'hidden' && gaya.display !== 'none';
  }

  async function tunggu(fn, ms, pesanGagal) {
    const akhir = Date.now() + ms;
    for (;;) {
      let hasil = null;
      try { hasil = fn(); } catch (e) { hasil = null; }
      if (hasil) return hasil;
      if (Date.now() > akhir) throw new Error(pesanGagal || 'Waktu tunggu habis.');
      await jeda(300);
    }
  }

  function kirim(pesan) {
    return new Promise((ok, gagal) => {
      try {
        chrome.runtime.sendMessage(pesan, (balas) => {
          const g = chrome.runtime.lastError;
          if (g) return gagal(new Error(g.message));
          if (balas && balas.galat) return gagal(new Error(balas.galat));
          ok(balas);
        });
      } catch (e) { gagal(e); }
    });
  }

  /** Nama yang terbaca untuk sebuah isian: aria-label, aria-labelledby, <label>, placeholder. */
  function namaIsian(el) {
    const nama = [];
    const tambah = (t) => { t = norm(t); if (t) nama.push(t); };
    tambah(el.getAttribute('aria-label'));
    (el.getAttribute('aria-labelledby') || '').split(/\s+/).forEach((id) => { const x = id && document.getElementById(id); if (x) tambah(x.textContent); });
    const label = el.closest('label');
    if (label) {
      tambah(label.getAttribute('aria-label'));
      const span = label.querySelector('span');
      if (span) tambah(span.textContent);
      tambah(label.innerText.split('\n')[0]);
    }
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) tambah(l.textContent); }
    tambah(el.getAttribute('placeholder'));
    return nama;
  }

  /**
   * Kata yang tidak boleh ada pada nama kolom untuk penanda tertentu. Tanpa ini
   * "Warna eksterior" bisa mendarat di "Warna Interior" lewat pencocokan awalan.
   */
  const HINDARI = {
    warna: ['interior', 'dalam', 'kabin', 'jok'],
    model: ['tipe body', 'tipe bodi', 'gaya bodi'],
    jenisKendaraan: ['bahan bakar'],
    kondisi: ['kendaraan']
  };

  /** Kolom yang sudah diisi tidak boleh dipakai lagi oleh isian berikutnya. */
  const sudahDipakai = new Set();

  function cariIsian(varian, opsi) {
    opsi = opsi || {};
    const hindari = (opsi.hindari || []).map(norm);
    const semua = [...document.querySelectorAll(SELEKTOR_ISIAN)].filter(terlihat)
      .filter((el) => opsi.ulang || !sudahDipakai.has(el))
      .filter((el) => !hindari.length || !namaIsian(el).some((n) => hindari.some((h) => n.includes(h))));
    // Cocok persis dulu (mis. "Kondisi" jangan tertukar dengan "Kondisi kendaraan"), baru awalan.
    const v = varian.map(norm);
    return semua.find((el) => namaIsian(el).some((n) => v.indexOf(n) >= 0)) ||
      semua.find((el) => namaIsian(el).some((n) => cocok(n, varian))) || null;
  }

  const amanRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function nilaiIsian(el) {
    return el.isContentEditable ? el.innerText.trim() : String(el.value || '');
  }

  /** Nilai yang terlihat pengguna — termasuk dropdown yang bukan <input>. */
  function nilaiTampil(el) {
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return nilaiIsian(el);
    const nama = namaIsian(el)[0] || '';
    return norm(el.innerText || '').replace(new RegExp('^' + amanRegex(nama) + '\\s*'), '').trim();
  }

  /** Cukup sama? Facebook sering menulis ulang (Rp, titik ribuan, "Transmisi otomatis"). */
  function samaNilai(isi, target, hanyaAngka) {
    if (hanyaAngka) return angka(isi) === angka(target);
    const bersih = (s) => norm(s).replace(/[^a-z0-9]/g, '');
    const a = bersih(isi);
    const b = bersih(target);
    if (!b) return true;
    if (!a) return false;
    return a === b || a.includes(b) || b.includes(a);
  }

  /** Samakan teks sebelum dibandingkan: Facebook merapikan spasi, baris baru, dan spasi tak-putus. */
  const samakan = (s) => String(s || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();

  async function isiTeks(el, teks, perbandingan, namaKolom) {
    teks = String(teks);
    el.scrollIntoView({ block: 'center' });
    el.focus();
    await jeda(120);
    if (el.isContentEditable) {
      document.execCommand('selectAll', false, null);
    } else if (typeof el.select === 'function') {
      el.select();
    }
    let berhasil = false;
    try { berhasil = document.execCommand('insertText', false, teks); } catch (e) { berhasil = false; }
    await jeda(200);
    const sama = () => (perbandingan ? perbandingan(nilaiIsian(el), teks) : samakan(nilaiIsian(el)) === samakan(teks));
    if (!berhasil || !sama()) {
      // Cadangan untuk isian React: pakai setter asli agar state komponen ikut berubah.
      if (!el.isContentEditable) {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, teks);
      } else {
        el.textContent = teks;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await jeda(350); // teks panjang butuh waktu lebih lama diproses React
    }
    if (!sama()) {
      // Facebook kadang memotong teks (maxlength) atau menyaring karakter tertentu.
      // Selama bagian awalnya cocok dan hampir seluruhnya masuk, iklan tetap layak diterbitkan.
      const isi = nilaiIsian(el);
      const maks = Number(el.getAttribute('maxlength')) || 0;
      const target = maks ? Math.min(teks.length, maks) : teks.length;
      const awalCocok = norm(isi).slice(0, 30) === norm(teks).slice(0, 30);
      if (norm(isi) === norm(teks)) {
        el.blur();
        return; // hanya beda spasi/baris baru — isinya sama
      }
      if (isi.length && awalCocok && isi.length >= target * 0.9) {
        peringatan.push((namaKolom || 'Isian') + ': terisi ' + isi.length + '/' + teks.length + ' karakter' +
          (maks ? ' (dibatasi Facebook ' + maks + ')' : ' — sebagian karakter disaring Facebook'));
      } else {
        throw new Error('Isian tidak mau terisi — yang masuk ' + isi.length + ' dari ' + teks.length +
          ' karakter: "' + isi.slice(0, 80).replace(/\n/g, ' ⏎ ') + '".');
      }
    }
    el.blur();
  }

  /** Seperti cariTombol, tetapi terbatas pada satu wadah (mis. dialog konfirmasi). */
  function cariTombolDi(wadah, varian) {
    const v = varian.map(norm);
    return [...wadah.querySelectorAll('[role="button"], button')].filter(terlihat).find((b) => {
      const n = norm(b.getAttribute('aria-label') || b.innerText);
      return v.indexOf(n) >= 0;
    }) || null;
  }
  const dialogTerakhir = () => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(terlihat).pop() || null;
  function klikAsli(el) {
    el.scrollIntoView({ block: 'center' });
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((t) => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })));
    el.click();
  }

  function daftarOpsi() {
    return [...document.querySelectorAll(SELEKTOR_OPSI)].filter(terlihat);
  }
  const teksOpsi = (el) => norm(el.getAttribute('aria-label') || el.innerText.split('\n')[0]);

  function opsiCocok(target) {
    const opsi = daftarOpsi();
    const t = target.map(norm).filter(Boolean);
    return opsi.find((el) => t.indexOf(teksOpsi(el)) >= 0) ||
      opsi.find((el) => t.some((x) => teksOpsi(el).startsWith(x))) ||
      opsi.find((el) => t.some((x) => x.length >= 3 && teksOpsi(el).includes(x))) || null;
  }

  function tutupDaftar() {
    const ev = () => new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true });
    (document.activeElement || document.body).dispatchEvent(ev());
    document.dispatchEvent(ev());
  }

  /** Buka dropdown (bila kotak diberikan) lalu klik pilihan yang teksnya cocok. target: daftar varian teks. */
  /** Saran yang bunyinya benar-benar sama (boleh beda huruf besar/kecil & spasi). */
  function opsiSamaPersis(target) {
    const t = target.map(norm).filter(Boolean);
    return daftarOpsi().find((el) => t.indexOf(teksOpsi(el)) >= 0) || null;
  }

  /**
   * Facebook kadang menulis ulang isian (mis. saran "Ayla 1.0 X" untuk ketikan
   * "AYLA 1.0 X"). Untuk kolom seperti Model, tulisan di sheet yang dipakai.
   */
  async function samakanHuruf(el, asli, namaKolom) {
    const kini = nilaiTampil(el);
    if (!kini || kini === asli) return;
    if (norm(kini) !== norm(asli)) return;   // isinya memang beda, bukan sekadar huruf besar/kecil
    try {
      await isiTeks(el, asli, () => true, namaKolom);
      tutupDaftar();
    } catch (e) {
      peringatan.push(namaKolom + ': tulisannya jadi "' + potongTeks(kini, 30) + '" (di sheet "' + potongTeks(asli, 30) + '")');
    }
  }

  async function pilihOpsi(kotak, target, namaKolom) {
    if (kotak) klikAsli(kotak);
    try {
      await tunggu(() => daftarOpsi().length || null, 8000);
    } catch (e) {
      throw new Error('Daftar pilihan ' + namaKolom + ' tidak muncul.');
    }
    await jeda(300);
    const pilih = opsiCocok(target);
    if (!pilih) {
      const ada = [...new Set(daftarOpsi().map((el) => el.innerText.split('\n')[0].trim()).filter(Boolean))].slice(0, 30);
      tutupDaftar();
      throw new Error(namaKolom + ' "' + target[target.length - 1] + '" tidak ada di pilihan Facebook. Pilihan yang tersedia: ' + ada.join(', '));
    }
    klikAsli(pilih);
    await jeda(600);
  }

  /**
   * Isi kolom apa pun bentuknya: kotak teks biasa, kotak teks dengan saran (autocomplete), atau dropdown.
   * nilai: daftar varian (varian terakhir = nilai asli dari sheet). opsi: {wajib, angka, tunggu}
   */
  const peringatan = [];
  async function isiAtauPilih(label, nilai, namaKolom, opsi) {
    opsi = opsi || {};
    const asli = String(nilai[nilai.length - 1]);
    let el = null;
    try {
      el = await tunggu(() => cariIsian(label, { hindari: opsi.hindari, ulang: opsi.ulang }), opsi.tunggu || 5000,
        'Kolom ' + namaKolom + ' tidak ditemukan di formulir.');
    } catch (e) {
      if (opsi.wajib) throw e;
      peringatan.push(namaKolom + ' dilewati (kolom tidak ada)');
      return;
    }
    const bisaKetik = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    const pembanding = opsi.angka ? (v, t) => angka(v) === angka(t) : null;
    try {
      if (bisaKetik && el.getAttribute('role') !== 'combobox' && !el.getAttribute('aria-autocomplete')) {
        await isiTeks(el, asli, pembanding, namaKolom);
        if (opsi.tepat) await samakanHuruf(el, asli, namaKolom);
      } else if (bisaKetik) {
        // Kotak teks dengan saran: ketik, lalu pilih saran yang cocok bila muncul.
        await isiTeks(el, asli, () => true, namaKolom);
        try {
          // Kolom seperti Model harus tetap seperti tulisan di sheet: saran yang
          // bunyinya berbeda (mis. "Ayla" untuk "Ayla 1.0 X") tidak boleh dipakai.
          const cari = opsi.tepat ? () => opsiSamaPersis(nilai) : () => opsiCocok(nilai);
          klikAsli(await tunggu(cari, opsi.tepat ? 2500 : 4000));
          await jeda(500);
        } catch (e) { /* biarkan teks yang diketik */ }
        if (opsi.tepat) await samakanHuruf(el, asli, namaKolom);
      } else {
        await pilihOpsi(el, nilai, namaKolom);
      }
      sudahDipakai.add(el);
      catatIsian({ nama: namaKolom, label, nilai, asli, el, angka: !!opsi.angka, hindari: opsi.hindari });
    } catch (e) {
      if (opsi.wajib) throw e;
      tutupDaftar();
      peringatan.push(e.message);
    }
  }

  // ---------------------------------------------------------- periksa ulang (anti tertukar)

  /**
   * Facebook kadang mengosongkan atau menimpa kolom yang sudah diisi — mis. Model
   * direset setelah Merek berubah. Semua isian direkam agar bisa dicocokkan lagi
   * sebelum iklan diterbitkan/disimpan sebagai draf.
   */
  const rekamIsian = [];
  function catatIsian(x) {
    const lama = rekamIsian.findIndex((r) => r.nama === x.nama);
    if (lama >= 0) rekamIsian[lama] = x; else rekamIsian.push(x);
  }

  function bacaKolom(r) {
    const el = r.el && r.el.isConnected && terlihat(r.el) ? r.el : cariIsian(r.label, { ulang: true, hindari: r.hindari });
    return { el, isi: nilaiTampil(el) };
  }

  async function periksaIsian() {
    await langkah('memeriksa ulang isian');
    const meleset = [];
    for (const r of rekamIsian) {
      const { el, isi } = bacaKolom(r);
      if (samaNilai(isi, r.asli, r.angka)) continue;
      // Sekali perbaikan: paling sering kolomnya dikosongkan sendiri oleh Facebook.
      try {
        sudahDipakai.delete(el);
        await isiAtauPilih(r.label, r.nilai, r.nama, { angka: r.angka, wajib: true, ulang: true });
      } catch (e) { /* alasannya ikut dilaporkan di bawah */ }
      const ulang = bacaKolom(r);
      if (!samaNilai(ulang.isi, r.asli, r.angka)) {
        meleset.push(r.nama + ': ' + (ulang.isi ? 'terbaca "' + potongTeks(ulang.isi, 30) + '"' : 'kosong') +
          ', seharusnya "' + potongTeks(r.asli, 30) + '"');
      } else {
        peringatan.push(r.nama + ' sempat berubah sendiri, sudah diisi ulang');
      }
    }
    if (meleset.length) {
      throw new Error('Isian tidak sesuai setelah formulir selesai — ' + meleset.join(' · ') +
        '. Iklan tidak diteruskan agar tidak terpasang dengan data yang salah.');
    }
  }

  function cariTombol(varian) {
    const v = varian.map(norm);
    return [...document.querySelectorAll('[role="button"], button')].filter(terlihat).find((b) => {
      const n = norm(b.getAttribute('aria-label') || b.innerText);
      return v.indexOf(n) >= 0;
    }) || null;
  }
  const tombolAktif = (b) => b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;

  /** Benarkah isinya gambar? Dicek dari tanda awal berkas (JPEG/PNG/GIF/WEBP/BMP/HEIC). */
  function tandaGambar(bytes) {
    const b = bytes;
    if (b.length < 12) return false;
    if (b[0] === 0xff && b[1] === 0xd8) return true;                                   // JPEG
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // PNG
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;                  // GIF
    if (b[0] === 0x42 && b[1] === 0x4d) return true;                                   // BMP
    const empat = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return empat === 'WEBP' || empat.startsWith('hei') || empat.startsWith('ftyp');     // WEBP / HEIC
  }

  function base64KeFile(f, i) {
    const biner = atob(f.data);
    const bytes = new Uint8Array(biner.length);
    for (let k = 0; k < biner.length; k++) bytes[k] = biner.charCodeAt(k);
    if (!tandaGambar(bytes)) {
      throw new Error('Foto ke-' + (i + 1) + ' (' + (f.nama || 'tanpa nama') + ') bukan berkas gambar yang bisa dibaca' +
        (f.sumber ? ' — sumbernya: ' + f.sumber : '') + '. ' +
        'Bila fotonya memakai link Google Drive, pastikan berkasnya dibagikan "Siapa saja yang memiliki link".');
    }
    const mime = f.mime && /^image\//.test(f.mime) ? f.mime : 'image/jpeg';
    const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const nama = /\.\w{3,4}$/.test(f.nama) ? f.nama : 'foto-' + (i + 1) + '.' + ext;
    return new File([bytes], nama, { type: mime, lastModified: Date.now() });
  }

  // ---------------------------------------------------------- tampilan status di halaman

  let spanduk = null;
  function tampilkan(teks, jenis) {
    if (!spanduk) {
      spanduk = document.createElement('div');
      spanduk.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:12px;transform:translateX(-50%);max-width:min(720px,92vw);' +
        'padding:10px 16px;border-radius:10px;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);pointer-events:none';
      document.documentElement.appendChild(spanduk);
    }
    const warna = { proses: ['#1f3a5f', '#fff'], uji: ['#fef3c7', '#78350f'], gagal: ['#fee2e2', '#7f1d1d'], ok: ['#dcfce7', '#14532d'] }[jenis || 'proses'];
    spanduk.style.background = warna[0];
    spanduk.style.color = warna[1];
    spanduk.textContent = '📣 AutoPost Iklan — ' + teks;
  }

  let langkahKini = 'memulai';
  async function langkah(teks, tambahan) {
    langkahKini = teks;
    tampilkan(teks + ' (jangan tutup jendela ini)');
    try { await kirim(Object.assign({ jenis: 'langkah', teks }, tambahan || {})); } catch (e) { /* abaikan */ }
  }

  function diagnosa(galat) {
    return {
      waktu: new Date().toISOString(), url: location.href, judulHalaman: document.title, galat: galat, peringatan: peringatan.slice(),
      judulBagian: [...document.querySelectorAll('h1, h2, [role="heading"]')].filter(terlihat).slice(0, 10).map((h) => norm(h.innerText).slice(0, 60)),
      fotoTerpasang: hitungFotoTerpasang(),
      isian: [...document.querySelectorAll(SELEKTOR_ISIAN)].filter(terlihat).slice(0, 50).map((el) => ({
        tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '', type: el.getAttribute('type') || '',
        nama: namaIsian(el), nilai: nilaiIsian(el).slice(0, 40) || norm(el.innerText || '').slice(0, 40)
      })),
      tombol: [...document.querySelectorAll('[role="button"], button')].filter(terlihat).slice(0, 80)
        .map((b) => norm(b.getAttribute('aria-label') || b.innerText).slice(0, 50)).filter(Boolean),
      opsi: daftarOpsi().slice(0, 40).map((o) => norm(o.innerText).slice(0, 50)),
      inputFile: [...document.querySelectorAll('input[type=file]')].map((i) => i.accept || '(tanpa accept)')
    };
  }

  /** Rekam struktur formulir + isi setiap dropdown (dibuka lalu ditutup lagi, tidak memilih apa pun). */
  async function rekamFormulir() {
    const d = diagnosa('rekaman manual');
    d.pilihan = {};
    const kotak = [...document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]')]
      .filter((el) => terlihat(el) && el.tagName !== 'INPUT').slice(0, 20);
    for (const k of kotak) {
      const nama = namaIsian(k)[0] || '(tanpa nama)';
      try {
        klikAsli(k);
        await jeda(900);
        d.pilihan[nama] = [...new Set(daftarOpsi().map((o) => o.innerText.split('\n')[0].trim()).filter(Boolean))].slice(0, 80);
      } catch (e) {
        d.pilihan[nama] = ['(gagal dibuka: ' + e.message + ')'];
      }
      tutupDaftar();
      await jeda(400);
      if (daftarOpsi().length) { document.body.click(); await jeda(300); } // klik di luar bila daftar masih terbuka
      if (daftarOpsi().length) { klikAsli(k); await jeda(300); }         // atau klik kotaknya lagi (toggle)
    }
    return d;
  }

  // ---------------------------------------------------------- pelaporan keadaan formulir

  /** Perkiraan jumlah foto yang sudah terpasang di formulir (pratinjau yang tampil). */
  function hitungFotoTerpasang() {
    const pratinjau = [...document.querySelectorAll('img[src^="blob:"], img[src^="data:image"]')].filter(terlihat);
    return pratinjau.length;
  }

  /** [{nama, nilai}] keadaan tiap isian yang terlihat — untuk menjelaskan mengapa tombol masih mati. */
  function keadaanKolom() {
    return [...document.querySelectorAll(SELEKTOR_ISIAN)].filter(terlihat).map((el) => ({
      nama: namaIsian(el)[0] || '(tanpa nama)',
      nilai: (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
        ? String(el.value || '')
        : norm(el.innerText || '').replace(new RegExp('^' + (namaIsian(el)[0] || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '')
    }));
  }

  /** Ringkasan singkat untuk pesan galat: kolom yang masih kosong + jumlah foto. */
  function ringkasKeadaan() {
    const kolom = keadaanKolom();
    const kosong = kolom.filter((k) => !k.nilai.trim() && k.nama !== '(tanpa nama)').map((k) => k.nama);
    const terisi = kolom.filter((k) => k.nilai.trim()).map((k) => k.nama + '=' + potongTeks(k.nilai, 24));
    // Urutan sengaja: yang paling menjelaskan dulu, karena dasbor memotong pesan panjang.
    const bagian = ['foto terpasang: ' + hitungFotoTerpasang()];
    if (kosong.length) bagian.push('kolom masih kosong: ' + kosong.join(', '));
    if (peringatan.length) bagian.push('catatan: ' + peringatan.join('; '));
    if (terisi.length) bagian.push('sudah terisi: ' + potongTeks(terisi.join(', '), 220));
    return bagian.join(' · ');
  }

  const potongTeks = (s, n) => {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  };

  // ---------------------------------------------------------- langkah bersama

  async function unggahFoto(t) {
    await langkah('mengunduh ' + t.jumlahFoto + ' foto');
    const berkas = [];
    for (let i = 0; i < t.jumlahFoto; i++) {
      await langkah('mengunduh foto ' + (i + 1) + '/' + t.jumlahFoto);
      berkas.push(base64KeFile(await kirim({ jenis: 'foto', i }), i));
    }
    await langkah('mengunggah ' + berkas.length + ' foto');
    const inputFoto = await tunggu(() => [...document.querySelectorAll('input[type=file]')]
      .find((x) => /image/.test(x.accept || '') || x.multiple), 10000, 'Tombol unggah foto tidak ditemukan.');
    const dt = new DataTransfer();
    berkas.forEach((f) => dt.items.add(f));
    inputFoto.files = dt.files;
    inputFoto.dispatchEvent(new Event('input', { bubbles: true }));
    inputFoto.dispatchEvent(new Event('change', { bubbles: true }));
    // Tunggu pratinjaunya muncul: bila Facebook tidak menerima fotonya, tombol Berikutnya
    // akan tetap mati dan penyebabnya sulit ditebak, jadi lebih baik ketahuan di sini.
    try {
      await tunggu(() => hitungFotoTerpasang() >= 1, 25000);
      await jeda(1200 + 500 * berkas.length); // beri waktu foto lain ikut terunggah
    } catch (e) {
      peringatan.push('pratinjau foto tidak terdeteksi (mungkin hanya tampilannya berbeda)');
      await jeda(2000 + 800 * berkas.length);
    }
  }

  async function isiHarga(t) {
    await langkah('mengisi harga');
    const el = await tunggu(() => cariIsian(PENANDA.harga), 8000, 'Kolom Harga tidak ditemukan.');
    await isiTeks(el, String(t.harga), (nilai, teks) => angka(nilai) === angka(teks), 'Harga');
    sudahDipakai.add(el);
    catatIsian({ nama: 'Harga', label: PENANDA.harga, nilai: [String(t.harga)], asli: String(t.harga), el, angka: true });
  }

  async function isiDeskripsiLokasi(t) {
    if (t.deskripsi) {
      await langkah('mengisi deskripsi');
      const desk = await tunggu(() => cariIsian(PENANDA.deskripsi), 5000, 'Kolom Deskripsi tidak ditemukan.');
      await isiTeks(desk, t.deskripsi, null, 'Deskripsi');
      sudahDipakai.add(desk);
      catatIsian({ nama: 'Deskripsi', label: PENANDA.deskripsi, nilai: [t.deskripsi], asli: t.deskripsi, el: desk });
    }
    if (t.lokasi) {
      await langkah('mengisi lokasi');
      const lok = cariIsian(PENANDA.lokasi);
      if (lok) {
        await isiTeks(lok, t.lokasi, () => true, 'Lokasi');
        try {
          const saran = await tunggu(() => [...document.querySelectorAll('[role="option"]')].filter(terlihat)[0] || null, 6000);
          klikAsli(saran);
          await jeda(600);
        } catch (e) { peringatan.push('Lokasi: saran tidak muncul, memakai lokasi bawaan akun'); }
      }
    }
  }

  async function isiBarang(t) {
    await langkah('menunggu formulir');
    const judulEl = await tunggu(() => cariIsian(PENANDA.judul), 30000,
      'Formulir Buat Tawaran tidak ditemukan (kolom Judul tidak muncul). Bila ini iklan mobil/motor, isi kolom kendaraan di sheet.');
    await unggahFoto(t);
    await langkah('mengisi judul');
    await isiTeks(cariIsian(PENANDA.judul) || judulEl, t.judul, null, 'Judul');
    await isiHarga(t);
    if (t.kategori) {
      await langkah('memilih kategori');
      const jalur = t.kategori.split('>').map((x) => x.trim()).filter(Boolean);
      const kotak = await tunggu(() => cariIsian(PENANDA.kategori), 5000, 'Kolom Kategori tidak ditemukan.');
      // "Induk > Anak": subkategori dipilih dari daftar lanjutan yang muncul setelah induk diklik.
      for (let i = 0; i < jalur.length; i++) {
        await pilihOpsi(i === 0 ? kotak : null, [jalur[i]], i === 0 ? 'Kategori' : 'Subkategori');
      }
    }
    if (t.kondisi) {
      await langkah('memilih kondisi');
      const kotak = await tunggu(() => cariIsian(PENANDA.kondisi), 5000, 'Kolom Kondisi tidak ditemukan.');
      await pilihOpsi(kotak, opsiDari(PENANDA.kondisiOpsi, t.kondisi), 'Kondisi');
    }
    await isiDeskripsiLokasi(t);
  }

  async function isiKendaraan(t) {
    const k = t.kendaraan || {};
    await langkah('menunggu formulir kendaraan');
    await tunggu(() => cariIsian(PENANDA.jenisKendaraan) || cariIsian(PENANDA.tahun), 30000,
      'Formulir kendaraan tidak ditemukan (kolom "Jenis kendaraan" tidak muncul).');
    if (cariIsian(PENANDA.jenisKendaraan)) {
      await langkah('memilih jenis kendaraan');
      await isiAtauPilih(PENANDA.jenisKendaraan, opsiDari(PENANDA.jenisKendaraanOpsi, k.jenis || 'Mobil/Truk'), 'Jenis kendaraan', { wajib: true, hindari: HINDARI.jenisKendaraan });
      await jeda(1500); // kolom lain muncul setelah jenis kendaraan dipilih
    }
    await unggahFoto(t);
    await langkah('memilih tahun');
    await isiAtauPilih(PENANDA.tahun, [String(k.tahun)], 'Tahun', { wajib: true, tunggu: 10000 });
    await langkah('mengisi merek');
    await isiAtauPilih(PENANDA.merek, [k.merek], 'Merek', { wajib: true });
    await langkah('mengisi model');
    await isiAtauPilih(PENANDA.model, [k.model], 'Model', { wajib: true, hindari: HINDARI.model, tepat: true });
    if (k.jarakTempuh !== null && k.jarakTempuh !== undefined && k.jarakTempuh !== '') {
      await langkah('mengisi jarak tempuh');
      await isiAtauPilih(PENANDA.jarakTempuh, [String(k.jarakTempuh)], 'Jarak tempuh', { angka: true, wajib: true });
    }
    await isiHarga(t);
    // Tipe body & Warna eksterior wajib di formulir kendaraan Facebook Indonesia.
    if (k.tipeBodi) { await langkah('memilih tipe body'); await isiAtauPilih(PENANDA.tipeBodi, [k.tipeBodi], 'Tipe body', { wajib: true }); }
    if (k.warna) { await langkah('memilih warna eksterior'); await isiAtauPilih(PENANDA.warna, [k.warna], 'Warna eksterior', { wajib: true, hindari: HINDARI.warna }); }
    if (t.kondisi) { await langkah('memilih kondisi kendaraan'); await isiAtauPilih(PENANDA.kondisiKendaraan, opsiDari(PENANDA.kondisiKendaraanOpsi, t.kondisi), 'Kondisi kendaraan'); }
    if (k.bahanBakar) { await langkah('memilih bahan bakar'); await isiAtauPilih(PENANDA.bahanBakar, opsiDari(PENANDA.bahanBakarOpsi, k.bahanBakar), 'Bahan bakar'); }
    if (k.transmisi) { await langkah('memilih transmisi'); await isiAtauPilih(PENANDA.transmisi, opsiDari(PENANDA.transmisiOpsi, k.transmisi), 'Transmisi'); }
    await isiDeskripsiLokasi(t);
  }

  // ---------------------------------------------------------- simpan sebagai draf

  /**
   * Menyimpan iklan sebagai draf Marketplace tanpa menerbitkannya.
   * Dua jalur: tombol "Simpan draf" bila Facebook menyediakannya di formulir, atau
   * menutup formulir lalu memilih "Simpan draf" pada dialog yang muncul.
   * Tombol "Buang" tidak pernah disentuh — lebih baik gagal daripada isian hilang.
   */
  async function simpanDraf() {
    await langkah('menyimpan sebagai draf');
    const langsung = cariTombol(PENANDA.simpanDrafLangsung);
    if (tombolAktif(langsung)) {
      klikAsli(langsung);
    } else {
      const tutup = cariTombol(PENANDA.tutupFormulir);
      if (tutup) klikAsli(tutup);
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      const tombol = await tunggu(() => {
        const dlg = dialogTerakhir();
        if (!dlg) return null;
        const b = cariTombolDi(dlg, PENANDA.simpanDraf);
        return tombolAktif(b) ? b : null;
      }, 15000, null).catch(() => {
        const dlg = dialogTerakhir();
        const pilihan = dlg
          ? [...dlg.querySelectorAll('[role="button"], button')].filter(terlihat).map((b) => norm(b.getAttribute('aria-label') || b.innerText)).filter(Boolean).slice(0, 8)
          : [];
        throw new Error('Facebook tidak menawarkan "Simpan draf" saat formulir ditutup. ' +
          (pilihan.length ? 'Pilihan yang muncul: ' + pilihan.join(', ') + '. ' : 'Tidak ada dialog yang muncul. ') +
          'Isian tidak dibuang; periksa jendela Facebook, atau pakai "Terbitkan langsung" di Pengaturan.');
      });
      klikAsli(tombol);
    }
    // Draf dianggap tersimpan bila Facebook sudah menutup formulirnya.
    await tunggu(() => !/\/marketplace\/create/.test(location.pathname) || !dialogTerakhir(), 20000,
      'Sudah memilih "Simpan draf", tetapi Facebook belum menutup formulirnya dalam 20 detik.');
    await jeda(1500);
  }

  // ---------------------------------------------------------- alur utama

  let sedangJalan = false;

  async function jalankan(t) {
    sedangJalan = true;
    let terbitDiklik = false;
    try {
      if (/\/login|checkpoint/.test(location.pathname) || document.querySelector('input[name="pass"]')) {
        throw new Error('Chrome ini belum login Facebook (atau Facebook meminta verifikasi). Login dulu, lalu jadwalkan ulang.');
      }
      if (t.jenis === 'kendaraan') await isiKendaraan(t);
      else await isiBarang(t);

      // Cocokkan lagi semua isian sebelum apa pun disimpan/diterbitkan.
      await periksaIsian();

      // Mode draf: berhenti di sini, iklan disimpan tetapi tidak diterbitkan.
      if (t.draf) {
        await langkah('memeriksa kelengkapan formulir');
        const lengkap = await tunggu(() => tombolAktif(cariTombol(PENANDA.terbitkan)) || tombolAktif(cariTombol(PENANDA.berikutnya)), 25000, null)
          .then(() => true).catch(() => false);
        // Draf yang belum lengkap tetap berguna: pemilik bisa melengkapinya sendiri sebelum menerbitkan.
        if (!lengkap) peringatan.push('draf disimpan walau tombol Berikutnya/Terbitkan belum aktif — ' + ringkasKeadaan());
        await simpanDraf();
        tampilkan('Tersimpan sebagai draf 📝 — terbitkan sendiri lewat Marketplace → Anda → Draf.', 'ok');
        await kirim({
          jenis: 'hasil', hasil: 'draf',
          pesan: (lengkap ? 'Formulir terisi lengkap dan disimpan sebagai draf.' : 'Disimpan sebagai draf, tetapi belum lengkap.') +
            (peringatan.length ? ' Catatan: ' + peringatan.join('; ') : '')
        });
        return;
      }

      // Berikutnya → … → Terbitkan
      for (let putaran = 0; putaran < 4; putaran++) {
        await langkah('menunggu tombol Berikutnya/Terbitkan aktif');
        const tombol = await tunggu(() => {
          const pub = cariTombol(PENANDA.terbitkan);
          if (tombolAktif(pub)) return { jenis: 'terbit', el: pub };
          const lanjut = cariTombol(PENANDA.berikutnya);
          if (tombolAktif(lanjut)) return { jenis: 'lanjut', el: lanjut };
          return null;
        }, 25000, null).catch(() => {
          // Facebook tidak pernah memberi tahu kolom mana yang kurang, jadi laporkan keadaan formulir apa adanya.
          throw new Error('Tombol Berikutnya/Terbitkan tidak aktif — ada kolom wajib yang belum terisi atau ditolak Facebook. ' +
            'Keadaan formulir saat itu → ' + ringkasKeadaan());
        });

        if (tombol.jenis === 'lanjut') {
          klikAsli(tombol.el);
          await jeda(2500);
          continue;
        }
        if (t.uji) {
          tampilkan('MODE UJI: formulir sudah terisi sampai tombol Terbitkan, tetapi TIDAK diterbitkan. Periksa isinya lalu tutup jendela ini.', 'uji');
          await kirim({ jenis: 'hasil', hasil: 'uji', pesan: 'Formulir terisi sampai tombol Terbitkan.' + (peringatan.length ? ' Catatan: ' + peringatan.join('; ') : '') });
          return;
        }
        await langkah('menerbitkan', { terbitDiklik: true });
        terbitDiklik = true;
        klikAsli(tombol.el);
        await tunggu(() => !/\/marketplace\/create/.test(location.pathname) || !terlihat(tombol.el), 60000,
          'Sudah menekan Terbitkan, tetapi Facebook belum mengonfirmasi dalam 60 detik.');
        const pesanFb = [...document.querySelectorAll('[role="alert"]')].filter(terlihat).map((x) => x.innerText.trim()).filter(Boolean);
        if (pesanFb.length && /\/marketplace\/create/.test(location.pathname)) throw new Error('Facebook menampilkan pesan: ' + pesanFb.join(' | '));
        tampilkan('Iklan terbit ✅', 'ok');
        await kirim({ jenis: 'hasil', hasil: 'terbit', url: location.href });
        return;
      }
      throw new Error('Tombol Terbitkan tidak ditemukan setelah beberapa halaman.');
    } catch (e) {
      const pesan = 'Langkah "' + langkahKini + '": ' + e.message;
      tampilkan('Gagal — ' + pesan, 'gagal');
      try {
        await kirim({ jenis: 'hasil', hasil: 'gagal', pesan, pasti: !terbitDiklik, diagnosa: diagnosa(pesan) });
      } catch (x) { /* pekerja latar tidak terjangkau */ }
    } finally {
      sedangJalan = false;
    }
  }

  // Pesan dari pekerja latar (pemeriksa hidup-mati) dan dari popup (Rekam formulir).
  chrome.runtime.onMessage.addListener((m, pengirim, balas) => {
    if (m.jenis === 'hidup') { balas(sedangJalan); return false; }
    if (m.jenis === 'rekam') {
      rekamFormulir().then(balas, (e) => balas({ galat: e.message }));
      return true;
    }
    return false;
  });

  // Tanyakan ke pekerja latar apakah tab ini membawa tugas (beberapa kali, karena tab bisa lebih cepat siap).
  (async () => {
    for (let i = 0; i < 8; i++) {
      let t = null;
      try { t = await kirim({ jenis: 'halo', instans: INSTANS }); } catch (e) { t = null; }
      if (t) return jalankan(t);
      await jeda(1000);
    }
  })();

  window.__autopostUji = { norm, cocok, namaIsian, cariIsian, cariTombol, rekamFormulir, PENANDA };
})();
