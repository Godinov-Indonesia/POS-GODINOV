import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/waste_dao.dart';
import 'package:posgodinov_mobile/features/waste/domain/repositories/waste_repository.dart';
import 'package:uuid/uuid.dart';

class WasteRepositoryImpl implements WasteRepository {
  const WasteRepositoryImpl({
    required WasteDao dao,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _dao = dao,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final WasteDao _dao;
  final Uuid _uuid;
  final DateTime Function() _now;

  @override
  Future<void> report({
    required String staffId,
    required String productId,
    required String productName,
    required int quantity,
    required String reason,
  }) async {
    if (quantity <= 0) {
      throw ArgumentError('Jumlah waste harus lebih dari nol.');
    }
    if (reason.trim().isEmpty) {
      throw ArgumentError('Alasan waste wajib diisi.');
    }

    await _dao.insertWaste(
      WastesCompanion.insert(
        // UUID dibuat KLIEN — dasar idempotensi, sama seperti transaksi.
        id: _uuid.v4(),
        staffId: staffId,
        productId: productId,
        productName: productName,
        quantity: quantity,
        reason: reason.trim(),
        clientCreatedAt: _now().toUtc(),
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
