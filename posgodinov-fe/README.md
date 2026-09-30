# POS-GODINOV Frontend (Admin Dashboard & Web POS PWA)

Aplikasi web terpadu untuk sistem POS-GODINOV yang mencakup **Admin Dashboard** (pengelolaan bisnis online) dan **Web POS PWA** (aplikasi kasir ritel offline-first).

---

## ⚡ Fitur Utama & Modul

1. **Admin Dashboard**:
   - **Manajemen Bisnis & Outlet**: Konfigurasi profil bisnis, multi-outlet, dan pendaftaran staf/kasir.
   - **Dual-Stock Inventory Management**:
     - Visualisasi stok bahan baku presisi tinggi: **Stok Kemasan Utuh** (`package_stock`), **Stok Eceran Terbuka** (`loose_stock`), dan kalkulasi otomatis total satuan dasar (**Unit Stock**).
     - Modul **Restock**: Pencatatan pembelian barang per kemasan atau eceran dengan kalkulasi *moving average* HPP secara otomatis.
     - Modul **Waste**: Pelaporan bahan baku tumpah/rusak/kedaluwarsa dalam kemasan maupun eceran.
   - **Stock Opname (SO) Management**:
     - Pembuatan form SO dengan pemilihan material per outlet.
     - Monitoring status form: `OPEN` → `PUBLISHED` → `COUNTING` → `CLOSED`.
     - Review lembar hitungan fisik staf (`actual_packages` & `actual_loose`), selisih stok (*difference*), dan indikator potensi fraud (*fraud flag*).
     - Tindakan persetujuan (*Approve*) untuk menyesuaikan dual-stock secara langsung, penolakan (*Reject*), atau pembukaan siklus hitung ulang (*Recount*).
   - **Katalog Produk & Resep BOM**: Pembuatan menu, kategori, pengaturan harga, serta pengikatan resep bahan baku (*Bill of Materials*).
   - **Laporan & Analitik**: Dasbor pendapatan harian/bulanan, riwayat transaksi, dan tren produk terlaris.

2. **Web POS PWA (Offline-First Kasir)**:
   - **Offline-First Storage**: Menggunakan **Dexie.js (IndexedDB)** untuk menyimpan master data dan mencatat transaksi penjualan lokal tanpa koneksi internet.
   - **Sinkronisasi Cerdas**: Engine rekonsiliasi transaksi offline dengan retensi UUID v4 dan idempotensi server.
   - **Shift Management & Offline PIN**: Pembukaan/penutupan kasir dan validasi PIN kasir lokal via bcrypt.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, React 19)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com)
- **Local Database (Client)**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) & [TanStack React Query](https://tanstack.com/query)
- **Tabel & Form**: [TanStack Table](https://tanstack.com/table), [React Hook Form](https://react-hook-form.com), [Zod](https://zod.dev)
- **Komponen & Ikon**: [Lucide React](https://lucide.dev), [Sonner Toast](https://sonner.emilkowal.ski)
- **E2E Testing**: [Playwright](https://playwright.dev)

---

## 🚀 Memulai Pengembangan

### 1. Prasyarat
- **Node.js**: Versi 20+ (disarankan Node.js 24)
- **npm** atau **pnpm**
- Backend POS-GODINOV telah berjalan di `http://localhost:8080`

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Isi variabel konfigurasi:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```
> *Catatan: Pastikan `NEXT_PUBLIC_API_BASE_URL` cocok dengan origin yang diizinkan pada `ALLOWED_ORIGINS` di backend.*

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```

Buka browser di:
- **Admin Dashboard**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Web POS PWA**: [http://localhost:3000/pos](http://localhost:3000/pos)

---

## 🧪 Skrip Pengujian & Quality Check

```bash
# Typecheck TypeScript
npm run typecheck

# Linter ESLint
npm run lint

# Build untuk Production
npm run build

# Menjalankan Server Production
npm run start

# Menjalankan Pengujian E2E (Playwright)
npm run test:e2e

# Menjalankan Pengujian E2E dengan UI Interaktif
npm run test:e2e:ui
```
