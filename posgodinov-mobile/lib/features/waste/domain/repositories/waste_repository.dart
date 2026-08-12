import 'package:equatable/equatable.dart';

/// Laporan waste produk jadi.
class WasteEntry extends Equatable {
  const WasteEntry({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.reason,
    required this.reportedAt,
    required this.synced,
  });

  final String id;
  final String productName;
  final int quantity;
  final String reason;
  final DateTime reportedAt;
  final bool synced;

  @override
  List<Object?> get props =>
      <Object?>[id, productName, quantity, reason, reportedAt, synced];
}

abstract interface class WasteRepository {
  /// Melaporkan produk yang terbuang.
  ///
  /// Masuk antrean sinkronisasi dengan kunci payload **`wastes`**, bukan
  /// `product_wastes` ([03 §2.3]).
  Future<void> report({
    required String staffId,
    required String productId,
    required String productName,
    required int quantity,
    required String reason,
  });

  Stream<List<WasteEntry>> watchRecent();
}
