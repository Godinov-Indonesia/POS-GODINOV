import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/network/connectivity_monitor.dart';

/// Status jaringan yang terlihat pengguna ([11 §M12.1]).
///
/// | Status     | Arti                                                            |
/// |------------|-----------------------------------------------------------------|
/// | [online]   | Permintaan terakhir berhasil, atau belum ada bukti sebaliknya    |
/// | [degraded] | Antarmuka jaringan ada, tetapi permintaan gagal berulang         |
/// | [offline]  | Sistem operasi menyatakan tidak ada antarmuka jaringan           |
///
/// [degraded] ada karena `connectivity_plus` melaporkan **antarmuka**, bukan
/// keterjangkauan server. Perangkat yang terhubung ke Wi-Fi ruko tanpa uplink,
/// atau di balik captive portal yang belum di-login, tetap dilaporkan
/// terhubung. Menggambarkannya sebagai "Online" membuat kasir melihat ikon
/// hijau sambil antreannya diam-diam menumpuk.
enum NetworkStatus {
  online('Online'),
  degraded('Jaringan bermasalah'),
  offline('Offline');

  const NetworkStatus(this.label);

  /// Label siap tampil — StatusBar dan P-13 memakai sumber yang sama agar
  /// keduanya tidak pernah menyimpang.
  final String label;

  /// Apakah layak mencoba mengirim.
  ///
  /// [degraded] **tetap boleh mencoba**: itulah satu-satunya cara mengetahui
  /// captive portal sudah dilewati. Hanya [offline] yang benar-benar
  /// menghentikan percobaan.
  bool get canAttemptNetwork => this != NetworkStatus.offline;
}

class ConnectivityState extends Equatable {
  const ConnectivityState({
    this.status = NetworkStatus.online,
    this.consecutiveFailures = 0,
    this.lastOkAt,
  });

  /// Bawaannya [NetworkStatus.online] — **default online** (butir 2).
  ///
  /// Perangkat dinyatakan bermasalah hanya setelah ada BUKTI. Menebak "mungkin
  /// offline" saat aplikasi baru dibuka hanya menunda putaran sinkronisasi
  /// pertama tanpa alasan.
  final NetworkStatus status;

  final int consecutiveFailures;
  final DateTime? lastOkAt;

  bool get canAttemptNetwork => status.canAttemptNetwork;

  ConnectivityState copyWith({
    NetworkStatus? status,
    int? consecutiveFailures,
    DateTime? lastOkAt,
  }) =>
      ConnectivityState(
        status: status ?? this.status,
        consecutiveFailures: consecutiveFailures ?? this.consecutiveFailures,
        lastOkAt: lastOkAt ?? this.lastOkAt,
      );

  @override
  List<Object?> get props =>
      <Object?>[status, consecutiveFailures, lastOkAt];
}

/// Satu-satunya muara status jaringan di sisi UI ([11 §M12.1]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// ATURAN R7 — CUBIT INI TIDAK BOLEH MENAVIGASI
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Tidak ada `Navigator`, `context`, atau `GoRouter` di berkas ini, dan tidak
/// boleh ditambahkan. Perpindahan status jaringan terjadi puluhan kali per jam
/// di outlet dengan Wi-Fi buruk; setiap `pushReplacement` yang terikat padanya
/// adalah keranjang yang hilang di depan pelanggan — persis gejala "aplikasi
/// keluar sendiri" yang butir 1 dibangun untuk menutupnya.
///
/// Yang boleh dilakukan perubahan status: mengubah warna indikator,
/// mengaktifkan tombol, dan memicu satu putaran sinkronisasi. Tidak lebih.
class ConnectivityCubit extends Cubit<ConnectivityState> {
  ConnectivityCubit({required ConnectivityMonitor monitor})
      : _monitor = monitor,
        super(const ConnectivityState()) {
    _subscription = _monitor.isOnline.listen(_onInterfaceChanged);
  }

  /// Berapa kegagalan beruntun sebelum status turun ke [NetworkStatus.degraded].
  ///
  /// Satu kegagalan bukan bukti: permintaan tunggal dapat gagal karena timeout
  /// sesaat, dan menurunkan status karenanya membuat indikator berkedip-kedip
  /// sepanjang jam sibuk.
  static const int degradedThreshold = 2;

  final ConnectivityMonitor _monitor;
  StreamSubscription<bool>? _subscription;

  /// Peristiwa dari sistem operasi.
  ///
  /// Jeda 2 detik untuk transisi "kembali online" sudah diterapkan
  /// [ConnectivityMonitor]; di sini tidak ada penundaan tambahan.
  void _onInterfaceChanged(bool hasInterface) {
    if (!hasInterface) {
      // Pernyataan sistem operasi bersifat pasti — tidak perlu ambang batas.
      emit(state.copyWith(status: NetworkStatus.offline));
      return;
    }

    // Antarmuka kembali TIDAK berarti server terjangkau: inilah momen captive
    // portal paling sering muncul. Status naik ke `degraded`, bukan langsung
    // `online`; putaran sinkronisasi berikutnya yang membuktikannya.
    emit(state.copyWith(
      status: state.consecutiveFailures > 0
          ? NetworkStatus.degraded
          : NetworkStatus.online,
    ));
  }

  /// Dipanggil mesin sync setiap kali sebuah permintaan benar-benar berhasil.
  void reportSuccess(DateTime at) => emit(
        ConnectivityState(
          status: NetworkStatus.online,
          consecutiveFailures: 0,
          lastOkAt: at,
        ),
      );

  /// Dipanggil mesin sync saat permintaan gagal di lapisan TRANSPORT.
  ///
  /// ⚠️ **Hanya untuk kegagalan transport.** Response `4xx`/`5xx` yang
  /// benar-benar tiba membuktikan jaringan hidup — memanggilnya untuk galat
  /// semacam itu akan menandai perangkat bermasalah padahal masalahnya di
  /// server.
  void reportFailure() {
    final int failures = state.consecutiveFailures + 1;
    emit(state.copyWith(
      consecutiveFailures: failures,
      // Pernyataan `offline` dari sistem operasi lebih otoritatif daripada
      // tebakan kita; jangan menimpanya menjadi `degraded`.
      status: state.status == NetworkStatus.offline
          ? NetworkStatus.offline
          : failures >= degradedThreshold
              ? NetworkStatus.degraded
              : state.status,
    ));
  }

  @override
  Future<void> close() async {
    await _subscription?.cancel();
    _subscription = null;
    return super.close();
  }
}
