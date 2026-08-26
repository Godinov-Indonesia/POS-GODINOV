import 'dart:convert';

import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/void_log_dao.dart';
import 'package:posgodinov_mobile/features/history/data/datasources/history_remote_ds.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';
import 'package:uuid/uuid.dart';

class HistoryRepositoryImpl implements HistoryRepository {
  const HistoryRepositoryImpl({
    required AppDatabase database,
    required TransactionDao dao,
    required HistoryRemoteDataSource remote,
    required VoidLogDao voidLogDao,
    required PrintQueueService printQueue,
    Uuid uuid = const Uuid(),
  })  : _db = database,
        _dao = dao,
        _remote = remote,
        _voidLogDao = voidLogDao,
        _printQueue = printQueue,
        _uuid = uuid;

  final AppDatabase _db;
  final TransactionDao _dao;
  final HistoryRemoteDataSource _remote;
  final VoidLogDao _voidLogDao;
  final PrintQueueService _printQueue;
  final Uuid _uuid;

  @override
  Stream<List<HistoryEntry>> watchCurrentShift(String shiftId) {
    // `Stream.fromFuture` di dalam `asyncMap` akan kehilangan pembaruan;
    // sebagai gantinya, antrean sync dipakai sebagai pemicu — setiap perubahan
    // status `synced` juga berarti daftar perlu digambar ulang.
    return _dao.watchPendingCount().asyncMap(
          (int _) async => _load(shiftId),
        );
  }

  Future<List<HistoryEntry>> _load(String shiftId) async {
    final List<TransactionWithItems> rows =
        await _dao.transactionsOfShift(shiftId);

    return rows.map(_toEntry).toList(growable: false);
  }

  /// Seluruh transaksi lokal — hanya dipakai bila `history_scope: 'ALL'`.
  ///
  /// Memakai pemicu yang sama dengan [watchCurrentShift]: stream antrean sync
  /// memancar setiap kali ada perubahan, dan itulah saat daftar perlu digambar
  /// ulang.
  @override
  Stream<List<HistoryEntry>> watchAllTransactions() {
    return _dao.watchPendingCount().asyncMap(
          (int _) async => (await _dao.allTransactions())
              .map(_toEntry)
              .toList(growable: false),
        );
  }

  @override
  Future<List<HistoryEntry>> fetchFromServer() => _remote.fetch();

  /// Mencari kode — lokal dulu, lalu server ([11 §M17.3]).
  @override
  Future<HistoryEntry?> lookupByCode(String code) async {
    final String needle = code.trim();
    if (needle.isEmpty) return null;

    final TransactionWithItems? local = await _dao.findByCode(needle);
    if (local != null) return _toEntry(local);

    // Kegagalan jaringan DILEPAS ke pemanggil, tidak ditelan menjadi `null`.
    //
    // "Tidak ditemukan" dan "tidak dapat menghubungi server" menuntut tindakan
    // yang berbeda: yang pertama berarti kodenya salah, yang kedua berarti
    // kasir harus mencoba lagi nanti. Menyamakannya membuat kasir menyerah
    // mencari struk yang sebenarnya ada.
    return _remote.lookup(needle);
  }

  /// Satu baris SQLite → entitas riwayat.
  ///
  /// Diekstrak dari `_load` supaya hasil pencarian memakai pemetaan yang persis
  /// sama dengan daftar — bentuk yang berbeda antara keduanya akan membuat
  /// tombol Retur bekerja di satu tempat dan gagal di tempat lain.
  HistoryEntry _toEntry(TransactionWithItems t) => HistoryEntry(
        id: t.transaction.id,
        shiftId: t.transaction.shiftId,
        totalMinor: t.transaction.totalAmountMinor,
        paymentMethod: t.transaction.paymentMethod,
        status: t.transaction.status,
        clientCreatedAt: t.transaction.clientCreatedAt,
        customerName: t.transaction.customerName,
        cancelNotes: t.transaction.cancelNotes,
        synced: t.transaction.synced,
        isLocal: true,
        receiptPrintedAt: t.transaction.receiptPrintedAt,
        itemIds: t.items
            .map((LocalTransactionItem i) => i.id)
            .toList(growable: false),
        lines: t.items
            .map(
              (LocalTransactionItem i) => HistoryLine(
                productId: i.productId,
                productName: i.productName,
                quantity: i.quantity,
                unitPriceMinor: i.unitPriceMinor,
              ),
            )
            .toList(growable: false),
      );

