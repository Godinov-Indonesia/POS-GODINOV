import 'package:drift/drift.dart';

/// Jejak setiap upaya sinkronisasi — bahan diagnosis P-13.
///
/// Backend mengembalikan `200` walau sebagian data gagal, dan **hanya transaksi
/// yang dilacak per-ID** ([03 §2.3]). Ketika pemilik melaporkan "penjualan
/// kemarin tidak muncul di laporan", tabel inilah satu-satunya tempat yang dapat
/// menjawab apakah perangkat pernah mengirim, apa yang dijawab server, dan
/// berapa yang benar-benar tersimpan.
///
/// Baris lama dipangkas berkala (lihat `SyncDao.pruneLogs`) — ini data
/// diagnostik, bukan data keuangan.
@DataClassName('SyncLog')
class SyncLogs extends Table {
  IntColumn get id => integer().autoIncrement()();

  /// Nama `SyncTrigger` yang memulai upaya ini (online, periodic, shiftClose,
  /// manual, startup, resume, background, transaction).
  TextColumn get trigger => text()();

  DateTimeColumn get startedAt => dateTime()();

  IntColumn get durationMs => integer()();

  // ── Yang dikirim ───────────────────────────────────────────────────────────

  IntColumn get shiftsSent => integer().withDefault(const Constant(0))();

  IntColumn get transactionsSent => integer().withDefault(const Constant(0))();

  IntColumn get wastesSent => integer().withDefault(const Constant(0))();

  // ── Yang diakui server ─────────────────────────────────────────────────────

  IntColumn get shiftsSynced => integer().withDefault(const Constant(0))();

  IntColumn get transactionsSynced =>
      integer().withDefault(const Constant(0))();

  IntColumn get wastesSynced => integer().withDefault(const Constant(0))();

  /// `failed_transactions` dari respons, dipisahkan koma. Kosong bila tidak ada.
  TextColumn get failedTransactionIds =>
      text().withDefault(const Constant(''))();

  /// `true` hanya bila seluruh hitungan cocok **dan** tidak ada transaksi gagal.
  /// `200` dari server **bukan** penentu ([09 §6.3]).
  BoolColumn get ok => boolean().withDefault(const Constant(false))();

  /// Pesan kegagalan transport atau kontrak, bila ada.
  TextColumn get error => text().nullable()();

  // Tanpa override `primaryKey`: `autoIncrement()` sudah menjadikan [id]
  // primary key. Mendeklarasikan keduanya membuat drift_dev menolak tabel ini
  // dengan "Tables can not have both an autoIncrement() column and a custom
  // primary key".
}
