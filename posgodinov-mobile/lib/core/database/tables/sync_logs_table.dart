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

  /// Nama `SyncTrigger` yang memulai upaya ini — lihat enum `SyncTrigger`.
  ///
  /// Disimpan sebagai nama enum, bukan angka: baris ini dibaca manusia saat
  /// menelusuri insiden, dan `3` tidak memberi tahu siapa pun apa pun.
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

  // ── v2 — entitas audit ([11 §M12.3]) ──────────────────────────────────────
  //
  // Dicatat terpisah dari transaksi karena pertanyaan yang dijawabnya berbeda.
  // "Berapa transaksi terkirim" menjawab keluhan kasir; "berapa log pembatalan
  // terkirim" menjawab pertanyaan auditor — dan yang kedua justru paling sering
  // ditanyakan setelah ada dugaan kecurangan.

  IntColumn get returnsSent => integer().withDefault(const Constant(0))();

  IntColumn get returnsSynced => integer().withDefault(const Constant(0))();

  IntColumn get voidLogsSent => integer().withDefault(const Constant(0))();

  IntColumn get voidLogsSynced => integer().withDefault(const Constant(0))();

  IntColumn get securityEventsSent =>
      integer().withDefault(const Constant(0))();

  IntColumn get securityEventsSynced =>
      integer().withDefault(const Constant(0))();

  /// Baris yang dipindahkan ke KARANTINA pada putaran ini.
  ///
  /// Dicatat terpisah dari kegagalan biasa karena maknanya berbeda secara
  /// operasional: kegagalan biasa akan hilang sendiri, karantina **tidak akan
  /// pernah** hilang tanpa seseorang menanganinya.
  IntColumn get quarantined => integer().withDefault(const Constant(0))();

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
