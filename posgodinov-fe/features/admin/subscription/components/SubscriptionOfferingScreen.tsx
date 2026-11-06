'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Check,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { toastApiError } from '@/components/ui/toaster'
import { PageHeader } from '@/features/admin/shell/PageHeader'
import { checkoutSubscription, getSubscription } from '@/lib/api/endpoints/subscription'
import { formatIdr } from '@/lib/money'
import type {
  CheckoutSubscriptionResponse,
  SaaSPlan,
  SaaSPlanFeature,
} from '@/lib/types/api'

const FEATURE_LABELS: Record<string, string> = {
  max_outlets: 'Maksimal Cabang Outlet',
  max_products: 'Maksimal Katalog Produk',
  max_raw_materials: 'Maksimal Bahan Baku (Inventori)',
  max_staff_per_outlet: 'Maksimal Staff per Outlet',
  history_days_limit: 'Riwayat Transaksi & Laporan (Hari)',
  cloud_storage_mb: 'Penyimpanan Cloud (MB)',
  staff_transfer: 'Mutasi / Transfer Staff Antar-Outlet',
  export_reports: 'Export Laporan ke CSV / Excel',
  stock_opname_collaborative: 'Stock Opname Kolaboratif (Blind SO)',
  dual_stock_auto_unpack: 'Konversi Stok Gudang Otomatis (Dual-Stock)',
  custom_branding: 'Kustomisasi Struk & Branding Toko',
  api_webhook_access: 'Akses Integrasi API & Webhook',
  no_ads: 'Dashboard Bebas Iklan & Banner Promo',
}

const FALLBACK_PLANS: SaaSPlan[] = [
  {
    id: 'plan_free',
    code: 'FREE',
    name: 'Gratis (Starter)',
    description: 'Cocok untuk usaha rintisan dengan 1 outlet dan kebutuhan kasir dasar.',
    price_minor: 0,
    billing_cycle: 'LIFETIME',
    is_public: true,
    is_active: true,
    sort_order: 1,
    features: [
      { id: 'f1', plan_id: 'plan_free', feature_key: 'max_outlets', is_enabled: true, limit_value: 1 },
      { id: 'f2', plan_id: 'plan_free', feature_key: 'max_products', is_enabled: true, limit_value: 50 },
      { id: 'f3', plan_id: 'plan_free', feature_key: 'max_raw_materials', is_enabled: true, limit_value: 30 },
      { id: 'f4', plan_id: 'plan_free', feature_key: 'max_staff_per_outlet', is_enabled: true, limit_value: 3 },
      { id: 'f5', plan_id: 'plan_free', feature_key: 'history_days_limit', is_enabled: true, limit_value: 30 },
      { id: 'f6', plan_id: 'plan_free', feature_key: 'export_reports', is_enabled: false, limit_value: 0 },
      { id: 'f7', plan_id: 'plan_free', feature_key: 'staff_transfer', is_enabled: false, limit_value: 0 },
      { id: 'f8', plan_id: 'plan_free', feature_key: 'no_ads', is_enabled: false, limit_value: 0 },
    ],
  },
  {
    id: 'plan_pro_monthly',
    code: 'PRO',
    name: 'Pro Bisnis',
    description: 'Ideal untuk bisnis berkembang dengan multi-outlet, laporan lengkap, dan bebas iklan.',
    price_minor: 29900000,
    billing_cycle: 'MONTHLY',
    is_public: true,
    is_active: true,
    sort_order: 2,
    features: [
      { id: 'p1', plan_id: 'plan_pro_monthly', feature_key: 'max_outlets', is_enabled: true, limit_value: 5 },
      { id: 'p2', plan_id: 'plan_pro_monthly', feature_key: 'max_products', is_enabled: true, limit_value: 500 },
      { id: 'p3', plan_id: 'plan_pro_monthly', feature_key: 'max_raw_materials', is_enabled: true, limit_value: 200 },
      { id: 'p4', plan_id: 'plan_pro_monthly', feature_key: 'max_staff_per_outlet', is_enabled: true, limit_value: 20 },
      { id: 'p5', plan_id: 'plan_pro_monthly', feature_key: 'history_days_limit', is_enabled: true, limit_value: 365 },
      { id: 'p6', plan_id: 'plan_pro_monthly', feature_key: 'export_reports', is_enabled: true, limit_value: 0 },
      { id: 'p7', plan_id: 'plan_pro_monthly', feature_key: 'staff_transfer', is_enabled: true, limit_value: 0 },
      { id: 'p8', plan_id: 'plan_pro_monthly', feature_key: 'stock_opname_collaborative', is_enabled: true, limit_value: 0 },
      { id: 'p9', plan_id: 'plan_pro_monthly', feature_key: 'dual_stock_auto_unpack', is_enabled: true, limit_value: 0 },
      { id: 'p10', plan_id: 'plan_pro_monthly', feature_key: 'no_ads', is_enabled: true, limit_value: 0 },
    ],
  },
  {
    id: 'plan_enterprise',
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Solusi tanpa batas kuota untuk jaringan franchise dan operasional skala besar.',
    price_minor: 99900000,
    billing_cycle: 'MONTHLY',
    is_public: true,
    is_active: true,
    sort_order: 3,
    features: [
      { id: 'e1', plan_id: 'plan_enterprise', feature_key: 'max_outlets', is_enabled: true, limit_value: -1 },
      { id: 'e2', plan_id: 'plan_enterprise', feature_key: 'max_products', is_enabled: true, limit_value: -1 },
      { id: 'e3', plan_id: 'plan_enterprise', feature_key: 'max_raw_materials', is_enabled: true, limit_value: -1 },
      { id: 'e4', plan_id: 'plan_enterprise', feature_key: 'max_staff_per_outlet', is_enabled: true, limit_value: -1 },
      { id: 'e5', plan_id: 'plan_enterprise', feature_key: 'history_days_limit', is_enabled: true, limit_value: -1 },
      { id: 'e6', plan_id: 'plan_enterprise', feature_key: 'export_reports', is_enabled: true, limit_value: 0 },
      { id: 'e7', plan_id: 'plan_enterprise', feature_key: 'staff_transfer', is_enabled: true, limit_value: 0 },
      { id: 'e8', plan_id: 'plan_enterprise', feature_key: 'stock_opname_collaborative', is_enabled: true, limit_value: 0 },
      { id: 'e9', plan_id: 'plan_enterprise', feature_key: 'dual_stock_auto_unpack', is_enabled: true, limit_value: 0 },
      { id: 'e10', plan_id: 'plan_enterprise', feature_key: 'custom_branding', is_enabled: true, limit_value: 0 },
      { id: 'e11', plan_id: 'plan_enterprise', feature_key: 'api_webhook_access', is_enabled: true, limit_value: 0 },
      { id: 'e12', plan_id: 'plan_enterprise', feature_key: 'no_ads', is_enabled: true, limit_value: 0 },
    ],
  },
]

