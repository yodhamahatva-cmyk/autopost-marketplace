/**
 * Pembaca folder foto di komputer (berjalan di halaman daftar folder file:///…).
 *
 * Dipakai bila iklan memakai sumber foto "Folder di komputer": ekstensi membuka
 * folder itu sebentar di tab tersembunyi, membaca isinya, lalu menutupnya. Foto
 * tidak pernah diunggah ke server mana pun — langsung dari PC ke formulir Facebook.
 * Syarat: pada chrome://extensions ekstensi ini diberi "Izinkan akses ke URL file".
 */
(() => {
  const GAMBAR = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
  const MAKS = 20;

  const mime = (nama) => {
    const ext = nama.toLowerCase().split('.').pop();
    return { png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif' }[ext] || 'image/jpeg';
  };

  /** Daftar berkas gambar pada halaman daftar folder Chrome. */
  function daftarGambar() {
    return [...document.querySelectorAll('a')]
      .map((a) => a.href)
      .filter((h) => h.startsWith('file:') && GAMBAR.test(decodeURIComponent(h)))
      .filter((h, i, semua) => semua.indexOf(h) === i)
      .sort((a, b) => decodeURIComponent(a).localeCompare(decodeURIComponent(b), undefined, { numeric: true, sensitivity: 'base' }))
      .slice(0, MAKS);
  }

  async function bacaSemua() {
    const url = daftarGambar();
    if (!url.length) throw new Error('Tidak ada berkas gambar di folder ini (' + decodeURIComponent(location.pathname) + ').');
    const berkas = [];
    for (const u of url) {
      const res = await fetch(u);
      if (!res.ok) throw new Error('Gagal membaca ' + decodeURIComponent(u.split('/').pop()) + '.');
      const buf = new Uint8Array(await res.arrayBuffer());
      let biner = '';
      for (let i = 0; i < buf.length; i += 8192) biner += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      const nama = decodeURIComponent(u.split('/').pop());
      berkas.push({ nama, mime: mime(nama), data: btoa(biner) });
    }
    return berkas;
  }

  chrome.runtime.onMessage.addListener((m, pengirim, balas) => {
    if (m.jenis !== 'bacaFolder') return false;
    bacaSemua().then((berkas) => balas({ ok: true, berkas }), (e) => balas({ ok: false, galat: e.message }));
    return true; // balasan asinkron
  });

  // Beri tahu pekerja latar bahwa halaman folder siap dibaca.
  chrome.runtime.sendMessage({ jenis: 'folderSiap' }).catch(() => {});
})();
