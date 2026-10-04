import type { ProblemCard } from "./types";

export const trustBarContent = {
  metrics: [
    { value: "1.2jt+", label: "transaksi diproses" },
    { value: "99.9%", label: "sync success rate" },
    { value: "0", label: "data transaksi hilang" },
  ],
  // TODO: Ganti dengan daftar logo klien asli saat peluncuran publik
  clientsPlaceholder: [
    { name: "Klien Retail A", id: "client-a" },
    { name: "Klien Kafe B", id: "client-b" },
    { name: "Klien Resto C", id: "client-c" },
    { name: "Klien Bakery D", id: "client-d" },
    { name: "Klien Bistro E", id: "client-e" },
  ],
} as const;

export const problemContent = {
  heading: "Uang Anda tidak hilang sekaligus. Ia menetes.",
  subheading:
    "Tiga titik ini menyumbang mayoritas kerugian operasional di outlet retail dan F&B.",
  cards: [
    {
      id: 1,
      title: "Selisih laci yang selalu \"salah hitung\"",
      body: "Saat kasir tahu angka yang seharusnya, selisih akan selalu pas — termasuk ketika seharusnya tidak pas.",
      impact: "Rata-rata rugi Rp 1,5 - 4jt / bulan / outlet",
    },
    {
      id: 2,
      title: "Void setelah struk tercetak",
      body: "Transaksi dibatalkan setelah pelanggan pergi. Barang keluar, uang tidak masuk, laporan tetap terlihat rapi.",
      impact: "Celah manipulasi shift tanpa audit",
    },
    {
      id: 3,
      title: "Sinyal hilang, catatan pindah ke kertas",
      body: "Satu jam offline berarti puluhan transaksi yang direkonstruksi dari ingatan di akhir hari.",
      impact: "Potensi salah hitung stok & kebocoran kas",
    },
  ] satisfies ProblemCard[],
} as const;