function formatCycle(cycle: string): string {
  switch (cycle?.toUpperCase()) {
    case 'MONTHLY':
      return '/ bulan'
    case 'YEARLY':
      return '/ tahun'
    case 'LIFETIME':
      return 'Selamanya'
    default:
      return ''
  }
}

function formatFeatureItem(pf: SaaSPlanFeature): { label: string; badge: string | null; enabled: boolean } {
  const label = pf.feature?.name || FEATURE_LABELS[pf.feature_key] || pf.feature_key
  const isNumeric =
    pf.feature?.value_type === 'NUMERIC_LIMIT' ||
    pf.feature_key.startsWith('max_') ||
    pf.feature_key.endsWith('_limit') ||
    pf.feature_key.endsWith('_mb')

  if (isNumeric) {
    return {
      label,
      badge: pf.limit_value === -1 ? 'Tanpa Batas (∞)' : `${pf.limit_value}`,
      enabled: pf.is_enabled && pf.limit_value !== 0,
    }
  }

  return {
    label,
    badge: null,
    enabled: pf.is_enabled,
  }
}

export function SubscriptionOfferingScreen() {
  const queryClient = useQueryClient()
  const [selectedPlan, setSelectedPlan] = React.useState<SaaSPlan | null>(null)
  const [paymentMethod, setPaymentMethod] = React.useState<'QRIS' | 'VA' | 'WALLET'>('QRIS')
  const [checkoutResult, setCheckoutResult] = React.useState<CheckoutSubscriptionResponse | null>(
    null,
  )

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-info'],
    queryFn: getSubscription,
  })

  const activePolicy = data?.effective_policy || data?.policy
  const currentPlanCode = (
    activePolicy?.plan_code ||
    data?.subscription?.plan?.code ||
    data?.subscription?.plan_code ||
    'FREE'
  ).toUpperCase()
  const currentPlanId = data?.subscription?.plan_id || 'plan_free'
  const walletBalanceMinor = data?.wallet?.balance_minor ?? 0
  const plans = data?.plans && data.plans.length > 0 ? data.plans : FALLBACK_PLANS

  const checkoutMut = useMutation({
    mutationFn: checkoutSubscription,
    onSuccess: (res) => {
      if (res.status === 'PAID') {
        toast.success('Selamat! Paket langganan bisnis Anda berhasil di-upgrade.')
        void queryClient.invalidateQueries({ queryKey: ['subscription-info'] })
        setSelectedPlan(null)
        setCheckoutResult(null)
      } else {
        toast.success('Tagihan upgrade berhasil dibuat. Silakan selesaikan pembayaran.')
        setCheckoutResult(res)
      }
    },
    onError: (err) => {
      toastApiError(err, 'Gagal memproses checkout langganan')
    },
  })

  const openCheckout = (plan: SaaSPlan) => {
    setSelectedPlan(plan)
    setCheckoutResult(null)
    setPaymentMethod('QRIS')
  }

  const closeModal = () => {
    setSelectedPlan(null)
    setCheckoutResult(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  const numericLimits = activePolicy?.numeric_limits ?? {}
  const booleanFlags = activePolicy?.boolean_flags ?? {}

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <PageHeader
        title="Paket & Upgrade Langganan"
        description="Tingkatkan kapasitas outlet, produk, laporan bisnis, dan pengalaman kasir tanpa batas."
      />

      {/* Ringkasan Paket & Kuota Saat Ini */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
              <Crown className="size-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-pos-xs font-semibold tracking-wider text-fg-muted uppercase">
                  Paket Aktif Saat Ini
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-pos-xs font-bold text-accent-fg">
                  {activePolicy?.plan_name || data?.subscription?.plan?.name || currentPlanCode}
                </span>
              </div>
              <p className="mt-1 text-pos-sm text-fg-muted">
                {data?.subscription?.expires_at
                  ? `Aktif hingga ${new Date(data.subscription.expires_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}`
                  : 'Paket aktif tanpa batas waktu kadaluarsa'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-muted/60 px-4 py-3">
            <Wallet className="size-5 text-accent shrink-0" aria-hidden="true" />
            <div>
              <div className="text-pos-xs text-fg-muted">Saldo Dompet Merchant</div>
              <div className="font-mono text-pos-base font-bold text-fg">
                {formatIdr(walletBalanceMinor)}
              </div>
            </div>
          </div>
        </div>

        {/* Indikator Kuota Aktif */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-pos-xs text-fg-muted">Batas Cabang Outlet</div>
            <div className="mt-0.5 font-mono text-pos-base font-bold text-fg">
              {numericLimits.max_outlets === -1
                ? 'Unlimited (∞)'
                : `${numericLimits.max_outlets ?? 1} Outlet`}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-pos-xs text-fg-muted">Batas Katalog Produk</div>
            <div className="mt-0.5 font-mono text-pos-base font-bold text-fg">
              {numericLimits.max_products === -1
                ? 'Unlimited (∞)'
                : `${numericLimits.max_products ?? 50} Produk`}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-pos-xs text-fg-muted">Export Laporan Excel/CSV</div>
            <div className="mt-0.5 text-pos-sm font-semibold text-fg">
              {booleanFlags.export_reports ? 'Tersedia (Aktif)' : 'Terkunci (Khusus Pro)'}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="text-pos-xs text-fg-muted">Status Iklan Dashboard</div>
            <div className="mt-0.5 text-pos-sm font-semibold text-fg">
              {booleanFlags.no_ads ? 'Bebas Iklan' : 'Tampil Banner Promo'}
            </div>
          </div>
        </div>
      </section>

      {/* Grid Offering Paket Langganan */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isPro = plan.code.toUpperCase() === 'PRO'
          const isCurrent =
            plan.id === currentPlanId || plan.code.toUpperCase() === currentPlanCode
          const isFree = plan.price_minor === 0

          return (
            <div
              key={plan.id}
              className={
                isPro
                  ? 'relative flex flex-col justify-between rounded-2xl border-2 border-accent bg-surface p-6 shadow-md'
                  : 'relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-xs'
              }
            >
              {isPro ? (
                <div className="absolute -top-3.5 left-6 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-pos-xs font-bold text-accent-fg shadow-xs">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>Paling Populer</span>
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-pos-lg font-bold text-fg">{plan.name}</h2>
                  <span className="rounded-md bg-bg-muted px-2 py-0.5 font-mono text-pos-xs font-semibold text-fg-muted uppercase">
                    {plan.code}
                  </span>
                </div>

                <p className="mt-2 min-h-[2.5rem] text-pos-sm text-fg-muted">{plan.description}</p>

                <div className="mt-5 border-y border-border py-4">
                  {isFree ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-pos-2xl font-extrabold text-fg">Gratis</span>
                      <span className="text-pos-xs text-fg-muted">Selamanya</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-pos-2xl font-extrabold text-fg">
                          {formatIdr(plan.price_minor)}
                        </span>
                        <span className="text-pos-xs text-fg-muted">
                          {formatCycle(plan.billing_cycle)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-pos-xs text-fg-subtle">
                        Belum termasuk PPN 11% • Aktivasi instan
                      </p>
                    </div>
                  )}
                </div>

                {/* Daftar Fitur Paket */}
                <ul className="mt-5 space-y-2.5 text-pos-sm">
                  {(plan.features ?? []).map((pf) => {
                    const item = formatFeatureItem(pf)
                    return (
                      <li
                        key={pf.feature_key}
                        className={
                          item.enabled
                            ? 'flex items-start justify-between gap-2 text-fg'
                            : 'flex items-start justify-between gap-2 text-fg-subtle line-through opacity-60'
                        }
                      >
                        <div className="flex items-start gap-2">
                          {item.enabled ? (
                            <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                          ) : (
                            <X className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                          )}
                          <span>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className="shrink-0 rounded bg-bg-muted px-1.5 py-0.5 font-mono text-pos-xs font-semibold text-fg">
                            {item.badge}
                          </span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="mt-8 pt-2">
                {isCurrent ? (
                  <Button variant="neutral" className="w-full" disabled>
                    Paket Aktif Saat Ini
                  </Button>
                ) : isFree ? (
                  <Button variant="ghost" className="w-full" disabled>
                    Paket Dasar
                  </Button>
                ) : (
                  <Button
                    variant={isPro ? 'primary' : 'neutral'}
                    className="w-full"
                    onClick={() => openCheckout(plan)}
                  >
                    <Sparkles className="size-4" aria-hidden="true" />
                    <span>Upgrade ke {plan.name}</span>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* Jaminan Keamanan & Aktivasi */}
      <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-bg-muted/40 p-5 sm:flex-row">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-6 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="text-pos-sm font-semibold text-fg">
              Aktivasi Otomatis & Tanpa Downtime Operasional
            </p>
            <p className="text-pos-xs text-fg-muted">
              Seluruh data transaksi, produk, dan stok di outlet Anda tetap aman saat upgrade paket.
            </p>
          </div>
        </div>
      </section>

      {/* Modal Checkout Upgrade Plan */}
      {selectedPlan ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 id="checkout-modal-title" className="text-pos-lg font-bold text-fg">
                  {checkoutResult ? 'Instruksi Pembayaran' : `Upgrade ke ${selectedPlan.name}`}
                </h3>
                <p className="text-pos-xs text-fg-muted">
                  {checkoutResult
                    ? `Nomor Tagihan: ${checkoutResult.invoice_number ?? '-'}`
                    : 'Pilih metode pembayaran untuk mengaktifkan paket.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Tutup modal"
                className="rounded-lg p-1 text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>

            {checkoutResult ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-border bg-bg p-4 space-y-2">
                  <div className="flex items-center justify-between text-pos-xs text-fg-muted">
                    <span>Metode Pembayaran</span>
                    <span className="font-mono font-semibold text-fg">
                      {checkoutResult.payment_method}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-pos-xs text-fg-muted">
                    <span>Status Tagihan</span>
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono font-semibold text-amber-600">
                      {checkoutResult.status}
                    </span>
                  </div>
                </div>

                {checkoutResult.va_number ? (
                  <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                    <div className="text-pos-xs text-fg-muted">Nomor Virtual Account</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-pos-base font-bold text-fg">
                        {checkoutResult.va_number}
                      </span>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(checkoutResult.va_number ?? '')
                          toast.success('Nomor VA disalin')
                        }}
                      >
                        <Copy className="size-3.5" />
                        <span>Salin</span>
                      </Button>
                    </div>
                  </div>
                ) : null}

                {checkoutResult.qr_payload ? (
                  <div className="rounded-xl border border-border bg-bg-muted/50 p-4 text-center space-y-2">
                    <QrCode className="mx-auto size-10 text-accent" />
                    <div className="text-pos-xs font-medium text-fg">String QRIS Pembayaran</div>
                    <div className="break-all rounded bg-surface p-2 font-mono text-pos-xs text-fg-muted border border-border">
                      {checkoutResult.qr_payload}
                    </div>
                  </div>
                ) : null}

                {checkoutResult.payment_url ? (
                  <a
                    href={checkoutResult.payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-touch w-full items-center justify-center gap-2 rounded-full bg-accent px-4 text-pos-sm font-semibold text-accent-fg hover:bg-accent-hover"
                  >
                    <span>Buka Halaman Pembayaran</span>
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}

                <Button variant="neutral" className="w-full" onClick={closeModal}>
                  Selesai
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {/* Ringkasan Harga + PPN 11% */}
                {(() => {
                  const amount = selectedPlan.price_minor
                  const tax = Math.floor(amount * 0.11)
                  const total = amount + tax
                  const walletEnough = walletBalanceMinor >= total

                  return (
                    <>
                      <div className="rounded-xl border border-border bg-bg p-4 space-y-2 text-pos-sm">
                        <div className="flex items-center justify-between text-fg-muted">
                          <span>Harga {selectedPlan.name}</span>
                          <span className="font-mono">{formatIdr(amount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-fg-muted">
                          <span>PPN (11%)</span>
                          <span className="font-mono">{formatIdr(tax)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-2 font-bold text-fg">
                          <span>Total Pembayaran</span>
                          <span className="font-mono text-pos-base text-accent">
                            {formatIdr(total)}
                          </span>
                        </div>
                      </div>

                      {/* Pilihan Metode Pembayaran */}
                      <div className="space-y-2">
                        <div className="text-pos-xs font-semibold text-fg-muted uppercase">
                          Metode Pembayaran
                        </div>

                        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3 hover:bg-bg-muted/50">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="payment_method"
                              checked={paymentMethod === 'QRIS'}
                              onChange={() => setPaymentMethod('QRIS')}
                            />
                            <QrCode className="size-4 text-accent" />
                            <div>
                              <div className="text-pos-sm font-medium text-fg">QRIS Instan</div>
                              <div className="text-pos-xs text-fg-muted">
                                GoPay, OVO, Dana, ShopeePay, M-Banking
                              </div>
                            </div>
                          </div>
                        </label>

                        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3 hover:bg-bg-muted/50">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="payment_method"
                              checked={paymentMethod === 'VA'}
                              onChange={() => setPaymentMethod('VA')}
                            />
                            <Building2 className="size-4 text-accent" />
                            <div>
                              <div className="text-pos-sm font-medium text-fg">
                                Virtual Account Bank
                              </div>
                              <div className="text-pos-xs text-fg-muted">
                                Transfer Bank Otomatis
                              </div>
                            </div>
                          </div>
                        </label>

                        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3 hover:bg-bg-muted/50">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="payment_method"
                              checked={paymentMethod === 'WALLET'}
                              onChange={() => setPaymentMethod('WALLET')}
                            />
                            <CreditCard className="size-4 text-accent" />
                            <div>
                              <div className="text-pos-sm font-medium text-fg">
                                Saldo Dompet Merchant
                              </div>
                              <div className="text-pos-xs text-fg-muted">
                                Saldo: {formatIdr(walletBalanceMinor)}{' '}
                                {!walletEnough ? '(Saldo belum cukup)' : '(Aktivasi instan)'}
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={closeModal}>
                          Batal
                        </Button>
                        <Button
                          variant="primary"
                          disabled={
                            checkoutMut.isPending || (paymentMethod === 'WALLET' && !walletEnough)
                          }
                          onClick={() =>
                            checkoutMut.mutate({
                              plan_id: selectedPlan.id,
                              payment_method: paymentMethod,
                            })
                          }
                        >
                          {checkoutMut.isPending ? 'Memproses…' : 'Bayar & Upgrade Sekarang'}
                        </Button>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
