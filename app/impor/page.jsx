import { wajibMasuk } from '../../lib/auth.js';
import { setelanLengkap } from '../../lib/data/index.js';
import Impor from '../../components/Impor.jsx';

export const dynamic = 'force-dynamic';

export default async function HalamanImpor() {
  await wajibMasuk();
  const setelan = await setelanLengkap();
  return (
    <>
      <h1>Impor dari Google Sheet</h1>
      <p className="kecil">Tiap baris stok menjadi satu iklan, dengan jadwal berurutan. Pemetaan kolom ditebak dari nama header.</p>
      <Impor sheetUrl={setelan.sheetUrl} zona={setelan.zona} />
    </>
  );
}
