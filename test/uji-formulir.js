/**
 * Uji ekstensi-chrome/isi-formulir.js terhadap test/formulir-tiruan.html di Chrome sungguhan (headless).
 * Tidak menyentuh Facebook. File disajikan lewat intersepsi permintaan, tanpa server.
 *
 *   npm i puppeteer-core            (sekali, di folder mana pun; atur NODE_PATH bila di luar repo)
 *   set CHROME=C:\...\chrome.exe    (opsional; bawaan mencari Chrome/Edge terpasang)
 *   node test/uji-formulir.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// puppeteer-core sengaja tidak masuk package.json (hanya perkakas uji, tidak perlu ikut terpasang di Vercel).
// Pasang sekali di mana saja lalu tunjuk lewat NODE_PATH, mis.:
//   npm i puppeteer-core   lalu   set NODE_PATH=<folder itu>/node_modules
const puppeteer = createRequire(import.meta.url)('puppeteer-core');

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((p) => fs.existsSync(p));

let lulus = 0;
let gagal = 0;
function cek(kondisi, label, info) {
  if (kondisi) { lulus++; console.log('  ✔ ' + label); } else { gagal++; console.log('  ✘ ' + label + (info !== undefined ? '  → ' + JSON.stringify(info) : '')); }
}

async function buka(browser, jalur) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1400 });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    let f = null;
    let tipe = 'text/html; charset=utf-8';
    if (u.pathname.startsWith('/repo/')) { f = path.join(AKAR, u.pathname.slice(6)); tipe = 'text/javascript; charset=utf-8'; }
    else if (u.pathname.startsWith('/marketplace/')) f = path.join(AKAR, 'test/formulir-tiruan.html');
    if (f && fs.existsSync(f)) req.respond({ status: 200, contentType: tipe, body: fs.readFileSync(f) });
    else req.respond({ status: 404, body: '404' });
  });
  page.on('pageerror', (e) => console.log('    [galat halaman] ' + e.message));
  await page.goto('http://uji.lokal' + jalur);
  return page;
}

async function tungguHasil(page, ms) {
  await page.waitForFunction(() => window.__hasil, { timeout: ms, polling: 250 }).catch(() => {});
  return page.evaluate(() => ({
    hasil: window.__hasil && { hasil: window.__hasil.hasil, pesan: window.__hasil.pesan, pasti: window.__hasil.pasti, diagnosa: !!window.__hasil.diagnosa },
    state: window.__state || null, terbitDiklik: !!window.__terbitDiklik, path: location.pathname, langkah: window.__langkah
  }));
}

(async () => {
  if (!CHROME) { console.log('Chrome/Edge tidak ditemukan — atur variabel CHROME.'); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
  try {
    console.log('■ Formulir barang');
    let p = await buka(browser, '/marketplace/create/item?skenario=uji');
    let r = await tungguHasil(p, 45000);
    cek(r.hasil && r.hasil.hasil === 'uji' && !r.terbitDiklik, 'mode uji: terisi sampai Terbitkan, tidak diklik', r.hasil);
    cek(r.state && r.state.foto === 2 && r.state.harga === '350000' && r.state.kategori === 'Perabotan' && r.state.kondisi === 'Bekas - Baik' && /Situbondo/.test(r.state.lokasi), 'semua isian barang masuk state formulir', r.state);
    await p.close();

    p = await buka(browser, '/marketplace/create/item?skenario=terbit');
    r = await tungguHasil(p, 60000);
    cek(r.hasil && r.hasil.hasil === 'terbit' && r.terbitDiklik && r.path === '/marketplace/you/selling', 'terbit barang', r.hasil);
    await p.close();

    p = await buka(browser, '/marketplace/create/item?skenario=kategori-salah');
    r = await tungguHasil(p, 45000);
    cek(r.hasil && r.hasil.hasil === 'gagal' && r.hasil.pasti && /Langkah "memilih kategori".*Pilihan yang tersedia: Perabotan/.test(r.hasil.pesan) && r.hasil.diagnosa, 'kategori salah → gagal + langkah + pilihan + diagnosa', r.hasil);
    await p.close();

    p = await buka(browser, '/marketplace/create/item?skenario=subkategori');
    r = await tungguHasil(p, 60000);
    cek(r.hasil && r.hasil.hasil === 'terbit' && r.state && r.state.kategori === 'Rumah & Taman > Perabotan', 'subkategori "Induk > Anak"', r.state && r.state.kategori);
    await p.close();

    p = await buka(browser, '/marketplace/create/item?skenario=login');
    r = await tungguHasil(p, 15000);
    cek(r.hasil && r.hasil.hasil === 'gagal' && /belum login/.test(r.hasil.pesan), 'halaman login terdeteksi', r.hasil);
    await p.close();

    p = await buka(browser, '/marketplace/create/item?skenario=bukan-tugas');
    await new Promise((ok) => setTimeout(ok, 9500));
    r = await p.evaluate(() => ({ hasil: window.__hasil, langkah: window.__langkah.length, judul: (document.querySelector('[data-k=judul]') || {}).value }));
    cek(!r.hasil && r.langkah === 0 && r.judul === '', 'tab Marketplace milik pengguna tidak disentuh', r);
    const hidup = await p.evaluate(() => new Promise((ok) => window.__pendengar({ jenis: 'hidup' }, {}, ok)));
    cek(hidup === false, 'pemeriksa hidup-mati: tab tanpa tugas menjawab false');
    await p.close();

    console.log('■ Formulir kendaraan');
    p = await buka(browser, '/marketplace/create/vehicle?skenario=kendaraan');
    r = await tungguHasil(p, 60000);
    cek(r.hasil && r.hasil.hasil === 'uji' && !r.terbitDiklik, 'kendaraan mode uji: terisi sampai Terbitkan', r.hasil);
    const s = r.state || {};
    cek(s.jenis === 'Mobil/Truk' && s.tahun === '2025' && s.merek === 'Daihatsu' && s.model === 'Ayla 1.0 X' && s.jarak === '15770' && s.harga === '156400000',
      'jenis, tahun, merek, model, jarak tempuh, harga terisi', s);
    cek(s.body === 'Hatchback' && s.warna === 'Kuning' && s.warnaDalam === '' && s.kondisi === 'Baik' && s.bbm === 'Bensin' && s.transmisi === 'Transmisi otomatis' && s.foto === 3 && /siap pakai/.test(s.deskripsi),
      'tipe body, warna eksterior (bukan Warna Interior), kondisi, bahan bakar, transmisi, 3 foto, deskripsi ("Keterangan")', s);
    cek(r.langkah.indexOf('memilih jenis kendaraan') >= 0 && r.langkah.indexOf('mengisi jarak tempuh') >= 0, 'langkah kendaraan dilaporkan', r.langkah);
    await p.close();

    p = await buka(browser, '/marketplace/create/vehicle?skenario=kendaraan-terbit');
    r = await tungguHasil(p, 60000);
    cek(r.hasil && r.hasil.hasil === 'terbit' && r.terbitDiklik, 'kendaraan terbit', r.hasil);
    await p.close();

    p = await buka(browser, '/marketplace/create/vehicle?skenario=kendaraan-merek-salah');
    r = await tungguHasil(p, 60000);
    cek(r.hasil && r.hasil.hasil === 'gagal' && /Langkah "mengisi merek".*Merek "Wuling Xyz" tidak ada.*Daihatsu/.test(r.hasil.pesan), 'merek tak dikenal → gagal dengan daftar merek Facebook', r.hasil);
    await p.close();

    console.log('■ Rekam formulir');
    p = await buka(browser, '/marketplace/create/vehicle?skenario=rekam');
    await p.waitForFunction(() => document.getElementById('kJenis'), { timeout: 10000 });
    await p.click('#kJenis');
    await p.waitForFunction(() => [...document.querySelectorAll('[role=option]')].length, { timeout: 5000 });
    await p.evaluate(() => [...document.querySelectorAll('[role=option]')].find((o) => o.textContent === 'Mobil/Truk').click());
    await p.waitForFunction(() => document.getElementById('kTahun'), { timeout: 5000 });
    const d = await p.evaluate(() => new Promise((ok) => window.__pendengar({ jenis: 'rekam' }, {}, ok)));
    cek(d && d.pilihan && (d.pilihan.merek || []).indexOf('Daihatsu') >= 0 && (d.pilihan.transmisi || []).indexOf('Transmisi otomatis') >= 0, 'rekam: isi dropdown Merek & Transmisi terekam', d && Object.keys(d.pilihan || {}));
    cek(d && d.isian.some((x) => x.nama.indexOf('jarak tempuh') >= 0) && !(await p.evaluate(() => document.querySelectorAll('[role=listbox]').length)), 'rekam: kolom teks terekam & semua dropdown tertutup lagi');
    const tetap = await p.evaluate(() => document.querySelector('#kMerek .nilai').textContent);
    cek(tetap === '', 'rekam tidak memilih/mengisi apa pun', tetap);
    await p.close();
  } finally {
    await browser.close();
  }
  console.log('\n' + (gagal ? '❌' : '✅') + ' ' + lulus + ' lulus, ' + gagal + ' gagal');
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
