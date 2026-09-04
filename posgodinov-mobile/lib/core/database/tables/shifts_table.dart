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

  // ── v2 — Blind Closing & penguncian sesi ([11 §3.2] migrasi 000021) ────────

  /// **INTEGER SEN** — uang fisik hasil hitung laci.
  ///
  /// Pada Blind Closing (butir 9) inilah **satu-satunya** angka kas yang berasal
  /// dari kasir. [expectedBalanceMinor] dan [discrepancyMinor] menjadi urusan
  /// server dan tidak pernah dikirim balik ke perangkat ini ([11 §1] aturan R3).
  IntColumn get declaredCashMinor => integer().withDefault(const Constant(0))();

  /// **INTEGER SEN** — total settle EDC yang dibacakan kasir dari mesin EDC.
  IntColumn get declaredEdcTotalMinor =>
      integer().withDefault(const Constant(0))();

  /// **INTEGER SEN** — total settle QRIS.
  IntColumn get declaredQrisTotalMinor =>
      integer().withDefault(const Constant(0))();

  /// `true` bila shift ditutup **tanpa** kasir melihat angka sistem.
  ///
  /// Bawaannya `false`: alur tutup shift v1 masih menampilkan ekspektasi, dan
  /// menandai shift itu sebagai kesaksian buta berarti berbohong pada audit.
  /// M15.3 yang membalikkannya menjadi `true`.
  BoolColumn get blindClose => boolean().withDefault(const Constant(false))();

  /// Versi master data yang dipegang perangkat saat shift dibuka (butir 10).
  ///
  /// Nullable: shift yang lahir sebelum gerbang master data ada tidak dapat
  /// mengklaim telah melewatinya.
  IntColumn get masterDataVersion => integer().nullable()();

  /// Identitas instalasi pemilik sesi (butir 12).
  ///
  /// Dasar indeks unik parsial `uq_shift_open_per_device` di PostgreSQL: satu
  /// perangkat hanya boleh memiliki satu shift `OPEN`.
  TextColumn get deviceId => text().withDefault(const Constant('legacy'))();

  /// Staff yang menutup shift — dapat berbeda dari [staffId] pada Force Close
  /// oleh supervisor ([11 §M15.2]).
  TextColumn get closedBy => text().nullable()();

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
