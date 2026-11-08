'use client'

import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronRight,
  CreditCard,
  EyeOff,
  Package,
  Printer,
  Receipt,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Wallet,
} from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, SkeletonTable } from '@/components/ui/feedback'
import { Money } from '@/components/ui/money'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'
import { useShiftDetail } from '@/features/admin/reports/hooks/useReports'
import { formatDateTimeId } from '@/lib/time'
import { cn } from '@/lib/utils/cn'

type TabKey = 'transactions' | 'voids' | 'prints' | 'wastes' | 'returns'

export function ShiftDetailDrawer({
  outletId,
  shiftId,
  onClose,
}: {
  outletId: string
  shiftId: string | null
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = React.useState<TabKey>('transactions')
  const [expandedTxIds, setExpandedTxIds] = React.useState<Set<string>>(new Set())

  const { data: detail, isLoading, error } = useShiftDetail(outletId, shiftId)

  // Reset tab saat shift berganti
  React.useEffect(() => {
    setActiveTab('transactions')
    setExpandedTxIds(new Set())
  }, [shiftId])

  const toggleTxExpand = (txId: string) => {
    setExpandedTxIds((prev) => {
      const next = new Set(prev)
      if (next.has(txId)) {
        next.delete(txId)
      } else {
        next.add(txId)
      }
      return next
    })
  }

  if (!shiftId) return null

  return (
    <Dialog
      open={Boolean(shiftId)}
      onClose={onClose}
      title="Rincian Operasional Shift"
      description="Laporan detail transaksi, cetak struk, pembatalan, limbah, dan peristiwa keamanan kasir."
      className="w-[min(68rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col p-0 overflow-hidden"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-pos-xs text-fg-muted font-mono">
            Shift ID: {shiftId}
          </span>
          <Button variant="neutral" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="flex flex-col flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} />
          </div>
        ) : error || !detail ? (
          <div className="p-6 text-center text-danger">
            <AlertTriangle className="size-8 mx-auto mb-2 text-danger" />
            <p className="font-medium">Gagal memuat rincian shift</p>
            <p className="text-pos-xs text-fg-muted mt-1">
              {error instanceof Error ? error.message : 'Terjadi kesalahan sistem'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-y-auto">
            {/* ── Ringkasan Header Kasir & Laci ──────────────────────────── */}
            <div className="border-b border-border bg-surface-subtle p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-pos-base font-semibold text-fg">
                      {detail.summary.staffName || 'Kasir'}
                    </span>
                    <span className="font-mono text-pos-xs text-fg-muted">
                      ({detail.summary.deviceId})
                    </span>
                    {detail.summary.flagged ? (
                      <Badge tone="danger">Selisih Ditandai</Badge>
                    ) : (
                      <Badge tone="success">Aman</Badge>
                    )}
                    {!detail.summary.blindClose ? (
                      <Badge tone="warning">
                        <ShieldAlert className="size-3 mr-1" />
                        Tutup Paksa
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-pos-xs text-fg-subtle">
                        <EyeOff className="size-3" />
                        Blind Close
                      </span>
                    )}
                  </div>
                  <p className="text-pos-xs text-fg-muted mt-0.5">
                    Buka: {formatDateTimeId(detail.summary.openedAt)}
                    {detail.summary.closedAt
                      ? ` → Tutup: ${formatDateTimeId(detail.summary.closedAt)}`
                      : ' → Shift Aktif'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-pos-xs text-fg-muted block">Saldo Awal Laci</span>
                  <span className="text-pos-sm font-semibold text-fg">
                    <Money minor={detail.summary.openingBalanceMinor} />
                  </span>
                </div>
              </div>

              {/* Rekap Saldo Kas, EDC, QRIS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-pos-xs">
                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <div className="flex items-center justify-between text-fg-muted mb-1">
                    <span className="font-medium flex items-center gap-1">
                      <Wallet className="size-3 text-brand" /> Uang Kas
                    </span>
                    <VarianceBadge varianceMinor={detail.summary.cash.varianceMinor} />
                  </div>
                  <div className="flex justify-between text-fg-subtle">
                    <span>Deklarasi:</span>
                    <span className="font-medium text-fg">
                      <Money minor={detail.summary.cash.declaredMinor} />
                    </span>
                  </div>
                  <div className="flex justify-between text-fg-subtle">
                    <span>Sistem:</span>
                    <span className="font-medium text-fg">
                      {detail.summary.cash.expectedMinor !== null ? (
                        <Money minor={detail.summary.cash.expectedMinor} />
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <div className="flex items-center justify-between text-fg-muted mb-1">
                    <span className="font-medium flex items-center gap-1">
                      <CreditCard className="size-3 text-info" /> EDC / Kartu
                    </span>
                    <VarianceBadge varianceMinor={detail.summary.edc.varianceMinor} />
                  </div>
                  <div className="flex justify-between text-fg-subtle">
                    <span>Deklarasi:</span>
                    <span className="font-medium text-fg">
                      <Money minor={detail.summary.edc.declaredMinor} />
                    </span>
                  </div>
                  <div className="flex justify-between text-fg-subtle">
                    <span>Sistem:</span>
                    <span className="font-medium text-fg">
                      {detail.summary.edc.expectedMinor !== null ? (
                        <Money minor={detail.summary.edc.expectedMinor} />
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <div className="flex items-center justify-between text-fg-muted mb-1">
                    <span className="font-medium flex items-center gap-1">
                      <Receipt className="size-3 text-success" /> QRIS
                    </span>
                    <VarianceBadge varianceMinor={detail.summary.qris.varianceMinor} />
                  </div>
                  <div className="flex justify-between text-fg-subtle">
                    <span>Deklarasi:</span>
                    <span className="font-medium text-fg">
                      <Money minor={detail.summary.qris.declaredMinor} />
                    </span>
                  </div>
                  <div className="flex justify-between text-fg-subtle">
                    <span>Sistem:</span>
                    <span className="font-medium text-fg">
                      {detail.summary.qris.expectedMinor !== null ? (
                        <Money minor={detail.summary.qris.expectedMinor} />
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Navigasi Tab Rincian ───────────────────────────────────── */}
            <div className="flex border-b border-border bg-surface px-4 gap-2 overflow-x-auto">
              <TabButton
                active={activeTab === 'transactions'}
                onClick={() => setActiveTab('transactions')}
                icon={Receipt}
                label="Transaksi & Item"
                badge={detail.transactions.totalCount}
              />
              <TabButton
                active={activeTab === 'voids'}
                onClick={() => setActiveTab('voids')}
                icon={Ban}
                label="Void Log"
                badge={detail.voids.totalCount}
              />
              <TabButton
                active={activeTab === 'prints'}
                onClick={() => setActiveTab('prints')}
                icon={Printer}
                label="Struk & Audit"
                badge={detail.receiptPrints.totalReprinted + detail.securityEvents.length}
              />
              <TabButton
                active={activeTab === 'wastes'}
                onClick={() => setActiveTab('wastes')}
                icon={Trash2}
                label="Limbah (Waste)"
                badge={detail.wastes.totalCount}
              />
              <TabButton
                active={activeTab === 'returns'}
                onClick={() => setActiveTab('returns')}
                icon={RotateCcw}
                label="Retur"
                badge={detail.returns.totalCount}
              />
            </div>

            {/* ── Konten Tab ────────────────────────────────────────────── */}
            <div className="p-4 flex-1">
              {activeTab === 'transactions' && (
                <div className="flex flex-col gap-4">
                  {/* Statistik Transaksi */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-border p-2.5 bg-surface-subtle">
                      <span className="text-pos-xs text-fg-muted block">Total Transaksi</span>
                      <span className="text-pos-sm font-bold text-fg">
                        {detail.transactions.totalCount}{' '}
                        <span className="text-pos-xs font-normal text-fg-muted">
                          ({detail.transactions.completedCount} sukses, {detail.transactions.voidedCount} void)
                        </span>
                      </span>
                    </div>
                    <div className="rounded-lg border border-border p-2.5 bg-surface-subtle">
                      <span className="text-pos-xs text-fg-muted block">Total Penjualan Bersih</span>
                      <span className="text-pos-sm font-bold text-success">
                        <Money minor={detail.transactions.totalNetMinor} />
                      </span>
                    </div>
                    <div className="col-span-2 rounded-lg border border-border p-2.5 bg-surface-subtle">
                      <span className="text-pos-xs text-fg-muted block mb-1">Pecahan Pembayaran</span>
                      <div className="flex flex-wrap gap-2 text-pos-xs">
                        {Object.entries(detail.transactions.paymentBreakdownMinor).map(
                          ([method, amountMinor]) => (
                            <span
                              key={method}
                              className="inline-flex items-center gap-1 bg-surface px-2 py-0.5 rounded border border-border"
                            >
                              <span className="font-mono text-fg-subtle">{method}:</span>
                              <span className="font-semibold text-fg">
                                <Money minor={amountMinor} />
                              </span>
                            </span>
                          ),
                        )}
                        {Object.keys(detail.transactions.paymentBreakdownMinor).length === 0 && (
                          <span className="text-fg-subtle italic">Belum ada pembayaran</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tabel Daftar Transaksi (Expandable) */}
                  {detail.transactions.list.length === 0 ? (
                    <EmptyState
                      icon={Receipt}
                      title="Tidak ada transaksi"
                      description="Tidak ada transaksi tercatat pada shift ini."
                    />
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <THead>
                          <TR>
                            <TH className="w-10"></TH>
                            <TH>Kode / Pelanggan</TH>
                            <TH>Metode</TH>
                            <TH>Waktu</TH>
                            <TH>Status</TH>
                            <TH className="text-right">Nominal</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {detail.transactions.list.map((tx) => {
                            const isExpanded = expandedTxIds.has(tx.id)
                            return (
                              <React.Fragment key={tx.id}>
                                <TR
                                  onClick={() => toggleTxExpand(tx.id)}
                                  className={cn(
                                    'cursor-pointer transition-colors',
                                    isExpanded && 'bg-surface-subtle font-medium',
                                  )}
                                >
                                  <TD className="w-10 text-center">
                                    <button
                                      type="button"
                                      className="p-1 hover:bg-surface-hover rounded"
                                      aria-label={isExpanded ? 'Tutup rincian item' : 'Lihat rincian item'}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="size-4 text-fg-muted" />
                                      ) : (
                                        <ChevronRight className="size-4 text-fg-muted" />
                                      )}
                                    </button>
                                  </TD>
                                  <TD>
                                    <div className="flex flex-col">
                                      <span className="font-mono text-fg font-medium">
                                        {tx.receiptCode}
                                      </span>
                                      <span className="text-pos-xs text-fg-muted">
                                        {tx.customerName || 'Umum'}
                                      </span>
                                    </div>
                                  </TD>
                                  <TD>
                                    <span className="font-mono text-pos-xs">{tx.paymentMethod}</span>
                                    {tx.reprintCount > 0 && (
                                      <span className="ml-1 text-warning text-pos-xs inline-flex items-center">
                                        <Printer className="size-3 mr-0.5" />
                                        x{tx.reprintCount}
                                      </span>
                                    )}
                                  </TD>
                                  <TD className="text-pos-xs text-fg-muted">
                                    {formatDateTimeId(tx.createdAt)}
                                  </TD>
                                  <TD>
                                    {tx.status === 'COMPLETED' ? (
                                      <Badge tone="success">Sukses</Badge>
                                    ) : (
                                      <Badge tone="danger">Batal/Void</Badge>
                                    )}
                                  </TD>
                                  <TD className="text-right font-medium">
                                    <Money minor={tx.totalAmountMinor} />
                                  </TD>
                                </TR>

                                {/* Baris Detail Item Transaksi (Expandable) */}
                                {isExpanded && (
                                  <TR className="bg-surface-subtle/60 border-t-0">
                                    <TD colSpan={6} className="p-3 pl-12">
                                      <div className="rounded-lg border border-border bg-surface p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-pos-xs font-semibold text-fg flex items-center gap-1.5">
                                            <Package className="size-3.5 text-brand" />
                                            Detail Item Transaksi ({tx.items.length} item)
                                          </span>
                                        </div>

                                        {tx.items.length === 0 ? (
                                          <p className="text-pos-xs text-fg-subtle italic py-1">
                                            Tidak ada rincian item produk pada transaksi ini.
                                          </p>
                                        ) : (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-left text-pos-xs">
                                              <thead>
                                                <tr className="border-b border-border text-fg-muted font-medium">
                                                  <th className="py-1.5 pr-3">Produk</th>
                                                  <th className="py-1.5 pr-3">SKU</th>
                                                  <th className="py-1.5 pr-3 text-center">Qty</th>
                                                  <th className="py-1.5 pr-3 text-right">Harga Satuan</th>
                                                  <th className="py-1.5 text-right">Subtotal</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border/50">
                                                {tx.items.map((it) => (
                                                  <tr key={it.id}>
                                                    <td className="py-1.5 pr-3 font-medium text-fg">
                                                      {it.productName || 'Produk'}
                                                    </td>
                                                    <td className="py-1.5 pr-3 font-mono text-fg-subtle">
                                                      {it.sku || '—'}
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-center font-semibold">
                                                      {it.quantity}
                                                    </td>
                                                    <td className="py-1.5 pr-3 text-right text-fg-muted">
                                                      <Money minor={it.unitPriceMinor} />
                                                    </td>
                                                    <td className="py-1.5 text-right font-medium text-fg">
                                                      <Money minor={it.subtotalMinor} />
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    </TD>
                                  </TR>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </TBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'voids' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-pos-xs text-fg-muted">
                    <span>
                      Total {detail.voids.totalCount} void dicatat selama shift.
                    </span>
                    <span className="font-semibold text-danger">
                      Total Nominal: <Money minor={detail.voids.totalValueMinor} />
                    </span>
                  </div>

                  {detail.voids.list.length === 0 ? (
                    <EmptyState
                      icon={Ban}
                      title="Tidak ada void"
                      description="Kasir tidak melakukan pembatalan item atau transaksi pada shift ini."
                    />
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Cakupan / Produk</TH>
                            <TH className="text-center">Kuantitas</TH>
                            <TH className="text-right">Nilai Void</TH>
                            <TH>Alasan</TH>
                            <TH>Staf / Otorisasi</TH>
                            <TH>Waktu</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {detail.voids.list.map((v) => (
                            <TR key={v.id}>
                              <TD>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-fg">
                                    {v.productName || 'Transaksi / Keranjang'}
                                  </span>
                                  <span className="font-mono text-pos-xs text-fg-subtle">
                                    Scope: {v.scope}
                                  </span>
                                </div>
                              </TD>
                              <TD className="text-center">
                                <span className="font-mono text-pos-xs">
                                  {v.quantityBefore} → {v.quantityAfter}
                                </span>
                              </TD>
                              <TD className="text-right font-medium text-danger">
                                <Money minor={v.valueAmountMinor} />
                              </TD>
                              <TD>
                                <div className="flex flex-col">
                                  <span className="font-medium text-fg">{v.reasonCode}</span>
                                  {v.reasonNotes && (
                                    <span className="text-pos-xs text-fg-muted italic">
                                      &quot;{v.reasonNotes}&quot;
                                    </span>
                                  )}
                                </div>
                              </TD>
                              <TD>
                                <div className="flex flex-col text-pos-xs">
                                  <span className="text-fg">{v.staffName}</span>
                                  {v.authorizedByName && (
                                    <span className="text-fg-subtle">
                                      Otorisasi: {v.authorizedByName}
                                    </span>
                                  )}
                                </div>
                              </TD>
                              <TD className="text-pos-xs text-fg-muted">
                                {formatDateTimeId(v.createdAt)}
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'prints' && (
                <div className="flex flex-col gap-5">
                  {/* Cetak Ulang Struk */}
                  <div>
                    <h4 className="text-pos-sm font-semibold text-fg mb-2 flex items-center gap-1.5">
                      <Printer className="size-4 text-warning" />
                      Transaksi yang Dicetak Ulang ({detail.receiptPrints.totalReprinted})
                    </h4>
                    {detail.receiptPrints.list.length === 0 ? (
                      <p className="text-pos-xs text-fg-subtle italic bg-surface-subtle p-3 rounded-lg border border-border">
                        Tidak ada transaksi yang dicetak ulang pada shift ini.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <Table>
                          <THead>
                            <TR>
                              <TH>Kode Struk</TH>
                              <TH className="text-center">Jumlah Cetak Ulang</TH>
                              <TH>Waktu Cetak Terakhir</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {detail.receiptPrints.list.map((rp) => (
                              <TR key={rp.transactionId}>
                                <TD className="font-mono font-medium">{rp.receiptCode}</TD>
                                <TD className="text-center">
                                  <Badge tone="warning">x{rp.reprintCount}</Badge>
                                </TD>
                                <TD className="text-pos-xs text-fg-muted">
                                  {rp.receiptPrintedAt
                                    ? formatDateTimeId(rp.receiptPrintedAt)
                                    : '—'}
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Security Audit Events */}
                  <div>
                    <h4 className="text-pos-sm font-semibold text-fg mb-2 flex items-center gap-1.5">
                      <ShieldAlert className="size-4 text-brand" />
                      Log Peristiwa Keamanan POS ({detail.securityEvents.length})
                    </h4>
                    {detail.securityEvents.length === 0 ? (
                      <p className="text-pos-xs text-fg-subtle italic bg-surface-subtle p-3 rounded-lg border border-border">
                        Tidak ada peringatan keamanan khusus tercatat.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <Table>
                          <THead>
                            <TR>
                              <TH>Jenis Peristiwa</TH>
                              <TH>Tingkat</TH>
                              <TH>Waktu</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {detail.securityEvents.map((se) => (
                              <TR key={se.id}>
                                <TD className="font-mono text-pos-xs font-semibold text-fg">
                                  {se.eventType}
                                </TD>
                                <TD>
                                  {se.severity === 'CRITICAL' ? (
                                    <Badge tone="danger">Kritis</Badge>
                                  ) : se.severity === 'WARN' ? (
                                    <Badge tone="warning">Peringatan</Badge>
                                  ) : (
                                    <Badge tone="neutral">Info</Badge>
                                  )}
                                </TD>
                                <TD className="text-pos-xs text-fg-muted">
                                  {formatDateTimeId(se.createdAt)}
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'wastes' && (
                <div className="flex flex-col gap-3">
                  <span className="text-pos-xs text-fg-muted">
                    Total {detail.wastes.totalCount} pencatatan bahan/produk rusak atau dibuang selama shift.
                  </span>

                  {detail.wastes.list.length === 0 ? (
                    <EmptyState
                      icon={Trash2}
                      title="Tidak ada limbah/waste"
                      description="Tidak ada bahan baku atau produk yang dicatat waste pada rentang shift ini."
                    />
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Tipe</TH>
                            <TH>Nama Item</TH>
                            <TH className="text-center">Jumlah</TH>
                            <TH>Alasan</TH>
                            <TH>Dicatat Oleh</TH>
                            <TH>Waktu</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {detail.wastes.list.map((w) => (
                            <TR key={w.id}>
                              <TD>
                                <Badge tone={w.wasteType === 'PRODUCT' ? 'neutral' : 'info'}>
                                  {w.wasteType === 'PRODUCT' ? 'Produk Jadi' : 'Bahan Baku'}
                                </Badge>
                              </TD>
                              <TD className="font-medium text-fg">{w.itemName || 'Item'}</TD>
                              <TD className="text-center font-mono font-semibold">
                                {w.quantity} {w.unit}
                              </TD>
                              <TD>
                                <span className="text-pos-xs text-fg">{w.reason}</span>
                                {w.reasonCode && (
                                  <span className="font-mono text-pos-xs text-fg-subtle block">
                                    [{w.reasonCode}]
                                  </span>
                                )}
                              </TD>
                              <TD className="text-pos-xs">{w.recordedByName || '—'}</TD>
                              <TD className="text-pos-xs text-fg-muted">
                                {formatDateTimeId(w.createdAt)}
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'returns' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-pos-xs text-fg-muted">
                    <span>Total {detail.returns.totalCount} transaksi retur pada shift ini.</span>
                    <span className="font-semibold text-danger">
                      Total Pengembalian: <Money minor={detail.returns.totalRefundMinor} />
                    </span>
                  </div>

                  {detail.returns.list.length === 0 ? (
                    <EmptyState
                      icon={RotateCcw}
                      title="Tidak ada retur"
                      description="Tidak ada transaksi yang dikembalikan/retur pada shift ini."
                    />
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <THead>
                          <TR>
                            <TH>ID Transaksi Asal</TH>
                            <TH>Metode Pengembalian</TH>
                            <TH className="text-right">Nominal Refund</TH>
                            <TH>Alasan</TH>
                            <TH>Waktu Retur</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {detail.returns.list.map((r) => (
                            <TR key={r.id}>
                              <TD className="font-mono text-pos-xs font-medium">
                                {r.transactionId}
                              </TD>
                              <TD className="font-mono text-pos-xs">{r.refundMethod}</TD>
                              <TD className="text-right font-medium text-danger">
                                <Money minor={r.refundAmountMinor} />
                              </TD>
                              <TD className="text-pos-xs">{r.reason || '—'}</TD>
                              <TD className="text-pos-xs text-fg-muted">
                                {formatDateTimeId(r.createdAt)}
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 py-2.5 px-3 border-b-2 text-pos-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'border-brand text-brand font-semibold'
          : 'border-transparent text-fg-muted hover:text-fg hover:border-border',
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
      {typeof badge === 'number' && (
        <span
          className={cn(
            'ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono',
            active ? 'bg-brand/15 text-brand font-bold' : 'bg-surface-subtle text-fg-subtle',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function VarianceBadge({ varianceMinor }: { varianceMinor: number | null }) {
  if (varianceMinor === null) {
    return <span className="text-fg-subtle text-pos-xs">Belum dihitung</span>
  }
  if (varianceMinor === 0) {
    return <span className="text-success font-medium text-pos-xs">Pas (0)</span>
  }
  const isLoss = varianceMinor < 0
  return (
    <span
      className={cn(
        'font-semibold text-pos-xs',
        isLoss ? 'text-danger' : 'text-warning',
      )}
    >
      {isLoss ? 'Kurang ' : 'Lebih +'}
      <Money minor={Math.abs(varianceMinor)} />
    </span>
  )
}
