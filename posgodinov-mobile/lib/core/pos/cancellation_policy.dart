/// **Mesin keputusan pembatalan — satu-satunya tempat butir 15 diputuskan.**
///
/// ═══════════════════════════════════════════════════════════════════════════
/// ATURAN YANG MENGIKAT SELURUH APLIKASI
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Berkas ini adalah **satu-satunya** tempat `receiptPrintedAt` boleh dibaca
/// untuk menentukan nasib sebuah pembatalan. Menduplikasi logikanya di layar —
/// "kalau sudah tercetak, sembunyikan tombol Void" — adalah pelanggaran
/// Definisi Selesai M13, dan alasannya bukan kerapian:
///
/// Aturan ini akan berubah. Ambang otoritas, kebijakan per-bisnis, retur lintas
/// outlet — semuanya menyentuh keputusan yang sama. Bila keputusannya tersebar
/// di lima layar, perubahan berikutnya akan mengenai empat di antaranya dan
/// meninggalkan satu yang diam-diam masih memakai aturan lama. Layar yang
/// terlewat itu adalah layar tempat uang bocor.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// DISKRIMINATORNYA SATU KOLOM ([11 §2.1])
/// ═══════════════════════════════════════════════════════════════════════════
///
/// ```
/// receiptPrintedAt == null  → wilayah VOID
/// receiptPrintedAt != null  → wilayah RETUR
/// ```
///
/// Struk yang sudah keluar dari printer adalah dokumen yang berpindah tangan ke
/// pelanggan. Mengubah transaksi asal setelah dokumen itu terbit berarti
/// menerbitkan realitas kedua yang bertentangan dengan kertas di tangan
/// pelanggan.
///
/// Seluruh fungsi di sini **murni**: tidak menyentuh Drift, jaringan, maupun
/// waktu. Kasus ujinya identik dengan sisi Web —
/// `fixtures/cancellation-decision.json` di akar repositori.
library;

import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Jenis keputusan.
enum CancellationKind { voidTransaction, returnTransaction, forbidden }

/// Mengapa sebuah pembatalan ditolak.
enum ForbiddenReason {
  /// Sudah dibatalkan; tidak ada yang tersisa untuk dibatalkan lagi.
  alreadyVoided('Transaksi ini sudah dibatalkan sebelumnya.'),

  /// Seluruh item sudah diretur habis.
  fullyReturned('Seluruh item pada transaksi ini sudah diretur.'),

  /// Transaksi tercetak tanpa item — data rusak, bukan kasus operasional.
  nothingToCancel('Transaksi ini tidak memiliki item yang dapat diproses.');

  const ForbiddenReason(this.message);

  /// Pesan siap tampil — dipakai layar Void dan Retur agar keduanya sejalan.
  final String message;
}

/// Bentuk minimum item yang dibutuhkan keputusan ini.
class CancellableItem extends Equatable {
  const CancellableItem({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPriceMinor,
  });

  final String id;
  final String productId;
  final String productName;
  final int quantity;

  /// **INTEGER SEN** — snapshot harga saat penjualan terjadi.
  final int unitPriceMinor;

  @override
  List<Object?> get props =>
      <Object?>[id, productId, productName, quantity, unitPriceMinor];
}

/// Bentuk minimum transaksi yang dibutuhkan keputusan ini.
class CancellableTransaction extends Equatable {
  const CancellableTransaction({
    required this.id,
    required this.status,
    this.receiptPrintedAt,
    this.items = const <CancellableItem>[],
  });

  final String id;
  final TransactionStatus status;

  /// `null` = struk belum pernah terbit.
  final DateTime? receiptPrintedAt;

  final List<CancellableItem> items;

  @override
  List<Object?> get props => <Object?>[id, status, receiptPrintedAt, items];
}

/// Satu baris yang masih boleh diretur, beserta sisanya.
class ReturnableItem extends Equatable {
  const ReturnableItem({
    required this.transactionItemId,
    required this.productId,
    required this.productName,
    required this.originalQuantity,
    required this.alreadyReturned,
    required this.returnable,
    required this.unitPriceMinor,
  });

  final String transactionItemId;
  final String productId;
  final String productName;
  final int originalQuantity;
  final int alreadyReturned;

  /// `originalQuantity − alreadyReturned`. Selalu ≥ 0.
  final int returnable;

  /// **INTEGER SEN** — snapshot harga ASAL, bukan harga hari ini. Pelanggan
  /// menerima kembali uang yang benar-benar ia bayarkan.
  final int unitPriceMinor;

  bool get isExhausted => returnable == 0;

  @override
  List<Object?> get props => <Object?>[
        transactionItemId,
        productId,
        productName,
        originalQuantity,
        alreadyReturned,
        returnable,
        unitPriceMinor,
      ];
}

/// Kebijakan dari master data ([11 §4.4]).
class CancellationPolicy extends Equatable {
  const CancellationPolicy({
    this.requireSupervisorForVoid = true,
    this.requireSupervisorForReturn = true,
  });

  /// Bawaan KETAT. Kebijakan longgar secara bawaan berarti outlet yang belum
  /// pernah membuka layar pengaturan berjalan tanpa pengendalian apa pun — dan
  /// itulah mayoritas outlet.
  static const CancellationPolicy strict = CancellationPolicy();

