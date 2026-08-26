import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/return_items_table.dart';
import 'package:posgodinov_mobile/core/database/tables/returns_table.dart';

part 'return_dao.g.dart';

/// Retur beserta itemnya — bentuk yang dipakai lapisan sync dan struk.
class ReturnWithItems {
  const ReturnWithItems({required this.returnRow, required this.items});

  final LocalReturn returnRow;
  final List<LocalReturnItem> items;
}

/// Akses baris `returns` + `return_items` — butir 15 ([11 §M13.3]).
@DriftAccessor(tables: <Type>[Returns, ReturnItems])
class ReturnDao extends DatabaseAccessor<AppDatabase> with _$ReturnDaoMixin {
  ReturnDao(super.db);

  /// Menulis retur **beserta seluruh itemnya secara atomik**.
  ///
  /// Alasan yang sama seperti `TransactionDao.insertWithItems`: aplikasi yang
  /// dimatikan paksa di tengah penulisan meninggalkan retur utuh atau tidak
  /// sama sekali — tidak pernah retur tanpa item, yang akan tampak sebagai
  /// pengembalian uang tanpa barang.
  Future<void> insertWithItems(
    ReturnsCompanion returnRow,
    List<ReturnItemsCompanion> items,
  ) {
    return db.transaction(() async {
      await into(db.returns).insert(returnRow);
      await batch((Batch b) {
        b.insertAll(db.returnItems, items);
      });
    });
  }

  /// Antrean sinkronisasi: retur belum tersinkron, **urut kronologis**.
  ///
  /// Memakai indeks `idx_return_queue (synced, client_created_at)`.
  Future<List<ReturnWithItems>> pendingReturns({
    int limit = SyncLimits.maxTransactionsPerBatch,
  }) async {
    final List<LocalReturn> rows = await (select(db.returns)
          ..where(($ReturnsTable r) =>
              r.synced.equals(false) & r.quarantined.equals(false),)
          ..orderBy(<OrderClauseGenerator<$ReturnsTable>>[
            ($ReturnsTable r) => OrderingTerm.asc(r.clientCreatedAt),
          ])
          ..limit(limit))
        .get();

    return _attachItems(rows);
  }

  /// Total kuantitas yang **sudah** diretur per baris item transaksi asal.
  ///
  /// Dasar pemeriksaan "retur tidak boleh melebihi qty asal" ([11 §3.4]).
  /// Server tetap menjadi penegak terakhir dengan `SELECT … FOR UPDATE`; angka
  /// ini mencegah kasir menghitung manual dan mencegah penolakan yang baru
  /// ketahuan setelah pelanggan pulang.
  Future<Map<String, int>> returnedQuantitiesOf(String transactionId) async {
    final List<LocalReturn> parents = await (select(db.returns)
          ..where(($ReturnsTable r) =>
              r.originalTransactionId.equals(transactionId),))
        .get();

    if (parents.isEmpty) return const <String, int>{};

    final List<String> ids =
        parents.map((LocalReturn r) => r.id).toList(growable: false);

    final List<LocalReturnItem> items = await (select(db.returnItems)
          ..where(($ReturnItemsTable i) => i.returnId.isIn(ids)))
        .get();

    final Map<String, int> totals = <String, int>{};
    for (final LocalReturnItem item in items) {
      totals.update(
        item.transactionItemId,
        (int prev) => prev + item.quantity,
        ifAbsent: () => item.quantity,
      );
    }
    return totals;
  }

  /// Retur pada satu shift, terbaru dulu — untuk riwayat shift aktif (butir 16).
  Stream<List<LocalReturn>> watchByShift(String shiftId) {
    return (select(db.returns)
          ..where(($ReturnsTable r) => r.shiftId.equals(shiftId))
          ..orderBy(<OrderClauseGenerator<$ReturnsTable>>[
            ($ReturnsTable r) => OrderingTerm.desc(r.clientCreatedAt),
          ]))
        .watch();
  }

  Future<void> markSynced(String id) {
    return (update(db.returns)..where(($ReturnsTable r) => r.id.equals(id)))
        .write(
      const ReturnsCompanion(
        synced: Value<bool>(true),
        syncError: Value<String?>(null),
        syncAttempts: Value<int>(0),
      ),
    );
  }

  Future<void> markFailed(String id, DateTime attemptedAt, String reason) {
    return db.transaction(() async {
      final LocalReturn? row = await (select(db.returns)
            ..where(($ReturnsTable r) => r.id.equals(id)))
          .getSingleOrNull();
      if (row == null) return;

      await (update(db.returns)..where(($ReturnsTable r) => r.id.equals(id)))
          .write(
        ReturnsCompanion(
          synced: const Value<bool>(false),
          syncError: Value<String?>(reason),
          syncAttempts: Value<int>(row.syncAttempts + 1),
          lastSyncAttemptAt: Value<DateTime?>(attemptedAt),
        ),
      );
    });
  }

  /// Menandai bahwa struk retur benar-benar tercetak.
  Future<void> markReceiptPrinted(String id, DateTime printedAt) {
    return (update(db.returns)..where(($ReturnsTable r) => r.id.equals(id)))
        .write(
      ReturnsCompanion(
        receiptPrinted: const Value<bool>(true),
        receiptPrintedAt: Value<DateTime?>(printedAt),
      ),
    );
  }

  Future<List<ReturnWithItems>> _attachItems(List<LocalReturn> rows) async {
    if (rows.isEmpty) return const <ReturnWithItems>[];

    final List<String> ids =
        rows.map((LocalReturn r) => r.id).toList(growable: false);

    final List<LocalReturnItem> items = await (select(db.returnItems)
          ..where(($ReturnItemsTable i) => i.returnId.isIn(ids)))
        .get();

    final Map<String, List<LocalReturnItem>> grouped =
        <String, List<LocalReturnItem>>{};
    for (final LocalReturnItem item in items) {
      grouped
          .putIfAbsent(item.returnId, () => <LocalReturnItem>[])
          .add(item);
    }

    return rows
        .map(
          (LocalReturn r) => ReturnWithItems(
            returnRow: r,
            items: grouped[r.id] ?? const <LocalReturnItem>[],
          ),
        )
        .toList(growable: false);
  }

  /// Memindahkan baris ke KARANTINA ([11 §4.3]).
  ///
  /// Dipanggil ketika server menolak dengan `retryable: false`. Barisnya
  /// **tidak dihapus** — datanya tetap utuh dan muncul di P-13 sebagai "Butuh
  /// tindakan". Yang berubah hanya keanggotaannya di antrean, supaya satu baris
  /// cacat permanen berhenti menahan seluruh baris di belakangnya.
  Future<void> markQuarantined(String id, DateTime at, String reason) {
    return (update(db.returns)..where(($ReturnsTable t) => t.id.equals(id)))
        .write(
      ReturnsCompanion(
        quarantined: const Value<bool>(true),
        synced: const Value<bool>(false),
        syncError: Value<String?>(reason),
        lastSyncAttemptAt: Value<DateTime?>(at),
      ),
    );
  }

  /// Jumlah baris yang menuntut tindakan manusia.
  Stream<int> watchQuarantinedCount() {
    final Expression<int> count = db.returns.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.returns)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.returns.quarantined.equals(true));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

}
