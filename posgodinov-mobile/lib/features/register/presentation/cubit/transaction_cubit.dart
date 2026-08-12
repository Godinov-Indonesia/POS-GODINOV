import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:posgodinov_mobile/features/register/domain/cart_math.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/sale_transaction.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';

/// Mesin status transaksi — **satu-satunya state machine sejati di aplikasi**.
///
/// Transisi dibatasi `sealed class` agar keadaan mustahil tidak dapat
/// direpresentasikan ([09 §7.3]):
///
/// ```text
/// idle → selectingPayment → confirming → persisting → printing → completed
///                                            └────────────────→ failed
/// ```
sealed class TransactionState extends Equatable {
  const TransactionState();

  @override
  List<Object?> get props => <Object?>[];
}

final class TxIdle extends TransactionState {
  const TxIdle();
}

final class TxSelectingPayment extends TransactionState {
  const TxSelectingPayment({required this.totalMinor});

  final int totalMinor;

  @override
  List<Object?> get props => <Object?>[totalMinor];
}

final class TxConfirming extends TransactionState {
  const TxConfirming({
    required this.method,
    required this.totalMinor,
    required this.cashReceivedMinor,
  });

  final PaymentMethod method;
  final int totalMinor;
  final int cashReceivedMinor;

  /// Negatif berarti uang pelanggan kurang.
  int get changeMinor => CartMath.change(
        totalMinor: totalMinor,
        cashReceivedMinor: cashReceivedMinor,
      );

  /// Metode non-tunai selalu dianggap pas ([06 §4.6.2]).
  bool get isPayable => method != PaymentMethod.cash
      ? true
      : CartMath.isCashSufficient(
          totalMinor: totalMinor,
          cashReceivedMinor: cashReceivedMinor,
        );

  TxConfirming copyWith({PaymentMethod? method, int? cashReceivedMinor}) =>
      TxConfirming(
        method: method ?? this.method,
        totalMinor: totalMinor,
        cashReceivedMinor: cashReceivedMinor ?? this.cashReceivedMinor,
      );

  @override
  List<Object?> get props => <Object?>[method, totalMinor, cashReceivedMinor];
}

/// Sedang menulis ke SQLite. Tidak dapat dibatalkan.
final class TxPersisting extends TransactionState {
  const TxPersisting();
}

final class TxPrinting extends TransactionState {
  const TxPrinting(this.transaction);

  final SaleTransaction transaction;

  @override
  List<Object?> get props => <Object?>[transaction];
}

final class TxCompleted extends TransactionState {
  const TxCompleted({required this.transaction, required this.printOk});

  final SaleTransaction transaction;

  /// `false` menampilkan tombol **Cetak Ulang** di P-07 — transaksi **tetap**
  /// tersimpan dan tetap masuk antrean sinkronisasi.
  final bool printOk;

  @override
  List<Object?> get props => <Object?>[transaction, printOk];
}

/// Kegagalan **menyimpan** — satu-satunya kegagalan yang membatalkan transaksi.
final class TxFailed extends TransactionState {
  const TxFailed(this.message);

  final String message;

  @override
  List<Object?> get props => <Object?>[message];
}

/// P-06 & P-07.
class TransactionCubit extends Cubit<TransactionState> {
  TransactionCubit({
    required RegisterRepository repository,
    required ReceiptPrinter printer,
    required String outletName,
    Future<void> Function()? onPersisted,
  })  : _repository = repository,
        _printer = printer,
        _outletName = outletName,
        _onPersisted = onPersisted,
        super(const TxIdle());

  final RegisterRepository _repository;
  final ReceiptPrinter _printer;
  final String _outletName;

  /// Pemicu sinkronisasi, dipasang pada M5. Dipanggil *fire-and-forget*:
  /// antrean lokal tetap aman bila gagal.
  final Future<void> Function()? _onPersisted;

  /// Membuka modal pembayaran.
  void startPayment(int totalMinor) {
    if (totalMinor <= 0) return;
    emit(TxSelectingPayment(totalMinor: totalMinor));
  }

