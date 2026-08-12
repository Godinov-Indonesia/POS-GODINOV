import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/transaction_items_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transactions_table.dart';

part 'transaction_dao.g.dart';

/// Transaksi beserta itemnya — bentuk yang dipakai lapisan sync dan struk.
class TransactionWithItems {
  const TransactionWithItems({required this.transaction, required this.items});

  final LocalTransaction transaction;
  final List<LocalTransactionItem> items;
}

@DriftAccessor(tables: <Type>[Transactions, TransactionItems])
class TransactionDao extends DatabaseAccessor<AppDatabase>
    with _$TransactionDaoMixin {
  TransactionDao(super.db);

  /// Menulis transaksi **beserta seluruh itemnya secara atomik**.
  ///
  /// Inilah alasan utama memilih SQLite relasional ketimbang dokumen bersarang:
  /// aplikasi yang dimatikan paksa di tengah penulisan meninggalkan transaksi
  /// utuh atau tidak sama sekali — tidak pernah transaksi tanpa item.
  ///
  /// Dipanggil **sebelum** perintah cetak dikirim ([09 §7.3]).
  Future<void> insertWithItems(
    TransactionsCompanion transaction,
    List<TransactionItemsCompanion> items,
  ) {
    return db.transaction(() async {
      await into(db.transactions).insert(transaction);
      await batch((Batch b) {
        b.insertAll(db.transactionItems, items);
      });
    });
  }

  /// Antrean sinkronisasi: transaksi belum tersinkron, **urut kronologis**.
  ///
  /// Memakai indeks `idx_tx_queue (synced, client_created_at)`. Batasnya
  /// membatasi ukuran payload karena server tidak berpaginasi ([09 §6.1]).
  Future<List<TransactionWithItems>> pendingTransactions({
    int limit = SyncLimits.maxTransactionsPerBatch,
  }) async {
    final List<LocalTransaction> rows = await (select(db.transactions)
          ..where(($TransactionsTable t) => t.synced.equals(false))
          ..orderBy(<OrderClauseGenerator<$TransactionsTable>>[
            ($TransactionsTable t) =>
                OrderingTerm.asc(t.clientCreatedAt),
          ])
          ..limit(limit))
        .get();

    return _attachItems(rows);
  }

  /// Jumlah transaksi yang masih mengantre — ditampilkan di StatusBar.
  Stream<int> watchPendingCount() {
    final Expression<int> count = db.transactions.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.transactions)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.transactions.synced.equals(false));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

  /// Transaksi hari ini untuk P-09 tab "Hari Ini" — sumbernya lokal, bukan
  /// server ([09 §8]).
  Future<List<TransactionWithItems>> transactionsOfShift(String shiftId) async {
    final List<LocalTransaction> rows = await (select(db.transactions)
          ..where(($TransactionsTable t) => t.shiftId.equals(shiftId))
          ..orderBy(<OrderClauseGenerator<$TransactionsTable>>[
            ($TransactionsTable t) =>
                OrderingTerm.desc(t.clientCreatedAt),
          ]))
        .get();

    return _attachItems(rows);
  }

  /// Total penjualan **tunai** yang `COMPLETED` pada sebuah shift, dalam sen.
  ///
  /// Dasar `expected_balance` saat tutup shift — hanya `CASH` yang dihitung
  /// ([04 §A.3]).
  Future<int> cashTotalOfShift(String shiftId) async {
    final Expression<int> total = db.transactions.totalAmountMinor.sum();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.transactions)
          ..addColumns(<Expression<Object>>[total])
          ..where(
            db.transactions.shiftId.equals(shiftId) &
                db.transactions.status
                    .equalsValue(TransactionStatus.completed) &
                db.transactions.paymentMethod
                    .equalsValue(PaymentMethod.cash),
          );

    final TypedResult row = await query.getSingle();
    return row.read(total) ?? 0;
  }

  /// Menandai transaksi berhasil tersinkron.
  ///
  /// **Tidak menghapus baris** — data keuangan hanya ditandai ([09 §6.3]
  /// aturan 4).
  Future<void> markSynced(String id) {
    return (update(db.transactions)
          ..where(($TransactionsTable t) => t.id.equals(id)))
        .write(
      const TransactionsCompanion(
        synced: Value<bool>(true),
        syncError: Value<String?>(null),
        syncAttempts: Value<int>(0),
      ),
    );
  }

  /// Mengembalikan transaksi ke antrean dengan catatan kegagalan.
  Future<void> markFailed(String id, DateTime attemptedAt, String reason) {
    return db.transaction(() async {
      final LocalTransaction? row = await (select(db.transactions)
            ..where(($TransactionsTable t) => t.id.equals(id)))
          .getSingleOrNull();
      if (row == null) return;

      await (update(db.transactions)
            ..where(($TransactionsTable t) => t.id.equals(id)))
          .write(
        TransactionsCompanion(
          synced: const Value<bool>(false),
          syncError: Value<String?>(reason),
          syncAttempts: Value<int>(row.syncAttempts + 1),
          lastSyncAttemptAt: Value<DateTime?>(attemptedAt),
        ),
      );
    });
  }

  /// Void: status menjadi `CANCELLED` dan baris **kembali** ke antrean dengan
  /// UUID yang sama, agar server menjalankan *reverse deduction* ([02 §2.12]).
  Future<void> voidTransaction(String id, String cancelNotes) {
    return (update(db.transactions)
          ..where(($TransactionsTable t) => t.id.equals(id)))
        .write(
      TransactionsCompanion(
        status: const Value<TransactionStatus>(TransactionStatus.cancelled),
        cancelNotes: Value<String>(cancelNotes),
        synced: const Value<bool>(false),
        syncError: const Value<String?>(null),
      ),
    );
  }

  Future<List<TransactionWithItems>> _attachItems(
    List<LocalTransaction> rows,
  ) async {
    if (rows.isEmpty) return const <TransactionWithItems>[];

    final List<String> ids =
        rows.map((LocalTransaction t) => t.id).toList(growable: false);

    final List<LocalTransactionItem> items = await (select(db.transactionItems)
          ..where(($TransactionItemsTable i) => i.transactionId.isIn(ids)))
        .get();

    final Map<String, List<LocalTransactionItem>> grouped =
        <String, List<LocalTransactionItem>>{};
    for (final LocalTransactionItem item in items) {
      grouped.putIfAbsent(
        item.transactionId,
        () => <LocalTransactionItem>[],
      ).add(item);
    }

    return rows
        .map(
          (LocalTransaction t) => TransactionWithItems(
            transaction: t,
            items: grouped[t.id] ?? const <LocalTransactionItem>[],
          ),
        )
        .toList(growable: false);
  }
}
