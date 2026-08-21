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
  /// [reasonCode] berasal dari kamus beku `ReasonCodes.wasteReasons`
  /// ([11 §3.5]); teks bebas saja tidak dapat dikelompokkan laporan pemilik.
  ///
  /// [staffName] hanya untuk DICETAK pada struk pembuangan (butir 7); yang
  /// disimpan tetap [staffId].
  Future<void> report({
    required String staffId,
    required String productId,
    required String productName,
    required int quantity,
    required String reason,
    String reasonCode,
    String staffName,
    String? shiftId,
  });

  Stream<List<WasteEntry>> watchRecent();
}
