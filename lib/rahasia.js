/** Fungsi yang butuh modul Node (hanya boleh dipakai di sisi server). */
import crypto from 'node:crypto';

export const idBaru = () => crypto.randomUUID();
export const tokenBaru = () => crypto.randomBytes(24).toString('hex');
export const tandaTangan = (nilai, rahasia) => crypto.createHmac('sha256', rahasia).update(nilai).digest('hex').slice(0, 32);

/** Perbandingan rahasia yang tidak bocor lewat lama waktu. */
export function samaAman(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
