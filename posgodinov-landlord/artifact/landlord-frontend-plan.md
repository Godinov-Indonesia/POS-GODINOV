# Master Plan: POS-GODINOV Landlord Console (`posgodinov-landlord`)

Dokumen ini adalah cetak biru teknis pelaksanaan pengembangan frontend platform Superadmin Console (**Landlord Platform**) POS-GODINOV berbasis Next.js App Router.

---

## 1. Arsitektur Teknis & Standar Sistem

### 1.1 Stack Teknologi
- **Framework**: Next.js 16.3 (App Router, React Server Components + Client Islands).
- **Core**: React 19, TypeScript 5.9+.
- **Styling**: Tailwind CSS v4, `@tailwindcss/postcss`.
- **Icons & Primitives**: `lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-tabs`.
- **Data Fetching & Caching**: TanStack React Query v5 (client fetching, cache invalidation, optimistic updates).
- **Forms & Validation**: `react-hook-form`, `zod`.
- **Feedback & Visual**: `sonner` (Toast), `recharts` (Metrik visual MRR/Tenant).
- **HTTP Client**: Native `fetch` wrapper dengan interceptor auth & standard response handler.
- **Security & Token Management**:
  - Token autentikasi superadmin **wajib disimpan di Cookies** (`landlord_access_token`), **dilarang menggunakan `localStorage` / `sessionStorage`** untuk mencegah pencurian token via XSS.
  - Opsi cookie: `Path=/`, `SameSite=Lax`, `Secure` (di production).
  - Dikelola melalui Route Handler internal Next.js (`/api/auth/session`) / Server Action agar sinkron langsung dengan Next.js Edge Middleware.

### 1.2 Layout & Design System
- **Theme**: Slate/Zinc Dark & Clean Enterprise Admin (monospace font for IDs/currency, high contrast, dense tabular layout).
- **Shell**:
  - Sticky Topbar (breadcrumb, status indikator API, profil superadmin, logout).
  - Collapsible Sidebar:
    - Overview (`/dashboard`)
    - Tenant 360 (`/tenants`)
    - Plan Matrix (`/plans`)
    - Landing CMS (`/cms`)
    - In-App Campaigns (`/campaigns`)
    - Audit Logs (`/audit-logs`)

---

## 2. Peta Endpoint Backend (`posgodinov-be`)

| Modul | Endpoint | Metode | Deskripsi |
|---|---|---|---|
| **Auth** | `/v1/landlord/auth/login` | POST | Login email & password superadmin |
| | `/v1/landlord/auth/me` | GET | Validasi sesi & profil admin |
| **Metrik** | `/v1/landlord/metrics/overview` | GET | Ringkasan MRR, total tenant, growth |
| **Tenants** | `/v1/landlord/businesses` | GET | List tenant (filter, search, pagination) |
| | `/v1/landlord/businesses/{id}` | GET | Detail profil bisnis, outlet, paket aktif |
| | `/v1/landlord/businesses/{id}/suspend` | POST | Pembekuan akun tenant |
| | `/v1/landlord/businesses/{id}/unsuspend` | POST | Pemulihan status aktif tenant |
| | `/v1/landlord/businesses/{id}/impersonate` | POST | Terbitkan token impersonasi merchant |
| | `/v1/landlord/businesses/{id}/overrides` | POST/DELETE | Tambah / hapus custom limit tenant |
| **Plans** | `/v1/landlord/plans` | GET | Daftar paket (Free, Pro, Enterprise) |
| | `/v1/landlord/plans/{id}/features` | PUT | Update limit numerik / toggle fitur |
| | `/v1/landlord/features` | GET | Definisi seluruh fitur & kuota SaaS |
| **CMS** | `/v1/landlord/landing/settings` | GET/PUT | Kelola banner, FAQ, kontak CS |
| | `/v1/landlord/landing/revalidate` | POST | Pemicu purge cache Next.js Landing Page |
| **Campaigns** | `/v1/landlord/campaigns` | GET/POST | Iklan banner & popup in-app merchant |

---

## 3. Struktur Direktori Proyek

```
posgodinov-landlord/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts     # Set cookie landlord_access_token
│   │       └── logout/route.ts    # Clear cookie landlord_access_token
│   ├── (dashboard)/
│   │   ├── layout.tsx             # Shell: Sidebar, Topbar, AuthGuard
│   │   ├── page.tsx               # Redirect to /dashboard
│   │   ├── dashboard/             # Executive Overview & Charts
│   │   ├── tenants/               # Tenant 360 Directory & Details
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── plans/                 # Interactive Feature & Quota Matrix
│   │   ├── cms/                   # Landing Page CMS & Revalidate Hook
│   │   ├── campaigns/             # In-App Ads & Promo Engine
│   │   └── audit-logs/            # Superadmin Audit Trail
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                        # Button, Input, Table, Badge, Modal, Tabs
│   ├── layout/                    # Sidebar, Header, Breadcrumbs
│   └── shared/                    # ConfirmDialog, MetricCard, EmptyState
├── lib/
│   ├── api/                       # Client HTTP wrapper & endpoint SDK (reads cookie)
│   ├── hooks/                     # Custom React Query hooks
│   ├── types/                     # DTOs & Domain types TypeScript
│   └── utils.ts                   # Formatters (IDR, Date, Plural)
└── middleware.ts                  # Route protection: cek cookie landlord_access_token
```

