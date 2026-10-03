import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/config/pos_config.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/core/sync/sync_triggers.dart';
import 'package:posgodinov_mobile/features/register/domain/entities/cart_line.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';
import 'package:posgodinov_mobile/features/register/presentation/cubit/cart_cubit.dart';
import 'package:posgodinov_mobile/features/history/presentation/widgets/void_reason_sheet.dart';

/// Gerbang penurunan kuantitas keranjang — **butir 5** ([11 §M13.4]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// SATU-SATUNYA JALAN MENURUNKAN KUANTITAS DARI UI
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Sebelum berkas ini ada, tombol minus memanggil `CartCubit.decrement()`
/// langsung dan tombol hapus memanggil `removeLine()` — keduanya melewati
/// `canDecrementTo()` sepenuhnya. `CartCubit` sudah memuat seluruh logika butir
/// 5 dan mendokumentasikan larangannya ("⚠️ Jangan dipanggil langsung dari
/// UI"), tetapi tidak ada yang menegakkannya: butir 5 hidup di Web dan mati di
/// Flutter tanpa satu baris pun terlihat salah.
///
/// **Ketiga jalur penurunan melewati kelas ini**, dan itu bukan kelengkapan
/// yang berlebihan:
///
///   · tombol **minus**     — penurunan satu unit
///   · tombol **hapus**     — penurunan ke nol untuk satu baris
///   · tombol **Kosongkan** — penurunan ke nol untuk SELURUH baris
///
/// Menjaga tombol minus saja akan membuat butir 5 punya pintu belakang selebar
/// pintu depan: kasir yang ditahan tombol minus cukup menekan hapus, atau
/// "Kosongkan", dan sepuluh unit lenyap tanpa satu pun baris audit.
///
/// ⚠️ Kelas ini **tidak mengubah kuantitas sendiri**. Ia memutuskan, membuka
/// Void Sheet bila perlu, menulis `void_logs`, lalu memanggil
/// [CartCubit.applyAudited] — metode yang namanya menyatakan bahwa auditnya
/// sudah dilakukan.
class CartVoidGuard {
  const CartVoidGuard({
    required this.shiftId,
    required this.staffId,
    required this.cashierName,
  });

  final String shiftId;
  final String staffId;
  final String cashierName;

  /// Menurunkan satu baris ke [nextQuantity].
  ///
  /// Mengembalikan `true` bila kuantitas benar-benar berubah. `false` berarti
  /// kasir mundur dari Void Sheet — dan mundur berarti **tidak ada yang
  /// berubah**, bukan penurunan yang diterapkan diam-diam.
  Future<bool> decreaseTo(
    BuildContext context, {
    required CartLine line,
    required int nextQuantity,
  }) async {
    final CartCubit cart = context.read<CartCubit>();

    final int decrease = line.quantity - nextQuantity;
    if (decrease <= 0) {
      cart.applyAudited(line.id, nextQuantity);
      return true;
    }

    if (!context.mounted) return false;

    final VoidReasonResult? result = await showVoidReasonSheet(
      context,
      title: 'Pembatalan Item Terpilih',
      description: '$decrease unit ${line.productName} akan dibatalkan. '
          'Setiap pembatalan item tercatat pada audit dan mencetak struk void.',
      valueMinor: decrease * line.unitPriceMinor,
      requiresAuth: true,
      submitLabel: 'Void & Cetak Struk',
    );

    if (result == null) return false;

    await getIt<RegisterRepository>().recordCartLineVoid(
      shiftId: shiftId,
      staffId: staffId,
      line: line,
      quantityBefore: line.quantity,
      quantityAfter: nextQuantity,
      reasonCode: result.reasonCode,
      reasonNotes: result.reasonNotes,
      cashierName: cashierName,
    );

    if (!context.mounted) return false;
    cart.applyAudited(line.id, nextQuantity);

    getIt<SyncTriggers>().onVoidSaved();
    return true;
  }

  /// Tombol minus.
  Future<void> decrementOne(BuildContext context, CartLine line) =>
      decreaseTo(context, line: line, nextQuantity: line.quantity - 1);

  /// Tombol hapus baris — penurunan ke NOL, bukan jalur terpisah.
  ///
  /// Membiarkan tombol hapus memakai jalur lain akan membuat butir 5 tidak
  /// berguna: kasir cukup menekan hapus alih-alih menekan minus enam kali.
  Future<void> removeLine(BuildContext context, CartLine line) =>
      decreaseTo(context, line: line, nextQuantity: 0);

  /// Tombol "Kosongkan".
  ///
  /// Yang diperiksa adalah penurunan **gabungan seluruh keranjang**, karena
  /// itulah yang benar-benar hilang. Bila melewati ambang, satu Void Sheet
  /// dibuka untuk seluruh keranjang dan satu baris `void_logs` ber-`scope`
  /// `CART_LINE` ditulis **per produk** — `ck_void_scope_ref` menuntut
  /// `product_id`, dan satu log gabungan tidak dapat menyatakan produk mana
  /// yang lenyap.
  Future<void> clearCart(BuildContext context) async {
    final CartCubit cart = context.read<CartCubit>();
    final List<CartLine> lines = List<CartLine>.of(cart.state.lines);
    if (lines.isEmpty) return;

    final PosConfig config = await PosConfig.read(getIt<SyncDao>());

    // Penurunan gabungan memakai PUNCAK setiap baris, bukan kuantitas saat ini.
    int totalDecrease = 0;
    int totalValueMinor = 0;
    for (final CartLine l in lines) {
      final int peak = cart.state.peakQuantity[l.id] ?? l.quantity;
      totalDecrease += peak;
      totalValueMinor += peak * l.unitPriceMinor;
    }

    if (!context.mounted) return;

    final VoidReasonResult? result = await showVoidReasonSheet(
      context,
      title: 'Mengosongkan keranjang memerlukan pembatalan',
      description:
          '$totalDecrease unit dari ${lines.length} produk akan lenyap — '
          'melewati ambang ${config.voidThresholdQty} unit. Isinya dicatat utuh '
          'pada log pembatalan; keranjang tidak pernah ada di server, sehingga '
          'catatan itulah satu-satunya salinan yang tersisa.',
      valueMinor: totalValueMinor,
      requiresAuth: config.requireSupervisorForVoid,
      submitLabel: 'Catat & kosongkan',
    );
    if (result == null) return;

    final RegisterRepository repo = getIt<RegisterRepository>();
    for (final CartLine l in lines) {
      final int peak = cart.state.peakQuantity[l.id] ?? l.quantity;
      await repo.recordCartLineVoid(
        shiftId: shiftId,
        staffId: staffId,
        line: l,
        quantityBefore: peak,
        quantityAfter: 0,
        reasonCode: result.reasonCode,
        reasonNotes: result.reasonNotes,
        cashierName: cashierName,
      );
    }

    if (!context.mounted) return;
    cart.clear();
    getIt<SyncTriggers>().onVoidSaved();
  }
}
