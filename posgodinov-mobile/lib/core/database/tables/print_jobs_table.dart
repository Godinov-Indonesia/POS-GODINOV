import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Antrean cetak — butir 6 & 7 ([11 §3.8]).
///
/// > **Murni lokal. TIDAK PERNAH dikirim ke server.** Antrean cetak adalah
/// > urusan perangkat dan printernya. Karena itu tabel ini **tidak memiliki**
/// > kolom `synced` sama sekali — kehadirannya akan menggoda seseorang
/// > memasukkannya ke antrean sync, persis seperti alasan yang sama pada
/// > `HeldCarts`.
///
/// # Aturan induk ([11 §1] aturan R6)
///
/// Kegagalan cetak **tidak pernah** membatalkan penulisan basis data. Uang sudah
/// berpindah; printer mati adalah masalah operasional, bukan alasan
/// menghilangkan penjualan atau pembatalan yang sudah terjadi. Job yang gagal
/// menyisakan baris berstatus [PrintJobStatus.failed] dan memunculkan banner
/// persisten, bukan menggagalkan transaksinya.
@DataClassName('LocalPrintJob')
class PrintJobs extends Table {
  /// UUID v4 dibuat KLIEN.
  TextColumn get id => text()();

  TextColumn get kind => textEnum<PrintJobKind>()();

  TextColumn get status => textEnum<PrintJobStatus>()();

  /// `transaction` | `return` | `void_log` | `waste` | `shift`.
  TextColumn get refType => text()();

  TextColumn get refId => text()();

  /// Byte ESC/POS yang **sudah dirender**, disimpan base64.
  ///
  /// Dirender **sekali** agar cetak ulang menghasilkan kertas yang identik,
  /// bukan hasil render ulang dari data yang mungkin sudah berubah. Struk
  /// pembatalan yang isinya berbeda dari yang pertama tidak dapat dipakai
  /// sebagai bukti audit.
  TextColumn get payloadBase64 => text()();

  IntColumn get attempts => integer().withDefault(const Constant(0))();

  TextColumn get lastError => text().nullable()();

  /// Kapan percobaan kirim TERAKHIR terjadi — dasar jeda mundur ([11 §M14.1]).
  ///
  /// `null` berarti belum pernah dicoba, sehingga jobnya jatuh tempo sekarang
  /// juga.
  ///
  /// Ikut migrasi v2 lewat `createTable`, BUKAN migrasi v3 — v2 belum pernah
  /// dirilis ke perangkat mana pun, dan alasannya sama persis dengan catatan
  /// pada kolom karantina di `app_database.dart`.
  DateTimeColumn get lastAttemptAt => dateTime().nullable()();

  DateTimeColumn get createdAt => dateTime()();

  DateTimeColumn get printedAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
