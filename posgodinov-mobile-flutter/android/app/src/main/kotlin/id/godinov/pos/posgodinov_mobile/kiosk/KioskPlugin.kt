package id.godinov.pos.posgodinov_mobile.kiosk

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Jembatan Lock Task Mode (Kiosk).
 *
 * # Dua tingkat penguncian yang harus dibedakan dengan jujur
 *
 * | Tingkat | Syarat | Kekuatan |
 * |---|---|---|
 * | **Lock Task Mode penuh** | Aplikasi adalah **Device Owner** | Tombol Home & Recents mati total, status bar tidak dapat ditarik |
 * | **Screen Pinning** | Tidak perlu apa pun | Menahan Back + Recents akan keluar |
 *
 * Aplikasi memanggil API yang **sama** (`startLockTask`) untuk keduanya. Yang
 * menentukan kekuatannya adalah status Device Owner perangkat, bukan kode ini.
 * Karena itu [isDeviceOwner] diekspos — UI wajib menyatakan tingkat sebenarnya
 * kepada pemilik, bukan menyiratkan penguncian penuh yang tidak ada.
 */
class KioskPlugin(private val activity: Activity) : MethodChannel.MethodCallHandler {

    companion object {
        const val CHANNEL = "id.godinov.pos/kiosk"
    }

    private val dpm: DevicePolicyManager
        get() = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

    private val admin: ComponentName
        get() = ComponentName(activity, GodinovDeviceAdminReceiver::class.java)

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isDeviceOwner" -> result.success(isDeviceOwner())
            "isLocked" -> result.success(isLocked())
            "enterKiosk" -> result.success(enterKiosk())
            "exitKiosk" -> {
                exitKiosk()
                result.success(true)
            }
            else -> result.notImplemented()
        }
    }

    private fun isDeviceOwner(): Boolean = dpm.isDeviceOwnerApp(activity.packageName)

    private fun isLocked(): Boolean {
        val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    }

    /** Mengembalikan `true` bila penguncian PENUH aktif, `false` bila hanya pinning. */
    private fun enterKiosk(): Boolean {
        val owner = isDeviceOwner()

        if (owner) {
            // Hanya paket ini yang boleh berjalan di Lock Task.
            dpm.setLockTaskPackages(admin, arrayOf(activity.packageName))

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // setLockTaskFeatures adalah daftar-IZIN, bukan daftar-tolak:
                // fitur yang TIDAK disebutkan otomatis mati. Karena HOME dan
                // OVERVIEW tidak disebut, tombol Home & Recents ikut mati.
                dpm.setLockTaskFeatures(
                    admin,
                    DevicePolicyManager.LOCK_TASK_FEATURE_KEYGUARD or
                        DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS,
                )
            }

            // Cegah dialog pembaruan sistem menutupi layar saat jam operasional.
            runCatching {
                dpm.setGlobalSetting(
                    admin,
                    Settings.Global.STAY_ON_WHILE_PLUGGED_IN,
                    "3",
                )
            }
        }

        activity.runOnUiThread {
            activity.startLockTask()
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
        return owner
    }

    private fun exitKiosk() {
        activity.runOnUiThread {
            runCatching { activity.stopLockTask() }
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
}
