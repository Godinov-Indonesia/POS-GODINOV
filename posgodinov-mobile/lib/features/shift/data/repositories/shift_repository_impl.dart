import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/shift_dao.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:posgodinov_mobile/features/shift/domain/shift_math.dart';
import 'package:uuid/uuid.dart';

class ShiftRepositoryImpl implements ShiftRepository {
  const ShiftRepositoryImpl({
    required ShiftDao dao,
    required TransactionDao transactionDao,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _dao = dao,
        _txDao = transactionDao,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final ShiftDao _dao;
  final TransactionDao _txDao;
  final Uuid _uuid;
  final DateTime Function() _now;

  @override
  Future<Shift?> currentOpenShift() async => _toEntity(await _dao.openShift());

  @override
  Stream<Shift?> watchOpenShift() =>
      _dao.watchOpenShift().map((LocalShift? row) => _toEntity(row));

  @override
  Future<Shift> open({
    required String staffId,
    required int openingBalanceMinor,
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
    );
  }

  @override
  Future<List<CashLine>> cashLinesOf(String shiftId) async {
    final List<TransactionWithItems> rows =
        await _txDao.transactionsOfShift(shiftId);

    return rows
        .map(
          (TransactionWithItems t) => CashLine(
            totalMinor: t.transaction.totalAmountMinor,
            method: t.transaction.paymentMethod,
            status: t.transaction.status,
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<Shift> close({
    required String shiftId,
    required int closingBalanceMinor,
  }) async {
    final LocalShift? row = await _dao.openShift();
    if (row == null || row.id != shiftId) {
      throw StateError('Shift yang hendak ditutup tidak lagi terbuka.');
    }

    final List<CashLine> lines = await cashLinesOf(shiftId);
    final int expected = ShiftMath.expectedBalance(
      openingBalanceMinor: row.openingBalanceMinor,
      lines: lines,
    );
    final int selisih = ShiftMath.discrepancy(
      closingBalanceMinor: closingBalanceMinor,
      expectedBalanceMinor: expected,
    );
    final DateTime closedAt = _now().toUtc();

    await _dao.closeShift(
      id: shiftId,
      closingBalanceMinor: closingBalanceMinor,
      expectedBalanceMinor: expected,
      discrepancyMinor: selisih,
      clientClosedAt: closedAt,
    );

    return Shift(
      id: shiftId,
      staffId: row.staffId,
      openingBalanceMinor: row.openingBalanceMinor,
      closingBalanceMinor: closingBalanceMinor,
      expectedBalanceMinor: expected,
      discrepancyMinor: selisih,
      status: ShiftStatus.closed,
      clientOpenedAt: row.clientOpenedAt,
      clientClosedAt: closedAt,
    );
  }
}
