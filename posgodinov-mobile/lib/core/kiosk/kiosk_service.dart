import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

/// Tingkat penguncian yang benar-benar aktif.
enum KioskLockLevel {
  /// Perangkat adalah Device Owner: Home & Recents mati total.
  full,

  /// Hanya *screen pinning*: pelanggan dapat keluar dengan menahan
  /// Back + Recents.
  pinningOnly,

  /// Tidak terkunci.
  none,
}

/// Jembatan Dart ke Lock Task Mode ([09 §4.4]).
class KioskService {
  KioskService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'id.godinov.pos/kiosk';

  final MethodChannel _channel;

  /// `true` bila perangkat di-*provision* sebagai Device Owner.
  ///
  /// Menentukan apakah Kiosk benar-benar mengunci atau sekadar menyematkan.
  /// **UI wajib menyatakan ini apa adanya** — pemilik yang mengira perangkatnya
  /// terkunci penuh padahal hanya ter-*pin* akan menemukan pelanggan keluar ke
  /// Home dalam tiga detik.
  Future<bool> get isDeviceOwner async {
    try {
      return await _channel.invokeMethod<bool>('isDeviceOwner') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  Future<bool> get isLocked async {
    try {
      return await _channel.invokeMethod<bool>('isLocked') ?? false;
    } on Object {
      return false;
    }
  }

  /// Masuk mode Kiosk. Mengembalikan tingkat penguncian yang sesungguhnya.
  Future<KioskLockLevel> enter() async {
    // Layar TIDAK boleh mati di mode Kiosk: perangkat berdiri di konter dan
    // pelanggan berikutnya harus langsung menemukannya menyala.
    await WakelockPlus.enable();
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    try {
      final bool full = await _channel.invokeMethod<bool>('enterKiosk') ?? false;
      return full ? KioskLockLevel.full : KioskLockLevel.pinningOnly;
    } on Object {
      // Kanal gagal — mundur dengan bersih, jangan meninggalkan layar dalam
      // mode immersive tanpa penguncian.
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      await WakelockPlus.disable();
      return KioskLockLevel.none;
    }
  }

  Future<void> exit() async {
    try {
      await _channel.invokeMethod('exitKiosk');
    } on Object {
      // Keluar dari mode yang tidak aktif bukan kegagalan.
    }
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    await WakelockPlus.disable();
  }
}
