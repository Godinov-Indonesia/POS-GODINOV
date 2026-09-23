import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/tables/shifts_table.dart';

/// Retur penjualan — butir 15 ([11 §3.2] migrasi `000019`).
///
/// # Retur adalah peristiwa baru, bukan perubahan transaksi lama
///
/// Struk yang sudah keluar dari printer adalah dokumen yang berpindah tangan ke
/// pelanggan. Mengubah transaksi asal setelah dokumen itu terbit berarti
/// menerbitkan realitas kedua yang bertentangan dengan kertas di tangan
/// pelanggan — dan itu persis lubang yang dipakai kecurangan "cetak dulu,
/// batalkan belakangan, uang masuk kantong".
///
/// Karena itu transaksi asal **tetap `COMPLETED` selamanya**; retur lahir
/// sebagai baris tersendiri dengan waktunya sendiri, shift-nya sendiri, dan
/// struknya sendiri ([11 §2.1]).
@DataClassName('LocalReturn')
class Returns extends Table {
  /// UUID v4 dibuat KLIEN ([11 §1] aturan R2).
  TextColumn get id => text()();

  /// Transaksi yang diretur.
  ///
  /// Sengaja **tanpa** foreign key ke [Transactions]. Retur dapat diajukan atas
  /// transaksi yang ditemukan lewat pencarian Kode Struk (butir 16) dan berasal
  /// dari perangkat lain, sehingga barisnya **tidak ada** di basis data ini. FK
  /// di sini berarti retur yang sah gagal tersimpan di depan pelanggan yang
  /// barangnya sudah diterima kembali.
  ///
  /// Mengikuti preseden yang sama pada `Shifts.staffId` dan
  /// `TransactionItems.productId`: catatan keuangan tidak boleh bergantung pada
  /// keberadaan baris lain di perangkat ini.
  TextColumn get originalTransactionId => text()();

  /// Shift **saat retur terjadi** — sengaja dapat berbeda dari shift transaksi
  /// asal. Pelanggan yang kembali besok adalah kasus ritel normal.
  ///
  /// FK ditegakkan: shift adalah data buatan perangkat ini sendiri.
  TextColumn get shiftId => text().references(Shifts, #id)();

  TextColumn get deviceId => text().withDefault(const Constant('legacy'))();

  /// Kasir pelaksana.
  TextColumn get staffId => text()();

  /// Pemberi otoritas (supervisor). `null` bila kebijakan tidak mewajibkannya.
  TextColumn get authorizedBy => text().nullable()();

  TextColumn get returnType => textEnum<ReturnKind>()();

  TextColumn get refundMethod => textEnum<RefundMethod>()();

  /// **INTEGER SEN** — nominal yang kembali ke pelanggan.
  IntColumn get refundAmountMinor => integer()();

  /// Kamus beku [ReasonCodes.returnReasons].
  TextColumn get reasonCode => text()();

  TextColumn get reasonNotes => text().withDefault(const Constant(''))();

  /// Bukti struk retur terbit.
  BoolColumn get receiptPrinted =>
      boolean().withDefault(const Constant(false))();

  DateTimeColumn get receiptPrintedAt => dateTime().nullable()();

  /// Kode yang dapat diketik manusia, mis. `AB1234-250820-R2M9` (butir 16).
  TextColumn get shortCode => text().nullable()();

  DateTimeColumn get clientCreatedAt => dateTime()();

  // ── Metadata lokal — TIDAK PERNAH dikirim ke server ([09 §6.3] aturan 5) ────

  BoolColumn get synced => boolean().withDefault(const Constant(false))();

  /// Ditolak server secara **PERMANEN** — KARANTINA ([11 §4.3]).
  ///
  /// Berbeda dari [synced] yang menjawab "sudah sampai?", kolom ini menjawab
  /// "masih layak dicoba?". Baris berkarantina adalah baris yang alasan
  /// penolakannya TIDAK AKAN BERUBAH berapa kali pun dikirim ulang — pembayaran
  /// kartu tanpa nomor trace, retur yang melebihi kuantitas asli.
  ///
  /// Membiarkannya di antrean berarti setiap putaran sinkronisasi membawa ulang
  /// baris yang pasti ditolak, dan seluruh baris di belakangnya ikut tertahan.
  /// Karena itu ia dikeluarkan dari antrean — **bukan dihapus**. Datanya tetap
  /// utuh di perangkat dan muncul di P-13 sebagai "Butuh tindakan".
  BoolColumn get quarantined => boolean().withDefault(const Constant(false))();

  TextColumn get syncError => text().nullable()();

  IntColumn get syncAttempts => integer().withDefault(const Constant(0))();

  DateTimeColumn get lastSyncAttemptAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
