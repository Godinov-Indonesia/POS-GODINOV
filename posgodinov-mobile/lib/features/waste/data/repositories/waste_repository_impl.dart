import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';
import 'package:posgodinov_mobile/features/waste/domain/repositories/waste_repository.dart';
import 'package:uuid/uuid.dart';

class WasteRepositoryImpl implements WasteRepository {
  const WasteRepositoryImpl({
    required WasteDao dao,
    required PrintQueueService printQueue,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _dao = dao,
        _printQueue = printQueue,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final WasteDao _dao;
  final PrintQueueService _printQueue;
  final Uuid _uuid;
  final DateTime Function() _now;

  @override
  Future<void> report({
    required String staffId,
    required String productId,
    required String productName,
    required int quantity,
    required String reason,
    String reasonCode = ReasonCodes.other,
    String staffName = '',
    String? shiftId,
  }) async {
    if (quantity <= 0) {
      throw ArgumentError('Jumlah waste harus lebih dari nol.');
    }
    if (reason.trim().isEmpty) {
      throw ArgumentError('Alasan waste wajib diisi.');
    }

    final String id = _uuid.v4();
    final DateTime at = _now().toUtc();

    await _dao.insertWaste(
      WastesCompanion.insert(
        // UUID dibuat KLIEN — dasar idempotensi, sama seperti transaksi.
        id: id,
        staffId: staffId,
        productId: productId,
        productName: productName,
        quantity: quantity,
        reason: reason.trim(),
        reasonCode: Value<String>(reasonCode),
        shiftId: Value<String?>(shiftId),
        clientCreatedAt: at,
      ),
    );

    // ── BUTIR 7 — struk pembuangan WAJIB terbit ([11 §M14.3]) ────────────
    //
    // Diantre di sini, bukan di layar: fungsi ini adalah satu-satunya jalur
    // penulisan waste, sehingga tidak ada layar yang dapat melewatkannya.
    // `enqueueWasteReceipt` tidak pernah melempar (aturan R6).
    await _printQueue.enqueueWasteReceipt(
      id,
      WasteReceiptData(
        outletName: await _printQueue.resolveOutletName(),
        issuedAt: at,
        productName: productName,
        quantity: quantity,
        reasonCode: reasonCode,
        reasonNotes: reason.trim(),
        staffName: staffName,
      ),
    );
  }

  @override
  Stream<List<WasteEntry>> watchRecent() {
    return _dao.watchRecent().map(
          (List<LocalWaste> rows) => rows
              .map(
                (LocalWaste w) => WasteEntry(
                  id: w.id,
                  productName: w.productName,
                  quantity: w.quantity,
                  reason: w.reason,
                  reportedAt: w.clientCreatedAt,
                  synced: w.synced,
                ),
              )
              .toList(growable: false),
        );
  }
}
