import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/catalog.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/catalog_repository.dart';

class CatalogRepositoryImpl implements CatalogRepository {
  const CatalogRepositoryImpl(this._dao);

  final MasterDao _dao;

  @override
  Stream<List<CatalogProduct>> watchProducts({String? categoryId}) {
    return _dao.watchProducts(categoryId: categoryId).map(
          (List<Product> rows) => rows
              .map(
                (Product p) => CatalogProduct(
                  id: p.id,
                  name: p.name,
                  // Sudah INTEGER SEN sejak dikonversi di batas API.
                  priceMinor: p.priceMinor,
                  imageUrl: p.imageUrl,
                  categoryId: p.categoryId,
                ),
              )
              .toList(growable: false),
        );
  }

  @override
  Future<List<CatalogCategory>> categories() async {
    final List<Category> rows = await _dao.allCategories();

    // Hitungan produk per kategori dibaca sekali di sini agar tab tidak perlu
    // melakukan query sendiri-sendiri saat dirender.
    final List<Product> products = await _dao.watchProducts().first;
    final Map<String, int> jumlah = <String, int>{};
    for (final Product p in products) {
      final String? key = p.categoryId;
      if (key != null) jumlah[key] = (jumlah[key] ?? 0) + 1;
    }

    return rows
        .map(
          (Category c) => CatalogCategory(
            id: c.id,
            name: c.name,
            productCount: jumlah[c.id] ?? 0,
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<int> totalProductCount() async =>
      (await _dao.watchProducts().first).length;
}
