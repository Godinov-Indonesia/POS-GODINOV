import { DeviceBindScreen } from '@/features/pos/screens/DeviceBindScreen'

/** P-01 Device Binding — route terpisah, dipakai sekali saat pemasangan. */
export const dynamic = 'force-static'
export const revalidate = false

export default function PosBindPage() {
  return <DeviceBindScreen />
}
