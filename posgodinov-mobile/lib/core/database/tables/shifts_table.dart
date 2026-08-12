import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Shift kasir — dibuka di P-04, ditutup di P-12 ([02 §2.11]).
///
/// **UUID dibuat KLIEN**, sama seperti transaksi: server tidak membuatkan, dan
/// inilah dasar idempotensi sinkronisasi ([03 §2.3]).
///
/// Sebuah shift disinkronkan **dua kali** — sekali saat dibuka (`OPEN`), sekali
/// saat ditutup (`CLOSED`). Upsert backend hanya menyentuh kolom penutupan;
/// `opening_balance` dan `staff_id` bersifat *immutable* setelah sinkronisasi
/// pertama ([02 §2.11]).
@DataClassName('LocalShift')
class Shifts extends Table {
  /// UUID v4 dibuat KLIEN saat shift dibuka.
  TextColumn get id => text()();

  /// Sengaja **tanpa** foreign key ke [Staffs].
  ///
  /// Master data ditarik ulang secara berkala dan staff yang dihapus pemilik
  /// akan lenyap dari payload. FK di sini berarti shift — beserta seluruh
  /// transaksi anaknya — ikut terhapus atau gagal tersimpan. Catatan keuangan
  /// tidak boleh bergantung pada keberadaan baris master data.
  TextColumn get staffId => text()();

  /// **INTEGER SEN** — modal awal laci.
  IntColumn get openingBalanceMinor => integer()();

  /// **INTEGER SEN** — uang fisik hasil hitung saat tutup shift.
  IntColumn get closingBalanceMinor =>
      integer().withDefault(const Constant(0))();

  /// **INTEGER SEN** — `opening + Σ(transaksi COMPLETED bermetode CASH)`.
  ///
  /// Dihitung **klien**; server tidak menghitung ulang ([02 §2.11]).
  IntColumn get expectedBalanceMinor =>
      integer().withDefault(const Constant(0))();

  /// **INTEGER SEN** — `closing − expected`. Negatif berarti kas kurang.
  ///
  /// Nilai inilah yang dijumlahkan pada dashboard pemilik sebagai indikator
  /// selisih kas, jadi rumusnya harus benar ([04 §A.3]).
  IntColumn get discrepancyMinor => integer().withDefault(const Constant(0))();

  TextColumn get status => textEnum<ShiftStatus>()();

  DateTimeColumn get clientOpenedAt => dateTime()();

  DateTimeColumn get clientClosedAt => dateTime().nullable()();

  // ── Metadata lokal — TIDAK PERNAH dikirim ke server ([09 §6.3] aturan 5) ────

  BoolColumn get synced => boolean().withDefault(const Constant(false))();

  TextColumn get syncError => text().nullable()();

  IntColumn get syncAttempts => integer().withDefault(const Constant(0))();

  DateTimeColumn get lastSyncAttemptAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
