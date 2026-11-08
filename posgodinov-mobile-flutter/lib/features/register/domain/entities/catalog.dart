import 'package:equatable/equatable.dart';

/// Produk di katalog kasir.
///
/// > ⚠️ **Tidak ada field stok, dan itu disengaja.** Master data POS tidak
/// > memuat stok maupun resep (BOM) — kode backend menyebutnya *"SENGAJA
/// > DIHAPUS dari payload klien"* ([03 §2.2]). Menambahkan field stok di sini
/// > akan mengundang UI menampilkan angka yang tidak pernah benar.
class CatalogProduct extends Equatable {
  const CatalogProduct({
    required this.id,
    required this.name,
    required this.priceMinor,
    this.imageUrl,
    this.categoryId,
  });

  final String id;
  final String name;

  /// **INTEGER SEN.**
  final int priceMinor;

  final String? imageUrl;
  final String? categoryId;

  @override
  List<Object?> get props =>
      <Object?>[id, name, priceMinor, imageUrl, categoryId];
}

class CatalogCategory extends Equatable {
  const CatalogCategory({
    required this.id,
    required this.name,
    required this.productCount,
  });

  final String id;
  final String name;
  final int productCount;

  @override
  List<Object?> get props => <Object?>[id, name, productCount];
}
