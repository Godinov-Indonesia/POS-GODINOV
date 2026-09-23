import { PosProviders } from '@/features/pos/PosProviders'
import { DeviceBindScreen } from '@/features/pos/screens/DeviceBindScreen'

/**
 * P-01 Device Binding — route terpisah, dipakai sekali saat pemasangan.
 *
 * ⚠️ `PosProviders` WAJIB ada di sini, bukan hanya di `/pos`.
 *
 * Ia yang memanggil `installDeviceTokenResolver()`. Tanpa itu, `bindDevice`
 * memang berhasil (`auth: 'none'`, tidak butuh token), tetapi `syncMasterData()`
 * yang berjalan tepat sesudahnya memakai `auth: 'device'` dan gagal karena
 * resolver-nya tidak pernah terdaftar — pemasangan tampak gagal padahal server
 * sudah menjawab `200`.
 */
export const dynamic = 'force-static'
export const revalidate = false

export default function PosBindPage() {
  return (
    <PosProviders>
      <DeviceBindScreen />
    </PosProviders>
  )
}
