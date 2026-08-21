import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';

/// Transaksi penjualan yang **sudah tersimpan** di perangkat.
///
/// Keberadaan objek ini berarti baris sudah ada di SQLite — uang sudah aman
/// dicatat. Pencetakan struk terjadi **setelah** ini, dan kegagalannya tidak
/// pernah membatalkan transaksi ([09 §7.3]).
class SaleTransaction extends Equatable {
  const SaleTransaction({
    required this.id,
    required this.shiftId,
    required this.lines,
    required this.totalAmountMinor,
    required this.paymentMethod,
    required this.status,
    required this.clientCreatedAt,
    this.customerName = '',
    this.cashReceivedMinor = 0,
  });

  /// UUID v4 dibuat klien, **tidak pernah** diregenerasi saat kirim ulang.
  final String id;

  final String shiftId;
  final List<CartLine> lines;

  /// **INTEGER SEN.**
  final int totalAmountMinor;

  final PaymentSummary paymentMethod;
  final TransactionStatus status;
  final DateTime clientCreatedAt;
  final String customerName;

  /// Uang yang diterima kasir. **Tidak dikirim ke server** — kolomnya tidak ada
  /// ([02 §2.12]); nilainya hanya dipakai untuk struk dan hitungan kembalian.
  final int cashReceivedMinor;

  int get changeMinor =>
      paymentMethod.isCash
          ? cashReceivedMinor - totalAmountMinor
          : 0;

  /// Delapan karakter pertama UUID, huruf besar — nomor transaksi yang dibaca
  /// manusia pada struk dan riwayat ([06 §2.6]).
  String get shortId => id.replaceAll('-', '').substring(0, 8).toUpperCase();

  @override
  List<Object?> get props => <Object?>[
        id,
        shiftId,
        lines,
        totalAmountMinor,
        paymentMethod,
        status,
        clientCreatedAt,
        customerName,
        cashReceivedMinor,
      ];
}
