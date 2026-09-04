package id.godinov.pos.posgodinov_mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.sersoluciones.flutter_pos_printer_platform.FlutterPosPrinterPlatformPlugin
import id.godinov.pos.posgodinov_mobile.kiosk.KioskPlugin
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/// **BLOCK-01 — dua cacat `flutter_pos_printer_platform_image_3` 1.2.4.**
///
/// 1.2.4 adalah versi TERBARU di pub.dev (diperiksa 2026-08-29); tidak ada
/// rilis yang memperbaiki keduanya, dan kelas pluginnya `final` sehingga tidak
/// dapat diturunkan. Keduanya karena itu ditangani dari sisi aplikasi.
///
/// ┌── Cacat 1 · engine tanpa Activity meledak saat dibongkar ───────────────┐
/// │ `bluetoothService` dan `adapter` HANYA diisi di `onAttachedToActivity`, │
/// │ tetapi `onDetachedFromEngine` membongkarnya tanpa penjagaan:            │
/// │                                                                        │
/// │     bluetoothService.setHandler(null)   // ⟵ meledak                   │
/// │                                                                        │
/// │ Plugin yang sama sudah memakai `this::bluetoothService.isInitialized`   │
/// │ di dua tempat lain — penjagaannya cuma lupa dipasang di situ.           │
/// │                                                                        │
/// │ Yang terkena: engine headless `workmanager`, yang tidak pernah punya    │
/// │ Activity.                                                              │
/// │     BackgroundWorker.kt:101  engine = FlutterEngine(applicationContext) │
/// │     BackgroundWorker.kt:309  engine?.destroy()                          │
/// │                             → UninitializedPropertyAccessException      │
/// │                             → FATAL EXCEPTION: main                     │
/// │                                                                        │
/// │ `FlutterEngineConnectionRegistry.remove()` tidak membungkusnya dengan   │
/// │ try/catch, jadi lemparannya membunuh proses — termasuk saat kasir       │
/// │ sedang memakai aplikasinya.                                            │
/// │                                                                        │
/// │ Obat: plugin DILEPAS dari registrasi otomatis (tugas                    │
/// │ `stripPrinterPluginAutoRegistration` di android/app/build.gradle.kts)   │
/// │ dan didaftarkan manual di bawah — hanya pada engine yang punya          │
/// │ Activity. Engine latar tidak lagi memuat plugin yang tidak ia pakai:    │
/// │ `SyncEngine.syncUp()`, satu-satunya yang dijalankan                     │
/// │ `callbackDispatcher`, nol referensi ke pencetakan.                      │
/// └────────────────────────────────────────────────────────────────────────┘
///
/// ┌── Cacat 2 · `registerReceiver` tanpa flag export ───────────────────────┐
/// │ `USBPrinterService.init()` memanggil                                    │
/// │                                                                        │
/// │     mContext!!.registerReceiver(mUsbDeviceReceiver, filter)             │
/// │                                                                        │
/// │ dengan filter yang memuat aksi KUSTOM (`ACTION_USB_PERMISSION`). Sejak  │
/// │ Android 14, aplikasi ber-`targetSdk` ≥ 34 WAJIB menyatakan              │
/// │ `RECEIVER_EXPORTED` atau `RECEIVER_NOT_EXPORTED` untuk filter semacam   │
/// │ itu. `targetSdk` proyek ini 36 (bawaan Flutter 3.47), jadi panggilan    │
/// │ itu melempar SecurityException dan MainActivity gagal start:            │
/// │                                                                        │
/// │     Unable to start activity ... java.lang.SecurityException:           │
/// │     One of RECEIVER_EXPORTED or RECEIVER_NOT_EXPORTED should be         │
/// │     specified ...                                                       │
/// │                                                                        │
/// │ Cacat ini TIDAK disebabkan pemindahan registrasi di atas — sebelum      │
/// │ perubahan pun `onAttachedToActivity` dipanggil (dari                    │
/// │ `attachToActivity()`) dan meledak persis sama; yang berpindah hanya     │
/// │ frame pemanggilnya.                                                     │
/// │                                                                        │
/// │ Obat: [PrinterReceiverExportCompat] — lihat catatan di sana.            │
/// └────────────────────────────────────────────────────────────────────────┘
///
/// ⚠️ Bila plugin ini kelak diperbaiki upstream, buang KETIGA bagiannya
/// sekaligus: tugas Gradle, pendaftaran manual di bawah, dan pembungkus
/// konteksnya. Menyisakan salah satunya membuat printer hilang dari aplikasi
/// utama tanpa satu baris pun terlihat salah.
class MainActivity : FlutterActivity() {

