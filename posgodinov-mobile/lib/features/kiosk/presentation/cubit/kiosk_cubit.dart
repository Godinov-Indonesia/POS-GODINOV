import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/kiosk/kiosk_guard.dart';
import 'package:posgodinov_mobile/core/kiosk/kiosk_service.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/shared/theme/breakpoints.dart';

/// Tahap yang dilihat pelanggan.
enum KioskStep {
  /// Layar sambutan. Kembali ke sini setiap idle timeout.
  welcome,

  /// Katalog produk.
  browsing,

  /// Tinjau pesanan sebelum dikirim.
  review,

  /// Konfirmasi + nomor antrean.
  submitted,
}

class KioskState extends Equatable {
  const KioskState({
    this.enabled = false,
    this.lockLevel = KioskLockLevel.none,
    this.step = KioskStep.welcome,
    this.lines = const <CartLine>[],
    this.queueLabel,
    this.submitting = false,
    this.error,
  });

  final bool enabled;
  final KioskLockLevel lockLevel;
  final KioskStep step;
  final List<CartLine> lines;

  /// Label pesanan yang ditunjukkan pelanggan ke kasir.
  final String? queueLabel;

  final bool submitting;
  final String? error;

  int get itemCount =>
      lines.fold(0, (int sum, CartLine l) => sum + l.quantity);

  int get totalMinor =>
      lines.fold(0, (int sum, CartLine l) => sum + l.lineTotalMinor);

  bool get isEmpty => lines.isEmpty;

  /// `true` bila penguncian yang aktif hanya *screen pinning*.
  ///
  /// Layar Pengaturan memakai ini untuk memperingatkan pemilik apa adanya.
  bool get isWeakLock => enabled && lockLevel == KioskLockLevel.pinningOnly;

  KioskState copyWith({
    bool? enabled,
    KioskLockLevel? lockLevel,
    KioskStep? step,
    List<CartLine>? lines,
    String? queueLabel,
    bool? submitting,
    String? error,
    bool clearError = false,
    bool clearQueue = false,
  }) =>
      KioskState(
        enabled: enabled ?? this.enabled,
        lockLevel: lockLevel ?? this.lockLevel,
        step: step ?? this.step,
        lines: lines ?? this.lines,
        queueLabel: clearQueue ? null : (queueLabel ?? this.queueLabel),
        submitting: submitting ?? this.submitting,
        error: clearError ? null : (error ?? this.error),
      );

  @override
  List<Object?> get props => <Object?>[
        enabled,
        lockLevel,
        step,
        lines,
        queueLabel,
        submitting,
        error,
      ];
}

/// Mode Kiosk — pesan mandiri pelanggan ([09 §3.6]).
class KioskCubit extends Cubit<KioskState> {
  KioskCubit({
    required KioskService service,
    required KioskGuard guard,
    required HeldCartRepository heldCarts,
  })  : _service = service,
        _guard = guard,
        _heldCarts = heldCarts,
        super(const KioskState());

  final KioskService _service;
  final KioskGuard _guard;
  final HeldCartRepository _heldCarts;

  Timer? _idleTimer;

  Future<void> enable() async {
    final KioskLockLevel level = await _service.enter();
    emit(
      state.copyWith(
        enabled: true,
        lockLevel: level,
        step: KioskStep.welcome,
        lines: const <CartLine>[],
      ),
    );
  }

  Future<void> disable() async {
    _idleTimer?.cancel();
    await _service.exit();
    emit(const KioskState());
  }

  // ── Interaksi pelanggan ────────────────────────────────────────────────────

  void start() {
    _touch();
    emit(state.copyWith(step: KioskStep.browsing, clearQueue: true));
  }

  void addProduct(CartLine line) {
    _touch();
    final int idx =
        state.lines.indexWhere((CartLine l) => l.productId == line.productId);

    if (idx >= 0) {
      final List<CartLine> updated = List<CartLine>.of(state.lines);
      updated[idx] =
          updated[idx].copyWith(quantity: updated[idx].quantity + 1);
      emit(state.copyWith(lines: updated));
      return;
    }
    emit(state.copyWith(lines: <CartLine>[...state.lines, line]));
  }

  void setQuantity(String lineId, int quantity) {
    _touch();
    if (quantity <= 0) {
      emit(
        state.copyWith(
          lines: state.lines
              .where((CartLine l) => l.id != lineId)
              .toList(growable: false),
        ),
      );
      return;
    }
    emit(
      state.copyWith(
        lines: state.lines
            .map(
              (CartLine l) =>
                  l.id == lineId ? l.copyWith(quantity: quantity) : l,
            )
            .toList(growable: false),
      ),
    );
  }

  void review() {
    _touch();
    if (!state.isEmpty) emit(state.copyWith(step: KioskStep.review));
  }

  void backToBrowsing() {
    _touch();
    emit(state.copyWith(step: KioskStep.browsing));
  }

  /// Mengirim pesanan.
  ///
  /// > **Pesanan menjadi keranjang tertahan, BUKAN transaksi selesai.**
  /// > Lihat penyimpangan M9 #1: sistem ini tidak memiliki payment gateway
  /// > ([03 §14]), sehingga pembayaran tidak dapat terjadi di kiosk. Mencatat
  /// > transaksi `COMPLETED` sebelum uang diterima akan memotong stok dan
  /// > menghitung pendapatan atas pesanan yang mungkin tidak pernah dibayar.
  Future<void> submit() async {
    if (state.submitting || state.isEmpty) return;
    emit(state.copyWith(submitting: true, clearError: true));

    try {
      final String label = _queueLabel();
      await _heldCarts.hold(lines: state.lines, label: label);

      emit(
        state.copyWith(
          submitting: false,
          step: KioskStep.submitted,
          queueLabel: label,
          lines: const <CartLine>[],
        ),
      );
      _restartIdleTimer(const Duration(seconds: 20));
    } on Object catch (e) {
      emit(
        state.copyWith(
          submitting: false,
          error: 'Pesanan gagal disimpan: $e',
        ),
      );
    }
  }

  // ── Gerbang keluar ─────────────────────────────────────────────────────────

  /// Ketukan pada area tersembunyi. `true` berarti dialog PIN layak dibuka.
  bool registerExitTap() => _guard.registerTap();

  /// Memverifikasi PIN staff, lalu keluar bila cocok.
  Future<bool> attemptExit(String pin) async {
    final bool ok = await _guard.verifyExitPin(pin);
    if (ok) await disable();
    return ok;
  }

  // ── Idle ───────────────────────────────────────────────────────────────────

  /// Pelanggan yang pergi tidak boleh meninggalkan pesanan setengah jadi untuk
  /// orang berikutnya.
  void _touch() => _restartIdleTimer(KioskLayout.idleTimeout);

  void _restartIdleTimer(Duration after) {
    _idleTimer?.cancel();
    _idleTimer = Timer(after, () {
      if (state.enabled) {
        emit(
          state.copyWith(
            step: KioskStep.welcome,
            lines: const <CartLine>[],
            clearQueue: true,
          ),
        );
      }
    });
  }

  /// Label antrean sederhana dari jam — cukup untuk dicocokkan kasir, dan tidak
  /// memerlukan penomoran yang harus disinkronkan antar-perangkat.
  String _queueLabel() {
    final DateTime t = DateTime.now();
    return 'Kiosk ${t.hour.toString().padLeft(2, '0')}'
        '${t.minute.toString().padLeft(2, '0')}'
        '${t.second.toString().padLeft(2, '0')}';
  }

  @override
  Future<void> close() {
    _idleTimer?.cancel();
    return super.close();
  }
}
