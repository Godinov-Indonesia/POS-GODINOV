import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';

abstract interface class HistoryRepository {
  /// Transaksi shift berjalan, dibaca dari SQLite — **selalu tersedia**,
  /// termasuk saat perangkat offline.
  Stream<List<HistoryEntry>> watchCurrentShift(String shiftId);

  /// Aliran SELURUH transaksi lokal — **hanya untuk `history_scope: 'ALL'`**
  /// ([11 §M18.2]).
  ///
  /// Jalan mundur ke perilaku v1 di balik *feature flag*. Bawaan v2 adalah
  /// [watchCurrentShift]: riwayat terikat shift berjalan (butir 16), karena
  /// layar Riwayat adalah pintu masuk ke Void dan Retur.
  Stream<List<HistoryEntry>> watchAllTransactions();

  /// Riwayat dari server.
  ///
  /// > ⚠️ **Terbatas 50 baris terakhir, selamanya.** Handler backend menetapkan
  /// > `limit = 50`, `offset = 0` secara *hard-code*; kode pembaca query
  /// > parameter masih dalam bentuk komentar ([03 §2.4]). Tidak ada filter
  /// > tanggal maupun filter kasir. UI **wajib** menyatakan batas ini.
  Future<List<HistoryEntry>> fetchFromServer();

  /// Mencari SATU transaksi lampau lewat kode struk atau UUID — **butir 16**
  /// ([11 §M17.3]).
  ///
  /// Dicari LOKAL dulu, lalu server. Transaksi shift berjalan pasti ada di
  /// perangkat, dan menuntut jaringan untuk sesuatu yang sudah dipegang berarti
  /// fitur ini mati di outlet tanpa sinyal — tempat ia justru paling
  /// dibutuhkan ketika pelanggan datang membawa struk.
  ///
  /// `null` berarti tidak ditemukan di mana pun.
  Future<HistoryEntry?> lookupByCode(String code);

  /// Membatalkan transaksi — **butir 15** ([11 §M13.2]).
  ///
  /// Mengirim ulang **UUID yang sama** berstatus `VOIDED`; server melakukan
  /// *reverse deduction* dan mengembalikan bahan baku ke inventori
  /// ([02 §2.12]).
  ///
  /// [shiftId] dan [staffId] wajib karena setiap pembatalan melahirkan baris
  /// `void_logs` yang terikat pada keduanya — pembatalan tanpa pelaku dan tanpa
  /// shift tidak dapat diaudit, dan audit adalah satu-satunya alasan tabel itu
  /// ada.
  /// [cashierName] dan [authorizedByName] hanya untuk DICETAK; yang disimpan
  /// tetap id-nya. Struk yang hanya memuat UUID tidak dapat dibaca supervisor
  /// yang memeriksanya di laci.
  Future<void> voidTransaction({
    required String id,
    required String shiftId,
    required String staffId,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName,
    String? authorizedByName,
  });
}
