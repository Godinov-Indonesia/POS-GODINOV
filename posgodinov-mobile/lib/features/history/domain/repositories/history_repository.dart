import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';

abstract interface class HistoryRepository {
  /// Transaksi shift berjalan, dibaca dari SQLite — **selalu tersedia**,
  /// termasuk saat perangkat offline.
  Stream<List<HistoryEntry>> watchCurrentShift(String shiftId);

  /// Riwayat dari server.
  ///
  /// > ⚠️ **Terbatas 50 baris terakhir, selamanya.** Handler backend menetapkan
  /// > `limit = 50`, `offset = 0` secara *hard-code*; kode pembaca query
  /// > parameter masih dalam bentuk komentar ([03 §2.4]). Tidak ada filter
  /// > tanggal maupun filter kasir. UI **wajib** menyatakan batas ini.
  Future<List<HistoryEntry>> fetchFromServer();

  /// Membatalkan transaksi.
  ///
  /// Mengirim ulang **UUID yang sama** berstatus `CANCELLED`; server melakukan
  /// *reverse deduction* dan mengembalikan bahan baku ke inventori
  /// ([02 §2.12]).
  Future<void> voidTransaction({
    required String id,
    required String cancelNotes,
  });
}
