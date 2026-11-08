import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/held_carts_table.dart';

part 'held_cart_dao.g.dart';

/// Pesanan ditahan — P-08.
///
/// Seluruh operasi di sini **murni lokal**. Tidak ada satu pun metode yang
/// menandai baris untuk sinkronisasi, dan itu disengaja: backend tidak mengenal
/// konsep pesanan tertahan ([03 §14]).
@DriftAccessor(tables: <Type>[HeldCarts])
class HeldCartDao extends DatabaseAccessor<AppDatabase>
    with _$HeldCartDaoMixin {
  HeldCartDao(super.db);

  Future<void> hold(HeldCartsCompanion cart) =>
      into(db.heldCarts).insertOnConflictUpdate(cart);

  Stream<List<HeldCart>> watchAll() {
    return (select(db.heldCarts)
          ..orderBy(<OrderClauseGenerator<$HeldCartsTable>>[
            ($HeldCartsTable h) => OrderingTerm.desc(h.heldAt),
          ]))
        .watch();
  }

  Future<HeldCart?> findById(String id) {
    return (select(db.heldCarts)..where(($HeldCartsTable h) => h.id.equals(id)))
        .getSingleOrNull();
  }

  /// Dipanggil setelah pesanan diambil kembali ke keranjang, atau dibatalkan.
  Future<int> remove(String id) {
    return (delete(db.heldCarts)..where(($HeldCartsTable h) => h.id.equals(id)))
        .go();
  }

  Stream<int> watchCount() {
    final Expression<int> count = db.heldCarts.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.heldCarts)..addColumns(<Expression<Object>>[count]);

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }
}
