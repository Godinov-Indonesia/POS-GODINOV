package id.godinov.pos.posgodinov_mobile.kiosk

import android.app.admin.DeviceAdminReceiver

/**
 * Penerima kebijakan perangkat.
 *
 * Keberadaannya adalah syarat agar aplikasi dapat menjadi **Device Owner**.
 * Tanpa kelas ini, `dpm set-device-owner` menolak dengan pesan yang tidak
 * menjelaskan apa pun.
 *
 * Sengaja kosong: seluruh kebijakan diterapkan dari [KioskPlugin] saat mode
 * Kiosk dinyalakan, bukan sebagai reaksi terhadap callback siklus hidup.
 */
class GodinovDeviceAdminReceiver : DeviceAdminReceiver()
