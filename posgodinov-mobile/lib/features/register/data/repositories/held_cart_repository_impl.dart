import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/daos/held_cart_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/void_log_dao.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';
import 'package:posgodinov_mobile/features/register/domain/cart_math.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:uuid/uuid.dart';

/// Pesanan ditahan — P-08.
///
/// Isi keranjang disimpan sebagai JSON: data yang belum menjadi transaksi tidak
/// layak menempati tabel relasional kedua, dan bentuknya masih boleh berubah
/// tanpa memicu migrasi skema.
class HeldCartRepositoryImpl implements HeldCartRepository {
  const HeldCartRepositoryImpl({
    required AppDatabase database,
    required HeldCartDao dao,
    required VoidLogDao voidLogDao,
    required PrintQueueService printQueue,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _db = database,
        _dao = dao,
        _voidLogDao = voidLogDao,
        _printQueue = printQueue,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final AppDatabase _db;
  final HeldCartDao _dao;
  final VoidLogDao _voidLogDao;
  final PrintQueueService _printQueue;
  final Uuid _uuid;
  final DateTime Function() _now;

  @override
  Future<String> hold({
    required List<CartLine> lines,
    required String label,
  }) async {
    if (lines.isEmpty) {
      throw ArgumentError('Tidak dapat menahan keranjang kosong.');
    }

    final String id = _uuid.v4();

    await _dao.hold(
      HeldCartsCompanion.insert(
        id: id,
        linesJson: _encode(lines),
        totalMinor: CartMath.total(lines),
        itemCount: CartMath.itemCount(lines),
        heldAt: _now().toUtc(),
        label: Value<String>(label),
      ),
    );
    return id;
  }

  @override
  Stream<List<HeldCartSummary>> watchAll() {
    return _dao.watchAll().map(
          (List<HeldCart> rows) => rows
              .map(
                (HeldCart r) => HeldCartSummary(
                  id: r.id,
                  label: r.label,
                  totalMinor: r.totalMinor,
                  itemCount: r.itemCount,
                  heldAt: r.heldAt,
                ),
              )
              .toList(growable: false),
        );
  }

  @override
  Future<List<CartLine>> resume(String id) async {
    final HeldCart? row = await _dao.findById(id);
    if (row == null) return const <CartLine>[];

    final List<CartLine> lines = _decode(row.linesJson);

    // Dihapus setelah diambil: pesanan yang sama tidak boleh muncul dua kali di
    // daftar tahan sementara isinya sudah kembali ke keranjang aktif.
    await _dao.remove(id);
    return lines;
  }

  /// ═══════════════════════════════════════════════════════════════════════
  /// PEMBATALAN, BUKAN PENGHAPUSAN ([11 §M13.5])
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Urutannya mengikat: `void_logs` ditulis **lebih dulu**, baris hold dibuang
  /// kemudian, keduanya dalam satu transaksi SQLite. Urutan sebaliknya membuka
  /// jendela — sekecil apa pun — di mana pesanannya sudah lenyap tetapi
  /// jejaknya belum ada.
  @override
  Future<void> cancel({
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
    HeldCart? cancelled;
    List<CartLine> cancelledLines = const <CartLine>[];

    await _db.transaction(() async {
      final HeldCart? cart = await _dao.findById(id);
      if (cart == null) return;

      final List<CartLine> lines = _decode(cart.linesJson);

      cancelled = cart;
      cancelledLines = lines;

      await _voidLogDao.insertLog(
        VoidLogsCompanion.insert(
          id: voidLogId,
          shiftId: shiftId,
          staffId: staffId,
          authorizedBy: Value<String?>(authorizedBy),
          scope: VoidScope.heldOrder,
          heldCartId: Value<String?>(id),
          quantityBefore: Value<int>(
            lines.fold<int>(0, (int sum, CartLine l) => sum + l.quantity),
          ),
          quantityAfter: const Value<int>(0),
          valueAmountMinor: cart.totalMinor,
          reasonCode: reasonCode,
          reasonNotes: Value<String>(reasonNotes),
          // ⚠️ WAJIB UTUH — lihat catatan pada kontraknya.
          itemsSnapshotJson: Value<String?>(
            jsonEncode(<Map<String, dynamic>>[
              for (final CartLine l in lines)
                <String, dynamic>{
                  'product_id': l.productId,
                  'product_name': l.productName,
                  'quantity': l.quantity,
                  'unit_price': Money.toMajor(l.unitPriceMinor),
                },
            ]),
          ),
          clientCreatedAt: now,
        ),
      );

      await _dao.remove(id);
    });

    // ── BUTIR 6 — struk pembatalan, DI LUAR transaksi basis data ──────────
    final HeldCart? cart = cancelled;
    if (cart != null) {
      await _printQueue.enqueueCancelReceipt(
        voidLogId,
        CancelReceiptData(
          outletName: await _printQueue.resolveOutletName(),
          issuedAt: now,
          scope: VoidScope.heldOrder,
          // Label pesanan menggantikan kode struk: pesanan tertahan tidak
          // pernah punya nomor struk, dan "Meja 4" jauh lebih berguna bagi
          // supervisor daripada UUID.
          heldCartLabel: cart.label,
          cashierName: cashierName,
          authorizedByName: authorizedByName,
          reasonCode: reasonCode,
          reasonNotes: reasonNotes,
          lines: <AuditReceiptLine>[
            for (final CartLine l in cancelledLines)
              AuditReceiptLine(
                productName: l.productName,
                quantity: l.quantity,
                unitPriceMinor: l.unitPriceMinor,
              ),
          ],
          totalCancelledMinor: cart.totalMinor,
        ),
      );
    }
  }

  String _encode(List<CartLine> lines) => jsonEncode(
        lines
            .map(
              (CartLine l) => <String, dynamic>{
                // UUID baris ikut disimpan — pesanan yang diambil kembali lalu
                // dibayar harus memakai UUID item yang SAMA ([03 §2.3]).
                'id': l.id,
                'product_id': l.productId,
                'product_name': l.productName,
                'unit_price_minor': l.unitPriceMinor,
                'quantity': l.quantity,
                'note': l.note,
              },
            )
            .toList(growable: false),
      );

  List<CartLine> _decode(String raw) {
    final Object? decoded = jsonDecode(raw);
    if (decoded is! List<dynamic>) return const <CartLine>[];

    return decoded
        .whereType<Map<String, dynamic>>()
        .map(
          (Map<String, dynamic> j) => CartLine(
            id: j['id'] as String,
            productId: j['product_id'] as String,
            productName: j['product_name'] as String,
            unitPriceMinor: j['unit_price_minor'] as int,
            quantity: j['quantity'] as int,
            note: j['note'] as String? ?? '',
          ),
        )
        .toList(growable: false);
  }
}
