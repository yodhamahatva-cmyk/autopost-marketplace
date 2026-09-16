-- ===========================================================================
-- AutoPost Iklan — skema Supabase
-- Jalankan sekali di: Supabase → SQL Editor → New query → Run.
--
-- Semua akses dilakukan server (Next.js) memakai SERVICE ROLE KEY.
-- RLS dinyalakan TANPA kebijakan apa pun, sehingga kunci publik (anon) tidak
-- bisa membaca/menulis apa pun. Jangan pernah menaruh service role key di
-- browser atau di variabel NEXT_PUBLIC_*.
-- ===========================================================================

create table if not exists ap_iklan (
  id          uuid primary key,
  kunci       text,                                   -- nomor polisi / ID unit (cegah impor dobel)
  jenis       text not null default 'barang',         -- barang | kendaraan
  judul       text not null default '',
  harga       bigint,
  kategori    text default '',
  kondisi     text default '',
  lokasi      text default '',
  deskripsi   text default '',
  foto        jsonb not null default '{"tipe":"unggahan","berkas":[]}'::jsonb,
  kendaraan   jsonb,
  cara        text not null default 'otomatis',       -- otomatis | manual
  jadwal      timestamptz,
  status      text not null default 'draf',           -- draf|terjadwal|diproses|terbit|gagal|terlewat
  keterangan  text default '',
  langkah     text default '',
  token       text,                                   -- token tugas ekstensi yang sedang berjalan
  klaim       timestamptz,
  hasil_url   text default '',
  sumber      jsonb,
  dibuat      timestamptz not null default now(),
  diubah      timestamptz not null default now()
);

create index if not exists ap_iklan_status_jadwal on ap_iklan (status, jadwal);
create index if not exists ap_iklan_kunci on ap_iklan (kunci);

create table if not exists ap_log (
  id       uuid primary key,
  waktu    timestamptz not null default now(),
  iklan_id uuid references ap_iklan (id) on delete set null,
  jenis    text not null default 'info',
  pesan    text default '',
  data     jsonb
);

create index if not exists ap_log_waktu on ap_log (waktu desc);

create table if not exists ap_setelan (
  kunci  text primary key,
  nilai  jsonb,
  diubah timestamptz not null default now()
);

alter table ap_iklan   enable row level security;
alter table ap_log     enable row level security;
alter table ap_setelan enable row level security;
-- Sengaja tanpa policy: hanya service role (server) yang bisa mengakses.

-- Penyimpanan foto unggahan. Bucket privat: foto dibaca server, lalu dikirim
-- ke ekstensi. Tidak ada URL publik yang bocor.
insert into storage.buckets (id, name, public)
values ('ap-foto', 'ap-foto', false)
on conflict (id) do nothing;
