'use client'

import * as React from 'react'

import {
  getConnectivityServerSnapshot,
  getConnectivitySnapshot,
  installConnectivityWatcher,
  subscribeConnectivity,
  type ConnectivityState,
  type ConnectivityStatus,
} from '@/lib/sync/connectivity-store'

/**
 * Jembatan React ke `lib/sync/connectivity-store` ([11 §M12.1]).
 *
 * Memakai `useSyncExternalStore`, bukan `useState` + `useEffect`: store-nya
 * hidup di luar React, dan berlangganan lewat efek akan membuat render pertama
 * selalu memakai nilai basi selama satu frame.
 *
 * ⚠️ Tidak ada navigasi di berkas ini maupun di store yang dibacanya (aturan
 * R7). Perubahan status jaringan **hanya** mengubah tampilan.
 */
export function useConnectivity(): ConnectivityState {
  return React.useSyncExternalStore(
    subscribeConnectivity,
    getConnectivitySnapshot,
    getConnectivityServerSnapshot,
  )
}

/**
 * Status jaringan saja.
 *
 * Selector sempit disengaja: komponen yang hanya menggambar ikon tidak perlu
 * ikut dirender ulang setiap kali penghitung kegagalan bertambah. Nilainya
 * primitif, sehingga perbandingan referensi `useSyncExternalStore` bekerja apa
 * adanya tanpa memoisasi tambahan.
 */
export function useConnectivityStatus(): ConnectivityStatus {
  return React.useSyncExternalStore(
    subscribeConnectivity,
    () => getConnectivitySnapshot().status,
    () => getConnectivityServerSnapshot().status,
  )
}

/**
 * `true` selama perangkat bukan `offline`.
 *
 * `degraded` sengaja dihitung sebagai "boleh mencoba": itulah satu-satunya cara
 * mengetahui captive portal sudah dilewati. Mematikan tombol sinkronisasi saat
 * `degraded` akan mengunci kasir pada keadaan yang justru bisa ia perbaiki
 * sendiri dengan menekan tombol itu.
 */
export function useCanAttemptNetwork(): boolean {
  return useConnectivityStatus() !== 'offline'
}

/** Dipasang sekali dari `PosApp`, berdampingan dengan `useSyncTriggers`. */
export function useConnectivityWatcher(): void {
  React.useEffect(() => installConnectivityWatcher(), [])
}
