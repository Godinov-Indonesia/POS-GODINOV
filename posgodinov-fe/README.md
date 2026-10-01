# POS-GODINOV Admin Dashboard

Aplikasi web dashboard manajemen bisnis dan inventaris untuk pemilik bisnis (Business Owner) pada sistem POS-GODINOV. Proyek ini didedikasikan secara eksklusif untuk pengelolaan gerai, staf, katalog produk, stok bahan baku (dual-stock), dan siklus stock opname.

---

## ⚡ Fitur Utama & Modul

1. **Dashboard Eksekutif**:
   - Ringkasan pendapatan harian/bulanan, transaksi penjualan, dan statistik performa outlet.
   - Onboarding panduan langkah setup bisnis.

2. **Manajemen Outlet & Staf**:
   - Pendaftaran dan pengelolaan cabang (outlet).
   - Pengelolaan akun staf/kasir per outlet: peran (*role*), hak akses operasional kasir (*permissions*), dan transfer/mutasi staf antar outlet.
   - Penyediaan informasi *provisioning* dan *serial tenant* untuk menghubungkan perangkat kasir.

3. **Katalog Produk & Resep**:
   - Pengelompokan kategori menu per outlet.
   - Manajemen produk, harga jual, dan status ketersediaan.
   - Penyusun resep produk (*Bill of Materials*) yang mengikat menu ke bahan baku untuk pemotongan stok otomatis.
   - Impor massal produk via format CSV.

4. **Inventaris Bahan Baku (Dual-Stock)**:
   - Pencatatan stok dua dimensi: **Kemasan Utuh** (`package_stock`) dan **Eceran Terbuka** (`loose_stock`), dengan konversi otomatis ke satuan dasar.
   - **Restock**: Pencatatan pembelian bahan baku masuk per kemasan/eceran dengan pembaruan otomatis rata-rata bergerak HPP (*moving average*).
   - **Waste**: Pencatatan bahan baku rusak, tumpah, atau kedaluwarsa dengan alasan operasional.

5. **Stock Opname (SO)**:
   - Pembuatan jadwal audit fisik: cakupan semua bahan baku, per kategori, atau pilihan manual.
   - Pengawasan status audit fisik: `Draft` → `Sedang Dihitung` → `Menunggu Review` → `Disetujui/Ditolak`.
   - Pemantauan progres penghitungan fisik oleh staf di outlet.
   - Review lembar agregasi hitungan fisik, perbandingan terhadap stok sistem, nilai selisih stok, serta penanda selisih kritis (*fraud flag*).
   - Persetujuan penyesuaian stok (*Approve*), penolakan form (*Reject*), atau pembukaan siklus hitung ulang (*Recount*).

6. **Laporan & Rekonsiliasi**:
   - Laporan transaksi penjualan berdasarkan rentang tanggal.
   - Laporan pergerakan stok: riwayat restock, riwayat waste, dan riwayat audit opname.
   - Laporan rekonsiliasi shift kasir (uang kas, selisih tunai/non-tunai).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, React 19)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) & [TanStack React Query](https://tanstack.com/query)
- **Tabel & Form**: [TanStack Table](https://tanstack.com/table), [React Hook Form](https://react-hook-form.com), [Zod](https://zod.dev)
- **Grafik & Visualisasi**: [Recharts](https://recharts.org)
- **Komponen & Ikon**: [Lucide React](https://lucide.dev), [Sonner Toast](https://sonner.emilkowal.ski)

---

## 🚀 Memulai Pengembangan

### 1. Prasyarat
- **Node.js**: Versi 20+ (disarankan Node.js 22 atau 24)
- **npm** atau **pnpm**
- Backend POS-GODINOV (`posgodinov-be`) aktif di port yang sesuai (misal: `http://localhost:8080`)

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Pastikan variabel konfigurasi sesuai dengan backend:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```

Buka peramban di:
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Login Bisnis**: [http://localhost:3000/login](http://localhost:3000/login)

---

## 🧪 Skrip Pemeriksaan Kualitas Kode

```bash
# Typecheck TypeScript
npm run typecheck

# Linter ESLint
npm run lint

# Build untuk Production
npm run build

# Menjalankan Server Production
npm run start
```
