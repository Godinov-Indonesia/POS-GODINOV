import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:uuid/uuid.dart';

class ShiftRepositoryImpl implements ShiftRepository {
  const ShiftRepositoryImpl({
    required ShiftDao dao,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _dao = dao,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final ShiftDao _dao;
  final Uuid _uuid;
  final DateTime Function() _now;

  @override
  Future<Shift?> currentOpenShift() async => _toEntity(await _dao.openShift());

  @override
  Stream<Shift?> watchOpenShift() =>
      _dao.watchOpenShift().map(_toEntity);

  @override
  Future<Shift> open({
    required String staffId,
    required int openingBalanceMinor,
    required int? masterDataVersion,
    required String deviceId,
    bool blindClose = true,
  }) async {
    final DateTime openedAt = _now().toUtc();
    final String id = _uuid.v4();

    await _dao.insertShift(
      ShiftsCompanion.insert(
        id: id,
        staffId: staffId,
        openingBalanceMinor: openingBalanceMinor,
        status: ShiftStatus.open,
        clientOpenedAt: openedAt,
        masterDataVersion: Value<int?>(masterDataVersion),
        deviceId: Value<String>(deviceId),
        blindClose: Value<bool>(blindClose),
        // `synced` sengaja dibiarkan pada nilai bawaan `false`: shift yang baru
        // dibuka pun harus terkirim lebih dulu agar transaksi anaknya punya
        // induk di server ([03 §2.3]).
      ),
    );

    return Shift(
      id: id,
      staffId: staffId,
      openingBalanceMinor: openingBalanceMinor,
      closingBalanceMinor: 0,
      expectedBalanceMinor: 0,
      discrepancyMinor: 0,
      status: ShiftStatus.open,
      clientOpenedAt: openedAt,
      masterDataVersion: masterDataVersion,
      deviceId: deviceId,
      blindClose: blindClose,
    );
  }

  Shift? _toEntity(LocalShift? row) {
    if (row == null) return null;
    return Shift(
      id: row.id,
      staffId: row.staffId,
      openingBalanceMinor: row.openingBalanceMinor,
      closingBalanceMinor: row.closingBalanceMinor,
      expectedBalanceMinor: row.expectedBalanceMinor,
      discrepancyMinor: row.discrepancyMinor,
      status: row.status,
      clientOpenedAt: row.clientOpenedAt,
      clientClosedAt: row.clientClosedAt,
      declaredCashMinor: row.declaredCashMinor,
      declaredEdcTotalMinor: row.declaredEdcTotalMinor,
      declaredQrisTotalMinor: row.declaredQrisTotalMinor,
      blindClose: row.blindClose,
      masterDataVersion: row.masterDataVersion,
      deviceId: row.deviceId,
      closedBy: row.closedBy,
    );
  }

  /// ═══════════════════════════════════════════════════════════════════════
  /// `cashLinesOf` DIHAPUS PADA M15.3 — JANGAN DIKEMBALIKAN
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Metode itu ada untuk satu tujuan: memberi P-12 bahan menghitung
  /// `expected_balance`. Sejak Blind Closing (butir 9), layar tutup shift tidak
  /// boleh dapat menghitung apa pun — dan menyediakan bahannya, walau tidak
  /// dipakai, hanya menunggu seseorang memakainya lagi "sekadar untuk membantu
  /// kasir".
  ///
  /// `TransactionDao` ikut dilepas dari konstruktor karena inilah satu-satunya
  /// yang membutuhkannya. Ketergantungan yang tersisa tanpa pemakai adalah
  /// undangan.

  @override
  Future<Shift> close({
    required String shiftId,
    required int declaredCashMinor,
    required int declaredEdcMinor,
    required int declaredQrisMinor,
    bool blindClose = true,
    String? closedBy,
  }) async {
    final LocalShift? row = await _dao.openShift();
    if (row == null || row.id != shiftId) {
      throw StateError('Shift yang hendak ditutup tidak lagi terbuka.');
    }

    final DateTime closedAt = _now().toUtc();

    await _dao.closeShift(
      id: shiftId,
      declaredCashMinor: declaredCashMinor,
      declaredEdcMinor: declaredEdcMinor,
      declaredQrisMinor: declaredQrisMinor,
      clientClosedAt: closedAt,
      blindClose: blindClose,
      closedBy: closedBy,
    );

    return Shift(
      id: shiftId,
      staffId: row.staffId,
      openingBalanceMinor: row.openingBalanceMinor,
      closingBalanceMinor: declaredCashMinor,
      // Tetap 0 — dihitung server. Lihat catatan pada `Shift`.
      expectedBalanceMinor: 0,
      discrepancyMinor: 0,
      status: ShiftStatus.closed,
      clientOpenedAt: row.clientOpenedAt,
      clientClosedAt: closedAt,
      declaredCashMinor: declaredCashMinor,
      declaredEdcTotalMinor: declaredEdcMinor,
      declaredQrisTotalMinor: declaredQrisMinor,
      blindClose: blindClose,
      masterDataVersion: row.masterDataVersion,
      deviceId: row.deviceId,
      closedBy: closedBy,
    );
  }
}
