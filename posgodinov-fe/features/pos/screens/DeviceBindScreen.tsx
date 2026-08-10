'use client'

import { ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { bindDevice } from '@/lib/api/endpoints/auth'
import { PosApiError } from '@/lib/api/errors'
import { saveDeviceBinding } from '@/lib/auth/device-session'
import { syncMasterData } from '@/lib/sync/master-sync'

/**
 * P-01 Device Binding — docs/04 §A.2, docs/03 §2.1.
 *
 * Dijalankan **satu kali** saat pemasangan dan memerlukan jaringan. Setelah
 * binding berhasil, master data langsung ditarik supaya perangkat dapat
 * ditinggalkan dalam keadaan siap pakai offline.
 */
export function DeviceBindScreen() {
  const [serialBusiness, setSerialBusiness] = React.useState('')
  const [serialOutlet, setSerialOutlet] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [outletLabel, setOutletLabel] = React.useState('')
  const [state, setState] = React.useState<
    'idle' | 'binding' | 'syncing' | 'bound-no-data' | 'done'
  >('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [retrying, setRetrying] = React.useState(false)

  const retryMasterSync = async () => {
    setRetrying(true)
    setError(null)
    try {
      await syncMasterData()
      setState('done')
    } catch (err) {
      setError(`Unduhan master data masih gagal: ${describe(err)}`)
    } finally {
      setRetrying(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setState('binding')

    try {
      const { device_token } = await bindDevice({
        serial_business: serialBusiness.trim(),
        serial_outlet: serialOutlet.trim(),
        password,
      })

      await saveDeviceBinding({
        token: device_token,
        outletLabel: outletLabel.trim() || serialOutlet.trim(),
      })

      // Password owner tidak pernah disimpan — hanya dipakai sekali di sini.
      setPassword('')

      // Sejak titik ini perangkat SUDAH terikat dan token sudah tersimpan.
      // Kegagalan berikutnya tidak boleh membuat layar kembali ke keadaan awal
      // seolah pemasangan gagal — mengulang binding hanya menerbitkan token
      // baru tanpa alasan, dan operator kehilangan jejak apa yang sebenarnya
      // sudah berhasil.
      setState('syncing')
      try {
        await syncMasterData()
        setState('done')
      } catch (syncErr) {
        setError(
          `Perangkat berhasil diikat, tetapi unduhan master data gagal: ${describe(syncErr)}`,
        )
        setState('bound-no-data')
      }
    } catch (err) {
      setError(describe(err))
      setState('idle')
    }
  }

  if (state === 'bound-no-data') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="flex w-[28rem] max-w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-elevated">
          <h1 className="text-pos-lg font-bold text-fg">Perangkat sudah terikat</h1>
          <p className="text-pos-sm text-fg-muted">
            Pemasangan berhasil dan token perangkat tersimpan.{' '}
            <strong>Tidak perlu mengulang pemasangan.</strong> Yang belum selesai hanyalah unduhan
            master data — produk, kategori, dan daftar kasir.
          </p>
          {error ? (
            <p role="alert" className="text-pos-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button variant="primary" size="xl" onClick={retryMasterSync} disabled={retrying}>
            {retrying ? 'Mengunduh…' : 'Coba Unduh Master Data Lagi'}
          </Button>
          <a
            href="/pos"
            className="text-pos-sm font-medium text-accent underline"
          >
            Lanjut ke aplikasi kasir — unduh nanti lewat Pengaturan
          </a>
        </div>
      </main>
    )
  }

  if (state === 'done') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="flex w-[28rem] max-w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-elevated">
          <h1 className="text-pos-lg font-bold text-fg">Perangkat siap dipakai</h1>
          <p className="text-pos-sm text-fg-muted">
            Binding berhasil dan master data sudah tersimpan di perangkat. Aplikasi kasir kini dapat
            dibuka penuh tanpa jaringan.
          </p>
          <a
            href="/pos"
            className="mt-2 inline-flex h-touch-lg items-center justify-center rounded-lg bg-accent px-6 text-pos-lg font-semibold text-fg-inverse"
          >
            Buka Aplikasi Kasir
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="flex w-[30rem] max-w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-elevated"
      >
        <h1 className="text-pos-lg font-bold text-fg">Pemasangan Perangkat Kasir</h1>

        <Banner tone="warning" icon={ShieldAlert} title="Halaman teknisi">
          Proses ini meminta <strong>password pemilik bisnis</strong> dan menerbitkan token
          perangkat berumur sekitar 10 tahun yang <strong>tidak dapat dicabut</strong> — backend
          belum menyediakan endpoint unbind. Jalankan hanya pada perangkat yang Anda kendalikan.
        </Banner>

        <Field
          label="Serial Business"
          htmlFor="serial-business"
          required
          hint="Dari halaman Info Pemasangan di Dashboard Admin."
        >
          <Input
            id="serial-business"
            className="font-mono"
            autoCapitalize="characters"
            value={serialBusiness}
            onChange={(e) => setSerialBusiness(e.target.value)}
          />
        </Field>

        <Field
          label="Serial Outlet"
          htmlFor="serial-outlet"
          required
          hint="Nilai serial_tenant, bukan ID outlet."
        >
          <Input
            id="serial-outlet"
            className="font-mono"
            autoCapitalize="characters"
            value={serialOutlet}
            onChange={(e) => setSerialOutlet(e.target.value)}
          />
        </Field>

        <Field
          label="Nama outlet"
          htmlFor="outlet-label"
          hint="Hanya untuk ditampilkan di layar kasir. Tidak dikirim ke server."
        >
          <Input
            id="outlet-label"
            value={outletLabel}
            onChange={(e) => setOutletLabel(e.target.value)}
          />
        </Field>

        <Field label="Password Pemilik Bisnis" htmlFor="owner-password" required>
          <Input
            id="owner-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error ? (
          <p role="alert" className="flex items-start gap-1.5 text-pos-sm text-danger">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="xl"
          block
          disabled={state !== 'idle' || !serialBusiness || !serialOutlet || !password}
        >
          {state === 'binding'
            ? 'Mengikat perangkat…'
            : state === 'syncing'
              ? 'Mengunduh master data…'
              : 'PASANG PERANGKAT'}
        </Button>
      </form>
    </main>
  )
}

/**
 * Pesan galat apa adanya.
 *
 * `PosApiError` sudah berbahasa Indonesia dan layak ditampilkan ([05 §3.2]);
 * `Error` biasa — mis. kesalahan konfigurasi klien — juga lebih berguna
 * ditampilkan daripada diganti kalimat generik yang menyembunyikan sebabnya.
 */
function describe(err: unknown): string {
  if (err instanceof PosApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Pemasangan gagal'
}
