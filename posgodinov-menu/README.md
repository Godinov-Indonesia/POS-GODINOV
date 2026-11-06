# posgodinov-menu

Web application customer-facing untuk pemesanan menu mandiri (*self-ordering*) via scan QR code per tenant / meja.

## Alur Sistem

1. **Scan QR**: Customer memindai QR code di meja / gerai fisik.
2. **Redirect URL**: Dialihkan ke URL tenant, contoh: `https://menu.godinov.com/[tenant_slug]?table=[table_no]&token=[qr_token]`.
3. **Pilih Menu**: Menampilkan katalog menu, varian, add-on, dan catatan pesanan (cart lokal).
4. **Pembayaran**: Konfirmasi pesanan dan proses bayar (Payment Gateway QRIS / e-wallet atau bayar di kasir).
5. **Masuk ke POS**: Pesanan terkonfirmasi langsung masuk ke antrean pesanan POS & Kitchen Display System (KDS).

## Stack Teknologi

- **Framework**: Next.js 16 (App Router)
- **Library UI**: React 19, Tailwind CSS v4, Lucide React
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query

## Menjalankan Proyek

```bash
# Instalasi dependensi
pnpm install

# Menjalankan development server (port 3002)
pnpm dev

# Build produksi
pnpm build
```
