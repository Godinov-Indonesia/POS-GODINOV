import 'package:equatable/equatable.dart';

/// Satu baris keranjang.
///
/// [id] adalah **UUID v4 yang dibuat saat item lahir** dan tidak pernah diganti
/// — ia menjadi `transaction_items.id` saat transaksi disimpan, dan itulah dasar
/// idempotensi sinkronisasi ([03 §2.3]).
class CartLine extends Equatable {
  const CartLine({
    required this.id,
    required this.productId,
    required this.productName,
    required this.unitPriceMinor,
    required this.quantity,
    this.note = '',
  });

  final String id;
  final String productId;

  /// Disalin dari master data, **bukan** hasil join saat render.
  ///
  /// Produk dapat dihapus pemilik dan lenyap dari sync master berikutnya; struk
  /// yang sudah dicetak tidak boleh berubah namanya.
  final String productName;

  /// **INTEGER SEN** — *snapshot* harga saat item ditambahkan.
  ///
  /// Sinkronisasi master di tengah transaksi tidak mengubah nilai ini:
  /// pelanggan membayar harga yang ditunjukkan saat item dipilih.
  final int unitPriceMinor;

  final int quantity;

  /// Catatan kasir, mis. *"less sugar"*. Tidak dikirim ke server — tabel
  /// `transaction_items` tidak punya kolomnya ([02 §2.13]).
  final String note;

  /// **INTEGER SEN.** Perkalian eksak; tidak ada pembulatan yang bisa hanyut.
  int get lineTotalMinor => unitPriceMinor * quantity;

  CartLine copyWith({int? quantity, String? note}) => CartLine(
        id: id,
        productId: productId,
        productName: productName,
        unitPriceMinor: unitPriceMinor,
        quantity: quantity ?? this.quantity,
        note: note ?? this.note,
      );

  @override
  List<Object?> get props =>
      <Object?>[id, productId, productName, unitPriceMinor, quantity, note];
}
