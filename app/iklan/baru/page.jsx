import { wajibMasuk } from '../../../lib/auth.js';
import { setelanLengkap } from '../../../lib/data/index.js';
import { rapikanIklan } from '../../../lib/iklan.js';
import FormIklan from '../../../components/FormIklan.jsx';

export const dynamic = 'force-dynamic';

export default async function IklanBaru() {
  await wajibMasuk();
  const setelan = await setelanLengkap();
  const kosong = rapikanIklan({ jenis: 'kendaraan', jadwal: new Date(Date.now() + 86400000).toISOString() });
  return (
    <>
      <h1>Iklan baru</h1>
      <p className="kecil">Untuk mobil/motor pilih jenis <b>Kendaraan</b> — Facebook memakai formulir khusus kendaraan.</p>
      <FormIklan iklan={kosong} zona={setelan.zona} />
    </>
  );
}