  /// Memilih metode pembayaran.
  ///
  /// Nilai hanya berasal dari enum [PaymentMethod] — tidak ada input teks bebas
  /// dan tidak ada opsi "Lainnya" ([09 §9.3]).
  void selectMethod(PaymentMethod method) {
    final TransactionState s = state;
    final int total = switch (s) {
      TxSelectingPayment(totalMinor: final int t) => t,
      TxConfirming(totalMinor: final int t) => t,
      _ => -1,
    };
    if (total < 0) return;

    emit(
      TxConfirming(
        method: method,
        totalMinor: total,
        // Non-tunai: nominal dikunci sama dengan total ([06 §4.6.2]).
        cashReceivedMinor: method == PaymentMethod.cash ? 0 : total,
      ),
    );
  }

  /// Menetapkan uang yang diterima. Hanya bermakna untuk `CASH`.
  void setCashReceived(int cashReceivedMinor) {
    final TransactionState s = state;
    if (s is! TxConfirming || s.method != PaymentMethod.cash) return;
    emit(s.copyWith(cashReceivedMinor: cashReceivedMinor));
  }

  /// Kembali ke keranjang tanpa menyimpan apa pun.
  void cancel() => emit(const TxIdle());

  /// **Titik paling kritis di aplikasi.**
  ///
  /// Urutannya tidak boleh ditukar:
  ///
  /// 1. **Simpan dulu.** Uang sudah diterima; transaksi tidak boleh hilang
  ///    karena printer bermasalah.
  /// 2. **Cetak.** Kegagalan di sini **tidak** membatalkan apa pun.
  /// 3. **Picu sync**, *fire-and-forget*.
  Future<void> confirmPayment({
    required String shiftId,
    required String cashierName,
    required List<CartLine> lines,
    String customerName = '',
  }) async {
    final TransactionState s = state;
    if (s is! TxConfirming) return; // transisi tidak sah — abaikan
    if (!s.isPayable || lines.isEmpty) return;

    emit(const TxPersisting());

    final SaleTransaction transaction;
    try {
      transaction = await _repository.completeSale(
        shiftId: shiftId,
        lines: lines,
        paymentMethod: s.method,
        cashReceivedMinor: s.cashReceivedMinor,
        customerName: customerName,
      );
    } on Object catch (e) {
      // SATU-SATUNYA jalur yang membatalkan transaksi: penyimpanan gagal,
      // sehingga tidak ada apa pun yang tercatat.
      emit(TxFailed('Gagal menyimpan transaksi: $e'));
      return;
    }

    emit(TxPrinting(transaction));

    final bool printOk = await _printer.printReceipt(
      _buildReceipt(transaction, cashierName),
    );

    unawaited(_onPersisted?.call() ?? Future<void>.value());

    emit(TxCompleted(transaction: transaction, printOk: printOk));
  }

  /// Mencetak ulang struk transaksi yang **sudah** tersimpan.
  Future<void> reprint() async {
    final TransactionState s = state;
    if (s is! TxCompleted) return;

    final bool ok = await _printer.printReceipt(
      _buildReceipt(s.transaction, ''),
    );
    emit(TxCompleted(transaction: s.transaction, printOk: ok));
  }

  /// Menutup struk dan kembali ke keranjang kosong.
  void finish() => emit(const TxIdle());

  ReceiptData _buildReceipt(SaleTransaction tx, String cashierName) {
    return ReceiptData(
      transactionId: tx.id,
      shortId: tx.shortId,
      outletName: _outletName,
      cashierName: cashierName,
      lines: tx.lines
          .map(
            (CartLine l) => ReceiptLine(
              productName: l.productName,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
            ),
          )
          .toList(growable: false),
      totalMinor: tx.totalAmountMinor,
      paymentMethod: tx.paymentMethod,
      cashReceivedMinor: tx.cashReceivedMinor,
      changeMinor: tx.changeMinor,
      issuedAt: tx.clientCreatedAt,
      customerName: tx.customerName,
    );
  }
}
