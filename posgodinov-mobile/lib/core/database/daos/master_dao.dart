import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/categories_table.dart';
import 'package:posgodinov_mobile/core/database/tables/products_table.dart';
import 'package:posgodinov_mobile/core/database/tables/staffs_table.dart';

part 'master_dao.g.dart';

@DriftAccessor(tables: <Type>[Staffs, Categories, Products])
class MasterDao extends DatabaseAccessor<AppDatabase> with _$MasterDaoMixin {
  MasterDao(super.db);

  /// Menyimpan snapshot master data hasil `GET /v1/pos/sync/master-data`.
  ///
  /// **Memakai upsert + pembuangan selektif, bukan `delete()` lalu `insert()`.**
  /// Mengosongkan tabel lebih dulu meninggalkan jendela waktu — sekecil apa pun
  /// — ketika perangkat tidak punya daftar staff sama sekali. Bila proses mati
  /// tepat di jendela itu, kasir tidak dapat login dan outlet berhenti berjualan
  /// sampai ada koneksi ([05 §Fase 9]).
  ///
  /// Baris yang tidak lagi ada di payload terbaru dibuang **setelah** upsert,
  /// dikenali dari [syncedAt] yang tertinggal.
  Future<void> replaceSnapshot({
    required List<StaffsCompanion> staffs,
    required List<CategoriesCompanion> categories,
    required List<ProductsCompanion> products,
    required DateTime syncedAt,
  }) {
    return db.transaction(() async {
      await batch((Batch b) {
        b.insertAllOnConflictUpdate(db.staffs, staffs);
        b.insertAllOnConflictUpdate(db.categories, categories);
        b.insertAllOnConflictUpdate(db.products, products);
      });

      // Buang baris dari snapshot sebelumnya yang tidak ikut terbarui.
      await (delete(db.staffs)
            ..where(($StaffsTable t) => t.syncedAt.isSmallerThanValue(syncedAt)))
          .go();
      await (delete(db.categories)
            ..where(
              ($CategoriesTable t) => t.syncedAt.isSmallerThanValue(syncedAt),
            ))
          .go();
      await (delete(db.products)
            ..where(
              ($ProductsTable t) => t.syncedAt.isSmallerThanValue(syncedAt),
            ))
          .go();
    });
  }

  /// Pencarian staff untuk login PIN.
  ///
  /// Mengembalikan `null` bila tidak ada — pemanggil **wajib** tetap menjalankan
  /// bcrypt terhadap hash umpan agar durasi respons tidak membocorkan keberadaan
  /// `staff_identifier` ([09 §5.3]).
  Future<Staff?> findByIdentifier(String staffIdentifier) {
    return (select(db.staffs)
          ..where(($StaffsTable s) => s.staffIdentifier.equals(staffIdentifier))
          ..limit(1))
        .getSingleOrNull();
  }

  /// Seluruh staff outlet.
  ///
  /// Dipakai gerbang keluar Kiosk, yang mencocokkan PIN terhadap semua staff
  /// karena pelanggan tidak boleh melihat daftar nama.
  Future<List<Staff>> allStaffs() => select(db.staffs).get();

  Future<List<Category>> allCategories() {
    return (select(db.categories)
          ..orderBy(<OrderClauseGenerator<$CategoriesTable>>[
            ($CategoriesTable c) => OrderingTerm.asc(c.name),
          ]))
        .get();
  }

  Stream<List<Product>> watchProducts({String? categoryId}) {
    final SimpleSelectStatement<$ProductsTable, Product> query =
        select(db.products)
          ..orderBy(<OrderClauseGenerator<$ProductsTable>>[
            ($ProductsTable p) => OrderingTerm.asc(p.name),
          ]);

    if (categoryId != null) {
      query.where(($ProductsTable p) => p.categoryId.equals(categoryId));
    }
    return query.watch();
  }

  Future<Product?> findProduct(String id) {
    return (select(db.products)..where(($ProductsTable p) => p.id.equals(id)))
        .getSingleOrNull();
  }

  /// `true` bila perangkat belum pernah menarik master data — gerbang navigasi
  /// mengarahkan ke P-02 ([09 §8]).
  Future<bool> isEmpty() async {
    final Product? any = await (select(db.products)..limit(1)).getSingleOrNull();
    return any == null;
  }
}
