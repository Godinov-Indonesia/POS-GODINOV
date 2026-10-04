import type { PillarItem } from "./types";

export const pillarsContent = [
  {
    id: 1,
    title: "1. Ketahanan",
    headline: "Tidak bergantung pada sinyal",
    body: "Transaksi tersimpan di perangkat, antre otomatis, dan terkirim sendiri saat koneksi pulih. Nol transaksi hilang.",
  },
  {
    id: 2,
    title: "2. Integritas Kas",
    headline: "Kasir tidak pernah lihat angka targetnya",
    body: "Blind Closing memaksa hitungan fisik dilakukan jujur. Sistem yang membuka selisihnya, bukan kasir.",
  },
  {
    id: 3,
    title: "3. Kontrol",
    headline: "Setiap pembatalan meninggalkan jejak",
    body: "Void wajib alasan dan otorisasi supervisor. Riwayatnya tercatat permanen di audit trail.",
  },
  {
    id: 4,
    title: "4. Kejelasan",
    headline: "Laporan yang bisa ditindak, bukan ditebak",
    body: "Selisih shift, waste, dan stock opname masuk satu laporan lintas outlet.",
  },
] satisfies PillarItem[];
