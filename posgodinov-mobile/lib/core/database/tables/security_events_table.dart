import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Audit keamanan sisi perangkat — butir 9, 12, 14 ([11 §3.2] migrasi `000023`).
///
/// # Mengapa tidak cukup mengandalkan `audit_logs` backend
///
/// `audit_logs` di server hanya menangkap **permintaan HTTP**. Kecurangan di POS
/// terjadi justru ketika perangkat offline — kasir yang gagal keluar mode Kiosk,
/// yang mencoba logout dengan shift terbuka, atau yang menurunkan kuantitas
/// besar-besaran — dan tidak ada satu pun permintaan HTTP yang lahir dari
/// peristiwa itu.
///
/// Tabel ini adalah kanal audit yang **ikut antre sync**, sehingga jejaknya
/// tetap tiba meski terlambat berjam-jam ([11 §1] aturan R9).
@DataClassName('LocalSecurityEvent')
class SecurityEvents extends Table {
  /// UUID v4 dibuat KLIEN ([11 §1] aturan R2).
  TextColumn get id => text()();

  /// Nullable: peristiwa dapat terjadi sebelum shift mana pun dibuka — mis.
  /// kegagalan PIN berulang di layar login. Sengaja **tanpa** FK agar peristiwa
  /// keamanan tidak pernah gagal tersimpan karena alasan referensial.
  TextColumn get shiftId => text().nullable()();

  TextColumn get staffId => text().nullable()();

  TextColumn get deviceId => text().withDefault(const Constant('legacy'))();

  /// Kamus [SecurityEventType]. Sengaja `String` dan bukan enum: perangkat lama
  /// harus tetap dapat mengirim jenis peristiwa yang belum dikenalnya.
  TextColumn get eventType => text()();

  TextColumn get severity => textEnum<SecuritySeverity>()();

  /// Konteks tambahan dalam JSON, mis. `{"attempts": 3}`.
  ///
  /// ⛔ **Dilarang** memuat PIN, hash PIN, atau data kartu ([11 §1] aturan R8).
  TextColumn get detailsJson => text().withDefault(const Constant('{}'))();

  DateTimeColumn get clientCreatedAt => dateTime()();

  // ── Metadata lokal — TIDAK PERNAH dikirim ke server ────────────────────────

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
