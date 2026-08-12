package id.godinov.pos.posgodinov_mobile

import id.godinov.pos.posgodinov_mobile.kiosk.KioskPlugin
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // Kiosk memakai API Android standar (DevicePolicyManager), sehingga
        // plugin ini dapat ditulis sepenuhnya tanpa SDK vendor mana pun.
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            KioskPlugin.CHANNEL,
        ).setMethodCallHandler(KioskPlugin(this))
    }
}
