'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { NumericInput, Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { usePosAuthStore } from '@/features/pos/auth/pos-auth-store'
import { posNavigate } from '@/features/pos/router/usePosRouter'
import type { LocalProduct } from '@/lib/db/models'
import { listProducts } from '@/lib/db/repositories/master.repo'
import { saveWaste } from '@/lib/db/repositories/transaction.repo'

/**
 * P-11 Lapor Waste Produk Jadi — docs/04 §A.1.
 *
 * ⚠️ Berbeda dari waste bahan baku sisi Admin yang **menolak** bila stok tidak
 * mencukupi, waste dari kasir **membolehkan stok minus** ([03 §9.1]). Perbedaan
 * ini disengaja: yang dilaporkan di sini sudah benar-benar terjadi.
 */
export function ProductWasteScreen() {
  const products = useLiveQuery(() => listProducts(), [], [] as LocalProduct[])
  const staffId = usePosAuthStore((s) => s.staffId)

  const [productId, setProductId] = React.useState('')
  const [quantity, setQuantity] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const product = products.find((p) => p.id === productId)
  const qty = Math.floor(Number(quantity.trim()) || 0)
  const valid = !!product && qty > 0 && !!reason.trim() && !!staffId

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || !product || !staffId) return

    setSaving(true)
    try {
      await saveWaste({
        staffId,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        reason: reason.trim(),
      })
      toast.success('Waste dicatat dan diantrekan untuk sinkronisasi')
      setProductId('')
      setQuantity('')
      setReason('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => posNavigate('register')}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali
        </Button>
        <h1 className="text-pos-lg font-bold text-fg">Lapor Waste Produk</h1>
      </div>

      <form
        onSubmit={submit}
        className="flex w-[28rem] max-w-full flex-col gap-4 rounded-xl border border-border bg-surface p-4"
      >
        <Banner tone="info">
          Laporan ini memotong bahan baku lewat resep produk saat tersinkronisasi. Stok boleh
          menjadi minus — pencatatan yang jujur lebih penting daripada angka stok yang rapi.
        </Banner>

        <Field label="Produk" htmlFor="waste-product" required>
          <Select
            id="waste-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Pilih produk…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Jumlah"
          htmlFor="waste-qty"
          required
          hint="Bilangan bulat — produk tidak dapat dibuang sebagian."
        >
          <NumericInput
            id="waste-qty"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>

        <Field label="Alasan" htmlFor="waste-reason" required>
          <Textarea
            id="waste-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: tumpah saat penyajian"
          />
        </Field>

        <Button type="submit" variant="danger" size="xl" block disabled={!valid || saving}>
          {saving ? 'Menyimpan…' : 'CATAT WASTE'}
        </Button>
      </form>
    </div>
  )
}
