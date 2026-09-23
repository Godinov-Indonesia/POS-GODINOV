import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// Memantau ketersediaan jaringan dan memicu mesin sinkronisasi.
///
/// ## Debounce yang sengaja asimetris
///
/// Peristiwa "kembali online" dari sistem operasi **mendahului** kesiapan
/// jaringan yang sebenarnya: antarmuka sudah terpasang, tetapi DHCP, DNS, atau
/// captive portal Wi-Fi outlet belum selesai. Menembak sinkronisasi pada
/// milidetik pertama menghasilkan `POST /v1/pos/sync` yang gagal, lalu backoff
/// eksponensial menendang mundur percobaan berikutnya — persis kebalikan dari
/// yang diinginkan ([05 §1.6.4] menyarankan jeda 2 detik).
///
/// Karena itu:
///
/// | Transisi | Perlakuan |
/// |---|---|
/// | offline → **online** | ditunda [onlineDebounce] (default 2 detik) |
/// | online → **offline** | dipancarkan **seketika** |
///
/// Menunda kabar buruk tidak masuk akal: selama jeda itu aplikasi akan mengira
/// dirinya online dan tetap mencoba mengirim.
///
/// ## Yang TIDAK dijamin kelas ini
///
/// `connectivity_plus` melaporkan **antarmuka jaringan**, bukan keterjangkauan
/// server. Perangkat yang terhubung ke Wi-Fi tanpa akses internet tetap
/// dilaporkan `true`. Itu dapat diterima: mesin sinkronisasi memperlakukan
/// kegagalan transport sebagai `NetworkFailure` yang dapat dicoba ulang, dan
/// antrean lokal tetap utuh apa pun yang terjadi ([09 §6.1]).
class ConnectivityMonitor {
  ConnectivityMonitor({
    Connectivity? connectivity,
    this.onlineDebounce = const Duration(seconds: 2),
  }) : _connectivity = connectivity ?? Connectivity() {
    _subscription = _connectivity.onConnectivityChanged.listen(
      _handleRawEvent,
      onError: (Object _) {
        // Kegagalan kanal platform tidak boleh mematikan pemantauan. Anggap
        // offline; percobaan berikutnya akan mengoreksinya sendiri.
        _emit(false);
      },
    );
    unawaited(_seedInitialState());
  }

  final Connectivity _connectivity;

  /// Jeda sebelum status `online` dipancarkan.
  final Duration onlineDebounce;

  final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  StreamSubscription<List<ConnectivityResult>>? _subscription;
  Timer? _onlineTimer;

  bool _lastEmitted = false;
  bool _hasEmitted = false;

  /// Status terakhir yang dipancarkan. `false` sampai pengukuran pertama tiba.
  bool get lastKnownStatus => _lastEmitted;

  /// Aliran status koneksi, sudah melewati debounce dan deduplikasi.
  ///
  /// *Broadcast*: StatusBar, mesin sinkronisasi, dan layar Pengaturan boleh
  /// menyimak bersamaan.
  Stream<bool> get isOnline => _controller.stream;

  /// Pemeriksaan sekali jalan, **tanpa** debounce.
  ///
  /// Dipakai mesin sinkronisasi sebagai gerbang tepat sebelum mengirim, dan oleh
  /// tombol sync manual di P-13 yang memang harus langsung bertindak.
  Future<bool> get checkOnline async {
    try {
      final List<ConnectivityResult> results =
          await _connectivity.checkConnectivity();
      return _isConnected(results);
    } on Exception {
      return false;
    }
  }

  Future<void> _seedInitialState() async {
    final bool online = await checkOnline;
    // Status awal dipancarkan apa adanya — tidak ada transisi yang perlu
    // ditunggu, dan penyimak pertama butuh nilai untuk dirender.
    _emit(online);
  }

  void _handleRawEvent(List<ConnectivityResult> results) {
    final bool online = _isConnected(results);

    if (!online) {
      _onlineTimer?.cancel();
      _onlineTimer = null;
      _emit(false);
      return;
    }

    // Sudah online dan tetap online — tidak ada yang perlu dijadwalkan ulang.
    if (_hasEmitted && _lastEmitted) return;

    _onlineTimer?.cancel();
    _onlineTimer = Timer(onlineDebounce, () {
      _onlineTimer = null;
      _emit(true);
    });
  }

  /// `ConnectivityResult.none` adalah satu-satunya penanda tidak ada jaringan.
  ///
  /// Sejak `connectivity_plus` 6.x, pemeriksaan mengembalikan **daftar** —
  /// perangkat dapat terhubung ke Wi-Fi dan seluler sekaligus.
  bool _isConnected(List<ConnectivityResult> results) {
    if (results.isEmpty) return false;
    return results
        .any((ConnectivityResult r) => r != ConnectivityResult.none);
  }

  void _emit(bool online) {
    if (_controller.isClosed) return;
    // Deduplikasi: penyimak tidak perlu dibangunkan untuk status yang sama.
    if (_hasEmitted && online == _lastEmitted) return;

    _lastEmitted = online;
    _hasEmitted = true;
    _controller.add(online);
  }

  Future<void> dispose() async {
    _onlineTimer?.cancel();
    _onlineTimer = null;
    await _subscription?.cancel();
    _subscription = null;
    await _controller.close();
  }
}
