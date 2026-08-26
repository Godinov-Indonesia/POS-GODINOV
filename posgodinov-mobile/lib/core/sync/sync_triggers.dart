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
    this.commitDebounce = const Duration(milliseconds: 1500),
  })  : _engine = engine,
        _connectivity = connectivity;

  final SyncEngine _engine;
  final ConnectivityMonitor _connectivity;
  final Duration periodicInterval;

  /// Jendela penggabungan setelah sebuah commit ([11 §M12.2]).
  ///
  /// 1,5 detik dipilih dari dua arah sekaligus:
  ///
  /// - **Cukup lama** untuk menggabungkan transaksi beruntun pada jam sibuk.
  ///   Tanpa jendela ini, sepuluh struk dalam dua puluh detik menghasilkan
  ///   sepuluh `POST /v1/pos/sync` — masing-masing membawa ulang shift induk
  ///   yang sama, masing-masing membuka koneksi baru pada jaringan outlet yang
  ///   sempit, dan masing-masing membangunkan radio seluler.
  /// - **Cukup singkat** agar kasir yang menyelesaikan transaksi terakhir lalu
  ///   langsung menutup shift tidak menunggu. Jendela ini juga tidak menahan
  ///   apa pun: barisnya sudah aman di SQLite sejak milidetik pertama.
  final Duration commitDebounce;

  StreamSubscription<bool>? _connectivitySub;
  Timer? _timer;

  /// Satu timer bersama untuk SELURUH commit dalam jendela — sepuluh transaksi
  /// beruntun menjadwalkan ulang timer yang sama, bukan sepuluh timer.
  Timer? _commitTimer;
  SyncTrigger _pendingCommitTrigger = SyncTrigger.transactionCommit;

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
  ///
  /// ⚠️ Urutannya mengikat: tulis ke basis data DULU, panggil ini KEMUDIAN.
  /// Memanggilnya lebih awal berarti mesin sync dapat membaca antrean sebelum
  /// barisnya ada, lalu menyimpulkan tidak ada yang perlu dikirim.
  void onTransactionSaved() => _scheduleCommit(SyncTrigger.transactionCommit);

  /// Dipanggil setelah sebuah pembatalan tersimpan.
  void onVoidSaved() => _scheduleCommit(SyncTrigger.voidCommit);

  /// Dipanggil setelah sebuah retur tersimpan.
  void onReturnSaved() => _scheduleCommit(SyncTrigger.returnCommit);

  /// Dipanggil dari P-12 — momen paling penting, laci sudah dihitung.
  ///
  /// **Tidak** melewati debounce: kasir biasanya menutup aplikasi tepat setelah
  /// ini, dan menahannya 1,5 detik berisiko kehilangan kesempatan terakhir
  /// mengirim selagi aplikasi masih hidup.
  void onShiftClosed() => _fire(SyncTrigger.shiftClose);

  /// Menjadwalkan pengiriman dengan penggabungan.
  void _scheduleCommit(SyncTrigger trigger) {
    // Pembatalan dan retur menang atas penjualan biasa ketika keduanya jatuh di
    // jendela yang sama. Bukan soal kecepatan — keduanya terkirim di batch yang
    // sama — melainkan agar `syncLog` mencatat alasan yang paling layak
    // ditelusuri.
    if (trigger != SyncTrigger.transactionCommit) {
      _pendingCommitTrigger = trigger;
    }

    _commitTimer?.cancel();
    _commitTimer = Timer(commitDebounce, () {
      _commitTimer = null;
      final SyncTrigger fired = _pendingCommitTrigger;
      _pendingCommitTrigger = SyncTrigger.transactionCommit;
      _fire(fired);
    });
  }

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
    }),);
  }

  Future<void> dispose() async {
    if (!_installed) return;
    _installed = false;

    WidgetsBinding.instance.removeObserver(this);
    _stopTimer();
    _commitTimer?.cancel();
    _commitTimer = null;
    await _connectivitySub?.cancel();
    _connectivitySub = null;
  }
}
