/** Fallback navigasi service worker ([05 §1.1.2]). */
export const dynamic = 'force-static'
export const revalidate = false

export default function PosOfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="flex w-[26rem] max-w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
        <h1 className="text-pos-lg font-bold text-fg">Halaman tidak tersedia offline</h1>
        <p className="text-pos-sm text-fg-muted">
          Aplikasi kasir tetap berfungsi penuh tanpa jaringan. Halaman ini muncul karena alamat yang
          Anda tuju berada di luar cakupan yang disimpan perangkat.
        </p>
        <a
          href="/pos"
          className="mt-2 inline-flex h-touch-md items-center justify-center rounded-lg bg-accent px-6 font-semibold text-fg-inverse"
        >
          Kembali ke Kasir
        </a>
      </div>
    </main>
  )
}