---

## 4. Tahapan Pelaksanaan (Milestones)

### Milestone 1: Foundation, Design Tokens & Auth Engine
- [ ] Setup base dependencies (`lucide-react`, `clsx`, `tailwind-merge`, `sonner`, `@tanstack/react-query`).
- [ ] Definisi types TypeScript lengkap berdasarkan domain Go (`internal/domain/landlord.go` & `saas.go`).
- [ ] Setup API client dengan error handling standar `{ code, error, details }`.
- [ ] Setup Route Handler cookie autentikasi (`/api/auth/login` & `/api/auth/logout`): menulis cookie `landlord_access_token` (`Path=/`, `SameSite=Lax`).
- [ ] Halaman `/login`: Form autentikasi, validasi schema Zod, login via route handler cookie (tanpa menyentuh `localStorage`).
- [ ] Edge Middleware Next.js (`middleware.ts`):
  - Membaca `request.cookies.get('landlord_access_token')`.
  - Jika belum login dan mengakses `(dashboard)/*` -> redirect ke `/login`.
  - Jika sudah login dan mengakses `/login` -> redirect ke `/dashboard`.

### Milestone 2: App Shell & Executive Dashboard
- [ ] Komponen layout shell: Sidebar responsif, Header dengan profil admin, indicator status koneksi API backend.
- [ ] Halaman `/dashboard`:
  - Kartu Ringkasan Metrik (MRR, Total Tenant, Tenant Baru 30 Hari, Suspended Tenants).
  - Chart Distribusi Paket (Free vs Pro Monthly/Yearly).
  - Quick action shortcuts.

### Milestone 3: Tenant 360 Directory & Operations
- [ ] Halaman `/tenants`:
  - Data table: Nama Bisnis, Owner, Email, Paket, Status (Active, Suspended, Past Due), Tanggal Daftar.
  - Search debounced, Filter Paket, Filter Status, Server-side pagination.
- [ ] Halaman Detail `/tenants/[id]`:
  - Profil bisnis, daftar cabang/outlet, status langganan.
  - Aksi Suspensi: Modal dialog alasan suspend/unsuspend.
  - Aksi Impersonasi: Tombol "Masuk sebagai Merchant" -> generate impersonation token -> buka tab baru ke `posgodinov-fe` dengan token khusus.
  - Manajemen Tenant Feature Overrides (Add-ons modal).

### Milestone 4: Interactive Plan & Feature Matrix Editor
- [ ] Halaman `/plans`:
  - Visual matrix: Baris = Fitur/Kuota, Kolom = Tier (Free, Pro Monthly, Pro Yearly).
  - Inline toggle untuk fitur boolean (`inventory_ledger`, `multi_outlet`, `cloud_backup`).
  - Inline input untuk fitur numerik (`max_outlets`, `max_products`, `cloud_storage_mb`).
  - Tombol simpan perubahan dengan konfirmasi broadcast invalidasi cache.

### Milestone 5: Landing Page CMS & On-Demand Revalidation
- [ ] Halaman `/cms`:
  - Hero Banner Editor (Desktop/Mobile WebP URL, Headline, Subheadline, CTA buttons).
  - Announcement Bar Editor (Teks berjalan/banner atas).
  - FAQ Manager (CRUD daftar pertanyaan & jawaban).
  - Contact Settings (WhatsApp CS, Email Support).
  - Tombol aksi: "Purge & Revalidate Landing Page" -> panggil `/v1/landlord/landing/revalidate` dengan status toast konfirmasi.

### Milestone 6: In-App Campaign Manager & Audit Logs
- [ ] Halaman `/campaigns`:
  - List kampanye banner & modal interstitial untuk merchant Free Tier.
  - Form pembuatan kampanye: Judul, Tier target, Tipe placement, Banner URL, CTA link, Jadwal tayang.
  - Analitik performa: Impressions & Click-Through Rate (CTR).
- [ ] Halaman `/audit-logs`:
  - Riwayat audit seluruh tindakan admin (Login, Update Plan, Suspend, Impersonate, CMS update).

---

## 5. Rencana Pengujian & Standar Selesai
1. **Lint & Typecheck**: `pnpm lint` dan `pnpm typecheck` lulus 0 error.
2. **Build Check**: `pnpm build` menghasilkan static & server chunks tanpa peringatan fatal.
3. **E2E Critical Flow**:
   - Superadmin login berhasil -> masuk dashboard.
   - Edit batas kuota di matrix -> tersimpan ke backend.
   - Klik Revalidate CMS -> menerima HTTP 200 dari backend.
