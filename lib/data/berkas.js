/**
 * Penyimpanan berkas lokal — dipakai untuk pengembangan & pengujian, dan bisa
 * dipakai bila klien ingin menjalankan aplikasi ini di komputernya sendiri.
 * Semua data di folder DATA_DIR (bawaan: ./data).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { idBaru } from '../rahasia.js';

const AKAR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const BERKAS = { setelan: 'setelan.json', iklan: 'iklan.json', log: 'log.json' };

let antre = Promise.resolve();
/** Semua tulis dijalankan berurutan agar tidak saling menimpa. */
const berurutan = (fn) => (antre = antre.then(fn, fn));

async function baca(nama, bawaan) {
  try {
    return JSON.parse(await fs.readFile(path.join(AKAR, BERKAS[nama]), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return bawaan;
    throw e;
  }
}

async function tulis(nama, isi) {
  await fs.mkdir(AKAR, { recursive: true });
  const tujuan = path.join(AKAR, BERKAS[nama]);
  const sementara = tujuan + '.tmp';
  await fs.writeFile(sementara, JSON.stringify(isi, null, 2));
  await fs.rename(sementara, tujuan); // ganti utuh, tidak ada keadaan setengah tertulis
}

export function buatPenyimpananBerkas() {
  return {
    jenis: 'berkas',

    async setelan() {
      return baca('setelan', {});
    },
    async simpanSetelan(patch) {
      return berurutan(async () => {
        const lama = await baca('setelan', {});
        const baru = { ...lama, ...patch };
        await tulis('setelan', baru);
        return baru;
      });
    },

    async daftarIklan({ status, cari, batas = 500 } = {}) {
      const semua = await baca('iklan', []);
      const q = String(cari || '').toLowerCase();
      return semua
        .filter((x) => (!status || x.status === status))
        .filter((x) => !q || [x.judul, x.kunci, x.deskripsi, x.kendaraan?.merek, x.kendaraan?.model]
          .some((v) => String(v || '').toLowerCase().includes(q)))
        .sort((a, b) => String(a.jadwal || a.dibuat).localeCompare(String(b.jadwal || b.dibuat)))
        .slice(0, batas);
    },
    async ambilIklan(id) {
      return (await baca('iklan', [])).find((x) => x.id === id) || null;
    },
    async kunciTerpakai() {
      return (await baca('iklan', [])).map((x) => x.kunci).filter(Boolean);
    },
    async simpanIklan(iklan) {
      return berurutan(async () => {
        const semua = await baca('iklan', []);
        const id = iklan.id || idBaru();
        const i = semua.findIndex((x) => x.id === id);
        const baru = { ...iklan, id };
        if (i >= 0) semua[i] = { ...semua[i], ...baru };
        else semua.push(baru);
        await tulis('iklan', semua);
        return baru;
      });
    },
    async simpanBanyak(daftar) {
      return berurutan(async () => {
        const semua = await baca('iklan', []);
        const baru = daftar.map((x) => ({ ...x, id: x.id || idBaru() }));
        await tulis('iklan', semua.concat(baru));
        return baru;
      });
    },
    async hapusIklan(id) {
      return berurutan(async () => {
        const semua = await baca('iklan', []);
        await tulis('iklan', semua.filter((x) => x.id !== id));
        await fs.rm(path.join(AKAR, 'foto', id), { recursive: true, force: true });
        return true;
      });
    },

    async tambahLog(baris) {
      return berurutan(async () => {
        const semua = await baca('log', []);
        semua.push({ id: idBaru(), waktu: new Date().toISOString(), ...baris });
        await tulis('log', semua.slice(-2000));
        return true;
      });
    },
    async daftarLog(batas = 50) {
      return (await baca('log', [])).slice(-batas).reverse();
    },

    async simpanFoto(iklanId, berkasBaru) {
      const dir = path.join(AKAR, 'foto', iklanId);
      await fs.mkdir(dir, { recursive: true });
      const hasil = [];
      for (const f of berkasBaru) {
        const id = idBaru();
        const nama = String(f.nama || 'foto.jpg').replace(/[^\w.\- ]+/g, '_');
        await fs.writeFile(path.join(dir, id + '__' + nama), Buffer.from(f.data));
        hasil.push({ id, nama, mime: f.mime || 'image/jpeg', ukuran: Buffer.from(f.data).length });
      }
      return hasil;
    },
    async bacaFoto(iklanId, fotoId) {
      const dir = path.join(AKAR, 'foto', iklanId);
      const isi = await fs.readdir(dir).catch(() => []);
      const nama = isi.find((n) => n.startsWith(fotoId + '__'));
      if (!nama) throw new Error('Foto tidak ditemukan.');
      return { nama: nama.slice(fotoId.length + 2), data: await fs.readFile(path.join(dir, nama)) };
    },
    async hapusFoto(iklanId, fotoId) {
      const dir = path.join(AKAR, 'foto', iklanId);
      const isi = await fs.readdir(dir).catch(() => []);
      const nama = isi.find((n) => n.startsWith(fotoId + '__'));
      if (nama) await fs.rm(path.join(dir, nama), { force: true });
      return true;
    }
  };
}
