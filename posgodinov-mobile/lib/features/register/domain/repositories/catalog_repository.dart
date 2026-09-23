import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';

/// Katalog produk untuk layar kasir (P-05).
///
/// Baca-saja: seluruh isinya berasal dari sinkronisasi master data, dan POS
/// tidak memiliki jalur untuk mengubah produk maupun kategori ([09 §9.5]).
abstract interface class CatalogRepository {
  /// Aliran produk, dapat disaring per kategori.
  ///
  /// Berupa `Stream` agar grid ikut menyegarkan diri saat sinkronisasi master
  /// berjalan di latar — tanpa perlu ada yang memanggil ulang.
  Stream<List<CatalogProduct>> watchProducts({String? categoryId});

  Future<List<CatalogCategory>> categories();

  Future<int> totalProductCount();
}
