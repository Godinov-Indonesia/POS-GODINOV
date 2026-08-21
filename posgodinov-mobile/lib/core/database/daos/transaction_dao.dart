import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/transaction_items_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transaction_payments_table.dart';
import 'package:posgodinov_mobile/core/database/tables/transactions_table.dart';

part 'transaction_dao.g.dart';

/// Transaksi beserta item dan tendernya — bentuk yang dipakai lapisan sync
/// dan struk.
class TransactionWithItems {
  const TransactionWithItems({
    required this.transaction,
    required this.items,
    this.payments = const <LocalTransactionPayment>[],
  });

  final LocalTransaction transaction;
  final List<LocalTransactionItem> items;

  /// Rincian tender (butir 8, [11 §3.2]).
  ///
  /// Bawaannya kosong dan itu **disengaja**: transaksi yang lahir sebelum M17.2
  /// memasang penulis multi-tender hanya memiliki `paymentMethod`. `WireMapper`
  /// mensintesis satu baris tender dari kolom itu, sehingga invarian
  /// `Σ amount == totalAmount` berlaku untuk setiap baris berapa pun umurnya
  /// dan sisi server tidak perlu mengenal dua bentuk.
  final List<LocalTransactionPayment> payments;
}

@DriftAccessor(
  tables: <Type>[Transactions, TransactionItems, TransactionPayments],
)
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
    List<TransactionItemsCompanion> items, {
    List<TransactionPaymentsCompanion> payments =
        const <TransactionPaymentsCompanion>[],
  }) {
    return db.transaction(() async {
      await into(db.transactions).insert(transaction);
      await batch((Batch b) {
        b.insertAll(db.transactionItems, items);
        if (payments.isNotEmpty) {
          b.insertAll(db.transactionPayments, payments);
        }
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
          ..where(($TransactionsTable t) =>
              t.synced.equals(false) & t.quarantined.equals(false))
          ..orderBy(<OrderClauseGenerator<$TransactionsTable>>[
            ($TransactionsTable t) =>
                OrderingTerm.asc(t.clientCreatedAt),
          ])
          ..limit(limit))
        .get();

    return _attachItems(rows);
  }

  /// Satu transaksi beserta item dan tendernya.
  ///
  /// Dipakai alur Void dan Retur, yang keduanya perlu membaca isi transaksi
  /// SEBELUM mengubahnya — snapshot audit disusun dari sini.
  Future<TransactionWithItems?> byId(String id) async {
    final List<LocalTransaction> rows = await (select(db.transactions)
          ..where(($TransactionsTable t) => t.id.equals(id))
          ..limit(1))
        .get();

    if (rows.isEmpty) return null;
    final List<TransactionWithItems> attached = await _attachItems(rows);
    return attached.isEmpty ? null : attached.first;
  }

  /// Jumlah transaksi yang masih mengantre — ditampilkan di StatusBar.
  Stream<int> watchPendingCount() {
    final Expression<int> count = db.transactions.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.transactions)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.transactions.synced.equals(false) &
              db.transactions.quarantined.equals(false));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

  /// Mencari SATU transaksi lewat kode struk atau UUID penuh — **butir 16**
  /// ([11 §M17.3]).
  ///
  /// ⚠️ Mengembalikan satu baris atau `null` — tidak pernah daftar. Pencarian
  /// yang mengembalikan daftar adalah penelusuran massal dengan nama lain, dan
  /// itu persis keadaan yang butir 16 tutup.
  ///
  /// `shortCode` dibandingkan HURUF BESAR: server menerbitkannya begitu, dan
  /// kasir mengetiknya dari kertas tanpa memperhatikan kapitalisasi.
  Future<TransactionWithItems?> findByCode(String code) async {
    final String needle = code.trim();
    if (needle.isEmpty) return null;

    final LocalTransaction? row = await (select(db.transactions)
          ..where(($TransactionsTable t) =>
              t.id.equals(needle) | t.shortCode.equals(needle.toUpperCase()))
          ..limit(1))
        .getSingleOrNull();

    if (row == null) return null;
    final List<TransactionWithItems> withItems =
        await _attachItems(<LocalTransaction>[row]);
    return withItems.isEmpty ? null : withItems.first;
  }

  /// Seluruh transaksi lokal, terbaru dulu — **hanya untuk
  /// `history_scope: 'ALL'`** ([11 §M18.2]).
  ///
  /// ⚠️ Perilaku v1 yang dipertahankan di balik *feature flag*, bukan jalur
  /// normal. Bawaan v2 adalah [transactionsOfShift]: riwayat terikat shift
  /// berjalan (butir 16), karena layar Riwayat adalah pintu masuk ke Void dan
  /// Retur.
  ///
  /// Flag ini ada supaya satu bisnis yang belum siap dapat dikembalikan tanpa
  /// *rollback* rilis — bukan supaya perilakunya dianggap setara.
  Future<List<TransactionWithItems>> allTransactions({int limit = 200}) async {
    final List<LocalTransaction> rows = await (select(db.transactions)
          ..orderBy(<OrderClauseGenerator<$TransactionsTable>>[
            ($TransactionsTable t) => OrderingTerm.desc(t.clientCreatedAt),
          ])
          ..limit(limit))
        .get();

    return _attachItems(rows);
  }

  /// Transaksi **shift berjalan** untuk P-09 — butir 16 ([11 §M17.3]).
  ///
  /// Memakai indeks komposit `idx_txn_shift_created`: filter dan pengurutan
  /// keduanya dilayani indeks, bukan diurutkan di memori setelah baris ditarik.
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
                // `PaymentSummary.cash`, BUKAN `split`. Transaksi split yang
                // sebagian tunai TIDAK ikut terjumlah di sini: nominal tunainya
                // diketahui dari baris tender, dan menjumlahkan seluruh nilai
                // transaksi akan membuat laci tampak berisi uang yang sebagian
                // tergesek di EDC ([11 §M17.2]).
                db.transactions.paymentMethod
                    .equalsValue(PaymentSummary.cash),
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

  /// Void: status menjadi `VOIDED` dan baris **kembali** ke antrean dengan UUID
  /// yang sama, agar server menjalankan *reverse deduction* ([02 §2.12]).
  ///
  /// ⚠️ Pemanggil **wajib** memastikan `decideCancellation()` menghasilkan
  /// `void` lebih dulu. DAO ini sengaja tidak memutuskannya sendiri: keputusan
  /// hidup di satu tempat (`core/pos/cancellation_policy.dart`), dan lapisan
  /// data yang ikut memutuskan adalah duplikasi kedua yang akan menyimpang
  /// ([11 §M13.1]).
  Future<void> voidTransaction(
    String id, {
    required String reasonCode,
    required String reasonNotes,
    required DateTime at,
    String? authorizedBy,
  }) {
    return (update(db.transactions)
          ..where(($TransactionsTable t) => t.id.equals(id)))
        .write(
      TransactionsCompanion(
        status: const Value<TransactionStatus>(TransactionStatus.voided),
        // `cancelNotes` v1 tetap diisi agar laporan lama tidak kosong selama
        // jendela deprekasi ([11 §M18.4]).
        cancelNotes: Value<String>(reasonNotes),
        voidReasonCode: Value<String?>(reasonCode),
        voidedAt: Value<DateTime?>(at),
        voidedBy: Value<String?>(authorizedBy),
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

    // Tender ditarik dalam kueri yang sama, bukan per-transaksi: batch sync 200
    // transaksi tidak boleh berubah menjadi 200 kueri tambahan ([09 §5.1]).
    final List<LocalTransactionPayment> payments =
        await (select(db.transactionPayments)
              ..where(($TransactionPaymentsTable p) => p.transactionId.isIn(ids))
              ..orderBy(<OrderClauseGenerator<$TransactionPaymentsTable>>[
                ($TransactionPaymentsTable p) => OrderingTerm.asc(p.sequence),
              ]))
            .get();

    final Map<String, List<LocalTransactionPayment>> tenders =
        <String, List<LocalTransactionPayment>>{};
    for (final LocalTransactionPayment payment in payments) {
      tenders.putIfAbsent(
        payment.transactionId,
        () => <LocalTransactionPayment>[],
      ).add(payment);
    }

    return rows
        .map(
          (LocalTransaction t) => TransactionWithItems(
            transaction: t,
            items: grouped[t.id] ?? const <LocalTransactionItem>[],
            payments: tenders[t.id] ?? const <LocalTransactionPayment>[],
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
    return (update(db.transactions)..where(($TransactionsTable t) => t.id.equals(id)))
        .write(
      TransactionsCompanion(
        quarantined: const Value<bool>(true),
        synced: const Value<bool>(false),
        syncError: Value<String?>(reason),
        lastSyncAttemptAt: Value<DateTime?>(at),
      ),
    );
  }

  /// Jumlah baris yang menuntut tindakan manusia.
  Stream<int> watchQuarantinedCount() {
    final Expression<int> count = db.transactions.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.transactions)
          ..addColumns(<Expression<Object>>[count])
          ..where(db.transactions.quarantined.equals(true));

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

}
