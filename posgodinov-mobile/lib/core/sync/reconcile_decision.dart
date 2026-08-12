import 'package:posgodinov_mobile/core/sync/sync_models.dart';

/// Keputusan rekonsiliasi — **murni, tanpa I/O**.
///
/// Dipisahkan dari [Reconciler] yang melakukan penulisan, karena inilah logika
/// paling berkonsekuensi di seluruh aplikasi: satu keputusan salah di sini
/// menghapus penjualan dari antrean tanpa pernah sampai ke server. Sebagai
/// fungsi murni, seluruh tabel kombinasinya dapat diuji tanpa basis data.
///
/// # Kontrak yang menjadi dasarnya ([03 §2.3])
///
/// - `200` **tidak** berarti semuanya berhasil.
/// - Hanya transaksi yang dilacak per-ID lewat `failed_transactions`.
/// - Kegagalan shift dan waste hanya terungkap lewat **selisih hitungan**.
/// - Transaksi punya FK ke `shifts(id)`, dan backend memproses
///   `Shifts → Transactions → Wastes` berurutan.
class ReconcileDecision {
  const ReconcileDecision({
    required this.allShiftsOk,
    required this.allWastesOk,
    required this.failedTransactionIds,
    required this.shiftsSynced,
    required this.shiftsSent,
    required this.wastesSynced,
    required this.wastesSent,
  });

  factory ReconcileDecision.from({
    required SentBatch sent,
    required SyncUpResponse response,
  }) {
    return ReconcileDecision(
      allShiftsOk: response.shiftsSynced == sent.shifts.length,
      allWastesOk: response.wastesSynced == sent.wastes.length,
      failedTransactionIds: response.failedTransactionIds.toSet(),
      shiftsSynced: response.shiftsSynced,
      shiftsSent: sent.shifts.length,
      wastesSynced: response.wastesSynced,
      wastesSent: sent.wastes.length,
    );
  }

  final bool allShiftsOk;
  final bool allWastesOk;
  final Set<String> failedTransactionIds;
  final int shiftsSynced;
  final int shiftsSent;
  final int wastesSynced;
  final int wastesSent;

  /// Shift boleh ditandai tersinkron **hanya** bila seluruh hitungan cocok.
  ///
  /// Bila tidak, kita tidak tahu shift mana yang gagal — maka tidak satu pun
  /// boleh ditandai.
  bool shiftSynced() => allShiftsOk;

  /// **Aturan yang menutup celah paling mahal.**
  ///
  /// Sebuah transaksi hanya ditandai tersinkron bila **dua syarat** terpenuhi:
  ///
  /// 1. Ia tidak muncul di `failed_transactions`, **dan**
  /// 2. Seluruh shift dalam batch ini terkonfirmasi tersimpan.
  ///
  /// Syarat kedua yang sering terlewat: bila shift induk gagal, seluruh
  /// transaksinya ikut gagal karena foreign key — tetapi backend **tidak**
  /// menyebutkannya di `failed_transactions`. Menandainya tersinkron di situ
  /// adalah cara paling mudah kehilangan data penjualan secara permanen.
  bool transactionSynced(String id) =>
      !failedTransactionIds.contains(id) && allShiftsOk;

  bool wasteSynced() => allWastesOk;

  /// Alasan yang ditulis ke `sync_error` sebuah transaksi yang tertahan.
  ///
  /// `null` bila transaksi tersebut berhasil.
  String? transactionReason(String id) {
    if (failedTransactionIds.contains(id)) {
      return 'Ditolak server saat sinkronisasi. Akan dicoba ulang.';
    }
    if (!allShiftsOk) return 'Menunggu shift induk tersimpan di server.';
    return null;
  }

  String? shiftReason() {
    if (allShiftsOk) return null;
    return 'Sebagian shift gagal tersimpan ($shiftsSynced/$shiftsSent). '
        'Transaksi pada shift ini akan ikut tertunda.';
  }

  String? wasteReason() {
    if (allWastesOk) return null;
    return 'Sebagian waste gagal tersimpan ($wastesSynced/$wastesSent).';
  }

  /// `true` hanya bila seluruh hitungan cocok dan tidak ada transaksi ditolak.
  bool get ok =>
      allShiftsOk && allWastesOk && failedTransactionIds.isEmpty;
}
