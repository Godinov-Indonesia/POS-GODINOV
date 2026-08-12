import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:posgodinov_mobile/core/network/connectivity_monitor.dart';
import 'package:posgodinov_mobile/core/sync/sync_engine.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';

/// Memasang seluruh pemicu sinkronisasi otomatis ([09 §6.4]).
///
/// | Pemicu | Catatan |
/// |---|---|
/// | Startup | Menangkap antrean sesi sebelumnya |
/// | Koneksi kembali | Jeda 2 detik sudah ditangani `ConnectivityMonitor` |
/// | Berkala 5 menit | **Dihentikan** saat aplikasi di latar, demi baterai |
/// | Kembali ke depan | Menangkap aplikasi yang lama di-*suspend* |
/// | Tutup shift | Dipanggil langsung dari P-12 (M7) |
/// | Manual | Tombol P-13, mengabaikan backoff |
///
/// Sinkronisasi saat aplikasi **tertutup** memerlukan WorkManager dan menyusul
/// di M8; sampai saat itu, batasan [05 §1.6.6] masih berlaku dan wajib
/// dinyatakan ke pengguna di P-13.
class SyncTriggers with WidgetsBindingObserver {
  SyncTriggers({
    required SyncEngine engine,
    required ConnectivityMonitor connectivity,
    this.periodicInterval = const Duration(minutes: 5),
  })  : _engine = engine,
        _connectivity = connectivity;

  final SyncEngine _engine;
  final ConnectivityMonitor _connectivity;
  final Duration periodicInterval;

  StreamSubscription<bool>? _connectivitySub;
  Timer? _timer;
  bool _installed = false;

  /// Memasang pemicu dan langsung menjalankan putaran `startup`.
  void install() {
    if (_installed) return;
    _installed = true;

    WidgetsBinding.instance.addObserver(this);

    _connectivitySub = _connectivity.isOnline.listen((bool online) {
      // Jeda 2 detik sudah diterapkan di ConnectivityMonitor: peristiwa
      // "kembali online" dari OS mendahului kesiapan jaringan yang sebenarnya.
      if (online) _fire(SyncTrigger.online);
    });

    _startTimer();
    _fire(SyncTrigger.startup);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _startTimer();
        _fire(SyncTrigger.resumed);
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        // Timer dimatikan di latar; WorkManager (M8) yang mengambil alih.
        _stopTimer();
      case AppLifecycleState.inactive:
        break;
    }
  }

  /// Dipanggil tepat setelah sebuah transaksi tersimpan.
  void onTransactionSaved() => _fire(SyncTrigger.transaction);

  /// Dipanggil dari P-12 — momen paling penting, laci sudah dihitung.
  void onShiftClosed() => _fire(SyncTrigger.shiftClose);

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(
      periodicInterval,
      (_) => _fire(SyncTrigger.periodic),
    );
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  /// Menembakkan sinkronisasi tanpa menunggu hasilnya.
  ///
  /// Kegagalan sengaja ditelan: antrean lokal tetap utuh apa pun yang terjadi,
  /// dan pemicu berikutnya akan mencoba lagi. Yang tidak boleh adalah
  /// membiarkan `Future` gagal merambat ke zona global dan memunculkan dialog
  /// error di depan kasir yang sedang melayani pelanggan.
  void _fire(SyncTrigger trigger) {
    unawaited(_engine.syncUp(trigger).catchError((Object _) {
      return const SyncOutcome(ok: false);
    }));
  }

  Future<void> dispose() async {
    if (!_installed) return;
    _installed = false;

    WidgetsBinding.instance.removeObserver(this);
    _stopTimer();
    await _connectivitySub?.cancel();
    _connectivitySub = null;
  }
}
