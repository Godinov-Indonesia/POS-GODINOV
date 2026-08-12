import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/held_cart_dao.dart';
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
    required HeldCartDao dao,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _dao = dao,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final HeldCartDao _dao;
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

  @override
  Future<void> discard(String id) async {
    await _dao.remove(id);
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
