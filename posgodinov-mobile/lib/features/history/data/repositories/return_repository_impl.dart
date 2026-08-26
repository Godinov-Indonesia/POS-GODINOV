import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/return_dao.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/return_repository.dart';
import 'package:uuid/uuid.dart';


/// Penulisan retur — **butir 15** ([11 §M13.3]).
///
/// Transaksi asal **tidak disentuh sama sekali**. Yang lahir adalah baris
/// `returns` baru dengan waktunya sendiri dan shift-nya sendiri — yang boleh
/// berbeda dari shift transaksi asal, karena pelanggan yang kembali besok
/// adalah kasus ritel normal ([11 §2.1]).
class ReturnRepositoryImpl implements ReturnRepository {
  const ReturnRepositoryImpl({
    required ReturnDao dao,
    required PrintQueueService printQueue,
    Uuid uuid = const Uuid(),
  })  : _dao = dao,
        _printQueue = printQueue,
        _uuid = uuid;

  final ReturnDao _dao;
  final PrintQueueService _printQueue;
  final Uuid _uuid;

  /// Kuantitas yang **sudah** diretur per `transaction_item_id`.
  ///
  /// Sumber `alreadyReturned` untuk `decideCancellation`. Membaca dari retur
  /// lokal saja bersifat optimistis: retur dari perangkat lain baru terlihat
  /// setelah sinkronisasi. Server tetap penegak terakhir dengan
  /// `SELECT … FOR UPDATE` ([11 §3.4]).
  @override
  Future<Map<String, int>> returnedQuantities(String transactionId) =>
      _dao.returnedQuantitiesOf(transactionId);

  /// Menyimpan retur beserta itemnya, atomik.
  ///
  /// ⚠️ `refundAmount` **dihitung di sini**, bukan diterima dari UI. Nilai yang
  /// datang dari layar dapat menyimpang dari item yang benar-benar dipilih —
  /// mis. ketika kasir mengubah kuantitas setelah nominalnya terlanjur
  /// dihitung — dan selisihnya baru terlihat saat rekonsiliasi kas.
  @override
  Future<String> saveReturn({
    required String originalTransactionId,
    required String shiftId,
    required String staffId,
    required RefundMethod refundMethod,
    required String reasonCode,
    required String reasonNotes,
    required List<ReturnLineDraft> lines,
    required Map<String, int> originalQuantities,
    String? authorizedBy,
    String cashierName = '',
    String? authorizedByName,
    String originalCode = '',
  }) async {
    if (lines.isEmpty) {
      throw StateError('Retur tanpa item bukan retur.');
    }

    final String returnId = _uuid.v4();
    final DateTime now = DateTime.now().toUtc();

    final int refundAmountMinor = lines.fold<int>(
      0,
      (int sum, ReturnLineDraft l) => sum + l.lineTotalMinor,
    );

    await _dao.insertWithItems(
      ReturnsCompanion.insert(
        id: returnId,
        originalTransactionId: originalTransactionId,
        shiftId: shiftId,
        staffId: staffId,
        authorizedBy: Value<String?>(authorizedBy),
        returnType: _classify(lines, originalQuantities),
        refundMethod: refundMethod,
        refundAmountMinor: refundAmountMinor,
        reasonCode: reasonCode,
        reasonNotes: Value<String>(reasonNotes),
        clientCreatedAt: now,
      ),
      <ReturnItemsCompanion>[
        for (final ReturnLineDraft l in lines)
          ReturnItemsCompanion.insert(
            id: _uuid.v4(),
            returnId: returnId,
            transactionItemId: l.transactionItemId,
            productId: l.productId,
            productName: l.productName,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            restock: Value<bool>(l.restock),
            wasteReasonCode: Value<String?>(
              l.restock ? null : l.wasteReasonCode,
            ),
          ),
      ],
    );

    // Struk retur — dua tanda tangan, keduanya wajib ([11 §M14.4]).
    //
    // Diantre SETELAH penulisan, dan `enqueueReturnReceipt` tidak pernah
    // melempar: retur yang sudah sah tidak boleh hilang karena printer mati
    // (aturan R6).
    await _printQueue.enqueueReturnReceipt(
      returnId,
      ReturnReceiptData(
        outletName: await _printQueue.resolveOutletName(),
        issuedAt: now,
        returnCode: returnId,
        originalCode:
            originalCode.isEmpty ? originalTransactionId : originalCode,
        cashierName: cashierName,
        authorizedByName: authorizedByName,
        reasonCode: reasonCode,
        reasonNotes: reasonNotes,
        refundMethod: refundMethod,
        refundAmountMinor: refundAmountMinor,
        lines: <AuditReceiptLine>[
          for (final ReturnLineDraft l in lines)
            AuditReceiptLine(
              productName: l.productName,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
              restock: l.restock,
              wasteReasonCode: l.wasteReasonCode,
            ),
        ],
      ),
    );

    return returnId;
  }

  /// `FULL` hanya bila SETIAP baris asli diretur habis dalam retur ini.
  ///
  /// Menghitungnya dari total kuantitas saja akan menandai "2 dari item A +
  /// 0 dari item B" sebagai `FULL` ketika kebetulan jumlahnya cocok.
  ReturnKind _classify(
    List<ReturnLineDraft> lines,
    Map<String, int> originalQuantities,
  ) {
    if (originalQuantities.isEmpty) return ReturnKind.partial;

    final Map<String, int> returned = <String, int>{};
    for (final ReturnLineDraft l in lines) {
      returned.update(
        l.transactionItemId,
        (int prev) => prev + l.quantity,
        ifAbsent: () => l.quantity,
      );
    }

    final bool all = originalQuantities.entries.every(
      (MapEntry<String, int> e) => (returned[e.key] ?? 0) >= e.value,
    );
    return all ? ReturnKind.full : ReturnKind.partial;
  }
}
