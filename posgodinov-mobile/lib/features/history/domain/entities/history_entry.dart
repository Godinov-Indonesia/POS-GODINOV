import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Satu baris riwayat transaksi.
///
/// Dipakai untuk kedua tab P-09 — "Hari Ini" yang dibaca dari SQLite lokal, dan
/// "Sebelumnya" yang ditarik dari server. Bentuknya sengaja sama supaya daftar
/// dan aksi cetak ulang tidak perlu bercabang.
class HistoryEntry extends Equatable {
  const HistoryEntry({
    required this.id,
    required this.shiftId,
    required this.totalMinor,
    required this.paymentMethod,
    required this.status,
    required this.clientCreatedAt,
    required this.isLocal,
    this.customerName = '',
    this.cancelNotes = '',
    this.synced = true,
    this.lines = const <HistoryLine>[],
  });

  final String id;
  final String shiftId;
  final int totalMinor;
  final PaymentMethod paymentMethod;
  final TransactionStatus status;
  final DateTime clientCreatedAt;

  /// `true` bila baris berasal dari basis data perangkat.
  ///
  /// Hanya baris lokal yang dapat di-void dan dicetak ulang: mencetak ulang
  /// struk dari server berarti merakit ulang data yang item-nya tidak lengkap.
  final bool isLocal;

  final String customerName;
  final String cancelNotes;

  /// Selalu `true` untuk baris server — ia ada di sana justru karena tersinkron.
  final bool synced;

  final List<HistoryLine> lines;

  bool get isCancelled => status == TransactionStatus.cancelled;

  bool get canVoid => isLocal && !isCancelled;

  /// Delapan karakter pertama UUID, huruf besar ([06 §2.6]).
  String get shortId =>
      id.replaceAll('-', '').padRight(8, '0').substring(0, 8).toUpperCase();

  @override
  List<Object?> get props => <Object?>[
        id,
        shiftId,
        totalMinor,
        paymentMethod,
        status,
        clientCreatedAt,
        isLocal,
        customerName,
        cancelNotes,
        synced,
        lines,
      ];
}

class HistoryLine extends Equatable {
  const HistoryLine({
    required this.productName,
    required this.quantity,
    required this.unitPriceMinor,
  });

  final String productName;
  final int quantity;
  final int unitPriceMinor;

  int get lineTotalMinor => unitPriceMinor * quantity;

  @override
  List<Object?> get props => <Object?>[productName, quantity, unitPriceMinor];
}
