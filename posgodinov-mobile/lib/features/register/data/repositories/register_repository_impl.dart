import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/features/register/domain/cart_math.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/sale_transaction.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:uuid/uuid.dart';

class RegisterRepositoryImpl implements RegisterRepository {
  const RegisterRepositoryImpl({
    required TransactionDao dao,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _dao = dao,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final TransactionDao _dao;
  final Uuid _uuid;
  final DateTime Function() _now;

  @override
  Future<SaleTransaction> completeSale({
    required String shiftId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
    required int cashReceivedMinor,
    String customerName = '',
  }) async {
    if (lines.isEmpty) {
      throw ArgumentError('Tidak dapat menyimpan transaksi tanpa item.');
    }

    // UUID transaksi dibuat SEKALI di sini. Baris keranjang sudah membawa
    // UUID-nya masing-masing sejak lahir, dan keduanya tidak pernah
    // diregenerasi saat pengiriman ulang ([03 §2.3]).
    final String transactionId = _uuid.v4();
    final DateTime createdAt = _now().toUtc();
    final int totalMinor = CartMath.total(lines);

    await _dao.insertWithItems(
      TransactionsCompanion.insert(
        id: transactionId,
        shiftId: shiftId,
        totalAmountMinor: totalMinor,
        paymentMethod: paymentMethod,
        status: TransactionStatus.completed,
        clientCreatedAt: createdAt,
        customerName: Value<String>(customerName),
        // `synced` dibiarkan pada nilai bawaan `false`: transaksi langsung
        // masuk antrean sinkronisasi.
      ),
      lines
          .map(
            (CartLine l) => TransactionItemsCompanion.insert(
              id: l.id,
              transactionId: transactionId,
              productId: l.productId,
              productName: l.productName,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
            ),
          )
          .toList(growable: false),
    );

    return SaleTransaction(
      id: transactionId,
      shiftId: shiftId,
      lines: lines,
      totalAmountMinor: totalMinor,
      paymentMethod: paymentMethod,
      status: TransactionStatus.completed,
      clientCreatedAt: createdAt,
      customerName: customerName,
      cashReceivedMinor: cashReceivedMinor,
    );
  }
}