  /// ═══════════════════════════════════════════════════════════════════════
  /// DUA PENULISAN, SATU TRANSAKSI ([11 §M13.2])
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Perubahan status dan `void_logs` ditulis dalam SATU transaksi SQLite. Bila
  /// hanya statusnya yang tersimpan, transaksi lenyap dari penjualan tanpa satu
  /// pun baris audit yang menjelaskan siapa membatalkannya dan mengapa — dan
  /// itu persis bentuk yang butir 15 dibangun untuk mencegahnya.
  @override
  Future<void> voidTransaction({
    required String id,
    required String shiftId,
    required String staffId,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName = '',
    String? authorizedByName,
  }) async {
    final DateTime now = DateTime.now().toUtc();
    final String voidLogId = _uuid.v4();
    TransactionWithItems? printed;

    await _db.transaction(() async {
      final TransactionWithItems? tx = await _dao.byId(id);
      if (tx == null) {
        throw StateError('Transaksi tidak ditemukan: $id');
      }

      // UUID TIDAK berubah, dan baris kembali ke antrean sinkronisasi. Server
      // mengenali id yang sama berstatus VOIDED lalu mengembalikan bahan baku
      // ke inventori ([02 §2.12]).
      await _dao.voidTransaction(
        id,
        reasonCode: reasonCode,
        reasonNotes: reasonNotes,
        at: now,
        authorizedBy: authorizedBy ?? staffId,
      );

      printed = tx;

      await _voidLogDao.insertLog(
        VoidLogsCompanion.insert(
          id: voidLogId,
          shiftId: shiftId,
          staffId: staffId,
          authorizedBy: Value<String?>(authorizedBy),
          scope: VoidScope.transaction,
          transactionId: Value<String?>(id),
          // Void transaksi membatalkan SELURUH isinya — tidak ada void sebagian.
          quantityBefore: Value<int>(
            tx.items.fold<int>(
              0,
              (int sum, LocalTransactionItem i) => sum + i.quantity,
            ),
          ),
          quantityAfter: const Value<int>(0),
          valueAmountMinor: tx.transaction.totalAmountMinor,
          reasonCode: reasonCode,
          reasonNotes: Value<String>(reasonNotes),
          // Snapshot disertakan walau transaksinya ada di server: laporan
          // kecurangan membaca `void_logs` sendirian, dan memaksanya menjoin ke
          // `transaction_items` untuk setiap baris membuat kueri audit mahal.
          itemsSnapshotJson: Value<String?>(
            jsonEncode(<Map<String, dynamic>>[
              for (final LocalTransactionItem i in tx.items)
                <String, dynamic>{
                  'product_id': i.productId,
                  'product_name': i.productName,
                  'quantity': i.quantity,
                  'unit_price': Money.toMajor(i.unitPriceMinor),
                },
            ]),
          ),
          clientCreatedAt: now,
        ),
      );
    });

    // ── BUTIR 6 — struk pembatalan, DI LUAR transaksi basis data ──────────
    //
    // Bukan sekadar urutan yang rapi: barisnya harus sudah ter-*commit*
    // sebelum ada yang mencoba mencetaknya. Bila pencetakan berada di dalam
    // transaksi, kegagalannya akan menggulung pembatalan yang sudah sah —
    // persis yang aturan R6 larang.
    final TransactionWithItems? tx = printed;
    if (tx != null) {
      await _printQueue.enqueueCancelReceipt(
        voidLogId,
        CancelReceiptData(
          outletName: await _printQueue.resolveOutletName(),
          issuedAt: now,
          scope: VoidScope.transaction,
          originalCode: tx.transaction.shortCode ?? tx.transaction.id,
          cashierName: cashierName,
          authorizedByName: authorizedByName,
          reasonCode: reasonCode,
          reasonNotes: reasonNotes,
          lines: <AuditReceiptLine>[
            for (final LocalTransactionItem i in tx.items)
              AuditReceiptLine(
                productName: i.productName,
                quantity: i.quantity,
                unitPriceMinor: i.unitPriceMinor,
              ),
          ],
          totalCancelledMinor: tx.transaction.totalAmountMinor,
        ),
      );
    }
  }
}
