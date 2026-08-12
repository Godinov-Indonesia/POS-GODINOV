import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/features/history/data/datasources/history_remote_ds.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';

class HistoryRepositoryImpl implements HistoryRepository {
  const HistoryRepositoryImpl({
    required TransactionDao dao,
    required HistoryRemoteDataSource remote,
  })  : _dao = dao,
        _remote = remote;

  final TransactionDao _dao;
  final HistoryRemoteDataSource _remote;

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

    return rows
        .map(
          (TransactionWithItems t) => HistoryEntry(
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
            lines: t.items
                .map(
                  (LocalTransactionItem i) => HistoryLine(
                    productName: i.productName,
                    quantity: i.quantity,
                    unitPriceMinor: i.unitPriceMinor,
                  ),
                )
                .toList(growable: false),
          ),
        )
        .toList(growable: false);
  }

  @override
  Future<List<HistoryEntry>> fetchFromServer() => _remote.fetch();

  @override
  Future<void> voidTransaction({
    required String id,
    required String cancelNotes,
  }) {
    // UUID TIDAK berubah, dan baris kembali ke antrean sinkronisasi. Server
    // mengenali id yang sama berstatus CANCELLED lalu mengembalikan bahan baku
    // ke inventori ([02 §2.12]).
    return _dao.voidTransaction(id, cancelNotes);
  }
}