  final bool requireSupervisorForVoid;
  final bool requireSupervisorForReturn;

  @override
  List<Object?> get props =>
      <Object?>[requireSupervisorForVoid, requireSupervisorForReturn];
}

/// Hasil keputusan.
class CancellationDecision extends Equatable {
  const CancellationDecision._({
    required this.kind,
    this.requiresAuth = false,
    this.requiresPrint = false,
    this.returnableItems = const <ReturnableItem>[],
    this.reason,
  });

  const CancellationDecision.void_({required bool requiresAuth})
      : this._(
          kind: CancellationKind.voidTransaction,
          requiresAuth: requiresAuth,
          // SELALU true. Butir 6: setiap eksekusi Void wajib menembakkan
          // instruksi cetak struk pembatalan.
          requiresPrint: true,
        );

  const CancellationDecision.return_({
    required bool requiresAuth,
    required List<ReturnableItem> items,
  }) : this._(
          kind: CancellationKind.returnTransaction,
          requiresAuth: requiresAuth,
          requiresPrint: true,
          returnableItems: items,
        );

  const CancellationDecision.forbidden(ForbiddenReason reason)
      : this._(kind: CancellationKind.forbidden, reason: reason);

  final CancellationKind kind;
  final bool requiresAuth;
  final bool requiresPrint;
  final List<ReturnableItem> returnableItems;
  final ForbiddenReason? reason;

  bool get isVoid => kind == CancellationKind.voidTransaction;
  bool get isReturn => kind == CancellationKind.returnTransaction;
  bool get isForbidden => kind == CancellationKind.forbidden;

  /// Total kuantitas yang masih boleh diretur.
  int get totalReturnable => returnableItems.fold<int>(
        0,
        (int sum, ReturnableItem i) => sum + i.returnable,
      );

  @override
  List<Object?> get props =>
      <Object?>[kind, requiresAuth, requiresPrint, returnableItems, reason];
}

/// Menentukan nasib sebuah permintaan pembatalan.
///
/// [alreadyReturned] adalah peta `transactionItemId → kuantitas yang sudah
/// diretur`. Berasal dari tabel `returns` lokal, atau dari
/// `GET /v1/pos/transactions/{id}/returnable` untuk transaksi hasil pencarian
/// kode struk. Peta kosong berarti belum pernah ada retur.
CancellationDecision decideCancellation(
  CancellableTransaction transaction, {
  Map<String, int> alreadyReturned = const <String, int>{},
  CancellationPolicy policy = CancellationPolicy.strict,
}) {
  // ── 1. Sudah dibatalkan ──────────────────────────────────────────────────
  //
  // `cancelled` (warisan v1) dan `voided` (v2) sama-sama berarti transaksi ini
  // sudah tidak ada. Memeriksa salah satunya saja akan membuat transaksi lama
  // dapat di-void dua kali, dan server memotong stok dua kali.
  if (transaction.status.isCancellation) {
    return const CancellationDecision.forbidden(ForbiddenReason.alreadyVoided);
  }

  // ── 2. Struk BELUM terbit → VOID ─────────────────────────────────────────
  //
  // Diperiksa SEBELUM daftar item: transaksi tanpa item pun tetap boleh
  // di-void selama ia belum menjadi dokumen — yang dibatalkan adalah baris
  // keuangannya, bukan isinya.
  if (transaction.receiptPrintedAt == null) {
    return CancellationDecision.void_(
      requiresAuth: policy.requireSupervisorForVoid,
    );
  }

  // ── 3. Struk SUDAH terbit → RETUR ────────────────────────────────────────
  if (transaction.items.isEmpty) {
    return const CancellationDecision.forbidden(
      ForbiddenReason.nothingToCancel,
    );
  }

  final List<ReturnableItem> returnable = transaction.items
      .map((CancellableItem item) {
        final int already = alreadyReturned[item.id] ?? 0;
        final int remaining = item.quantity - already;
        return ReturnableItem(
          transactionItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          originalQuantity: item.quantity,
          alreadyReturned: already,
          // Penjepitan ke 0 bukan paranoia: server adalah penentu terakhir, dan
          // peta yang datang darinya bisa saja melebihi qty asal bila sebuah
          // retur tersinkron dari perangkat lain di antara dua pembacaan.
          returnable: remaining < 0 ? 0 : remaining,
          unitPriceMinor: item.unitPriceMinor,
        );
      })
      // Baris yang sudah habis diretur TETAP disertakan, dengan `returnable: 0`.
      // Menyembunyikannya membuat kasir mengira barisnya tidak pernah ada dan
      // bertanya-tanya mengapa totalnya tidak cocok.
      .toList(growable: false);

  final int total = returnable.fold<int>(
    0,
    (int sum, ReturnableItem i) => sum + i.returnable,
  );

  if (total == 0) {
    return const CancellationDecision.forbidden(ForbiddenReason.fullyReturned);
  }

  return CancellationDecision.return_(
    requiresAuth: policy.requireSupervisorForReturn,
    items: returnable,
  );
}