    /// Hidup HANYA selama `plugins.add(FlutterPosPrinterPlatformPlugin())`
    /// berjalan. Lihat [getApplicationContext].
    private var attachingPrinterPlugin = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // Kiosk memakai API Android standar (DevicePolicyManager), sehingga
        // plugin ini dapat ditulis sepenuhnya tanpa SDK vendor mana pun.
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            KioskPlugin.CHANNEL,
        ).setMethodCallHandler(KioskPlugin(this))

        // Pencetakan foreground TIDAK berubah perilakunya.
        //
        // `FlutterActivityAndFragmentDelegate.onAttach()` memanggil
        // `attachToActivity()` LEBIH DULU, baru `configureFlutterEngine()`.
        // Saat baris ini berjalan, engine sudah punya Activity, sehingga
        // `FlutterEngineConnectionRegistry.add()` langsung menyusulkan
        // `onAttachedToActivity` — kanal metode, kanal event, `adapter`,
        // `bluetoothService`, izin BT, dan hasil Activity semuanya tersambung
        // persis seperti sebelumnya. Karena `bluetoothService` kini SELALU
        // terisi pada setiap engine yang memuat plugin ini, cacat 1 tidak
        // punya tempat untuk kambuh.
        attachingPrinterPlugin = true
        try {
            flutterEngine.plugins.add(FlutterPosPrinterPlatformPlugin())
        } finally {
            attachingPrinterPlugin = false
        }
    }

    /// Menyisipkan [PrinterReceiverExportCompat] **hanya** pada jendela sempit
    /// saat plugin printer menyambung.
    ///
    /// Plugin membaca `binding.activity.applicationContext` di baris pertama
    /// `onAttachedToActivity`, lalu memakai konteks itulah untuk
    /// `registerReceiver`. Menukarnya di sini adalah satu-satunya titik yang
    /// dapat dijangkau tanpa menyentuh kode plugin.
    ///
    /// Jendelanya sengaja dipersempit ke satu panggilan sinkron: mengembalikan
    /// pembungkus kepada SEMUA pemanggil akan membuat plugin lain yang menulis
    /// `applicationContext as Application` — pola yang lazim untuk
    /// `registerActivityLifecycleCallbacks` — gagal dengan ClassCastException.
    override fun getApplicationContext(): Context {
        val base: Context = super.getApplicationContext()
        return if (attachingPrinterPlugin) PrinterReceiverExportCompat(base) else base
    }
}

/// Menambahkan `RECEIVER_NOT_EXPORTED` pada `registerReceiver` dua-argumen.
///
/// `NOT_EXPORTED` adalah pilihan yang BENAR di sini, bukan yang paling longgar:
///
///   · `ACTION_USB_PERMISSION` dikirim balik oleh sistem lewat `PendingIntent`
///     milik aplikasi ini sendiri, sehingga tetap sampai pada penerima yang
///     tidak diekspor. Inilah pola yang dianjurkan dokumentasi Android untuk
///     izin USB pada API 34+.
///   · `UsbManager.ACTION_USB_DEVICE_DETACHED` adalah siaran sistem
///     terlindungi; penerima tak-terekspor tetap menerimanya.
///
/// Memakai `RECEIVER_EXPORTED` justru akan membuka penerima printer kepada
/// seluruh aplikasi lain di perangkat — pada mesin kasir, itu permukaan
/// serangan yang tidak dibayar oleh manfaat apa pun.
private class PrinterReceiverExportCompat(base: Context) : ContextWrapper(base) {

    override fun registerReceiver(
        receiver: BroadcastReceiver?,
        filter: IntentFilter,
    ): Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        super.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
        super.registerReceiver(receiver, filter)
    }
}
