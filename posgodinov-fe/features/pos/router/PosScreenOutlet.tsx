'use client'

import * as React from 'react'

import { CashierLoginScreen } from '@/features/pos/screens/CashierLoginScreen'
import { CloseShiftScreen } from '@/features/pos/screens/CloseShiftScreen'
import { HeldCartsScreen } from '@/features/pos/screens/HeldCartsScreen'
import { HistoryScreen } from '@/features/pos/screens/HistoryScreen'
import { OpenShiftScreen } from '@/features/pos/screens/OpenShiftScreen'
import { PaymentCardScreen } from '@/features/pos/screens/PaymentCardScreen'
import { PaymentCashScreen } from '@/features/pos/screens/PaymentCashScreen'
import { PaymentScreen } from '@/features/pos/screens/PaymentScreen'
import { PaymentSplitScreen } from '@/features/pos/screens/PaymentSplitScreen'
import { ProductWasteScreen } from '@/features/pos/screens/ProductWasteScreen'
import { ReceiptScreen } from '@/features/pos/screens/ReceiptScreen'
import { RegisterScreen } from '@/features/pos/screens/RegisterScreen'
import { ReturnScreen } from '@/features/pos/screens/ReturnScreen'
import { SettingsScreen } from '@/features/pos/screens/SettingsScreen'
import { SyncMasterScreen } from '@/features/pos/screens/SyncMasterScreen'
import { SyncStatusScreen } from '@/features/pos/screens/SyncStatusScreen'
import { VoidScreen } from '@/features/pos/screens/VoidScreen'
import { usePosRouterStore } from '@/features/pos/router/usePosRouter'
import type { PosScreen } from '@/features/pos/router/screens'

/**
 * Pemilih layar POS.
 *
 * Peta eksplisit alih-alih `switch`: TypeScript memastikan setiap layar di
 * `POS_SCREENS` punya komponen, sehingga menambah layar tanpa mendaftarkannya
 * gagal saat kompilasi, bukan saat kasir menekan tombol.
 */
const SCREENS: Record<PosScreen, React.ComponentType> = {
  'sync-master': SyncMasterScreen,
  login: CashierLoginScreen,
  'open-shift': OpenShiftScreen,
  register: RegisterScreen,
  payment: PaymentScreen,
  'payment-cash': PaymentCashScreen,
  'payment-card': PaymentCardScreen,
  'payment-split': PaymentSplitScreen,
  receipt: ReceiptScreen,
  'held-carts': HeldCartsScreen,
  history: HistoryScreen,
  void: VoidScreen,
  return: ReturnScreen,
  'product-waste': ProductWasteScreen,
  'close-shift': CloseShiftScreen,
  'sync-status': SyncStatusScreen,
  settings: SettingsScreen,
}

export function PosScreenOutlet() {
  const screen = usePosRouterStore((s) => s.screen)
  const Screen = SCREENS[screen]
  return <Screen />
}
