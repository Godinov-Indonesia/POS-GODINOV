import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/tables/shifts_table.dart';

/// Log pembatalan — butir 5, 6, 13, 15 ([11 §3.2] migrasi `000020`).
///
/// # Mengapa satu tabel untuk peristiwa yang belum jadi transaksi
///
/// Justru di sanalah kecurangan hidup: kasir memasukkan 10 item, pelanggan
/// membayar 10, kasir menurunkan menjadi 4 sebelum menekan Bayar, selisih 6
/// masuk kantong. Tanpa tabel ini peristiwa tersebut tidak meninggalkan jejak
/// **apa pun** di sistem — tidak ada transaksi, tidak ada stok bergerak, tidak
/// ada baris untuk diaudit.
///
/// Karena itu [scope] mencakup tiga tingkat, dan dua di antaranya
/// ([VoidScope.cartLine], [VoidScope.heldOrder]) membatalkan sesuatu yang belum
/// pernah menjadi baris `transactions`.
@DataClassName('LocalVoidLog')
class VoidLogs extends Table {
  /// UUID v4 dibuat KLIEN ([11 §1] aturan R2).
  TextColumn get id => text()();

  /// FK ditegakkan — shift selalu buatan perangkat ini sendiri.
  TextColumn get shiftId => text().references(Shifts, #id)();

  TextColumn get deviceId => text().withDefault(const Constant('legacy'))();

  TextColumn get staffId => text()();

  TextColumn get authorizedBy => text().nullable()();

  TextColumn get scope => textEnum<VoidScope>()();

  /// Hanya [VoidScope.transaction]. Tanpa FK — transaksi dapat berasal dari
  /// hasil pencarian Kode Struk, sama seperti `Returns.originalTransactionId`.
  TextColumn get transactionId => text().nullable()();

  /// Hanya [VoidScope.heldOrder]. **Lokal-only** — server tidak mengenal konsep
  /// pesanan tertahan ([03 §14]), sehingga id ini tidak pernah dapat divalidasi
  /// di sana.
  TextColumn get heldCartId => text().nullable()();

  /// Hanya [VoidScope.cartLine].
  TextColumn get productId => text().nullable()();

  IntColumn get quantityBefore => integer().withDefault(const Constant(0))();

  IntColumn get quantityAfter => integer().withDefault(const Constant(0))();

  /// **INTEGER SEN** — nilai rupiah yang lenyap dari keranjang.
  ///
  /// Inilah angka yang dijumlahkan laporan kecurangan pemilik: total nilai yang
  /// dibatalkan per kasir per shift.
  IntColumn get valueAmountMinor => integer()();

  /// Kamus beku [ReasonCodes.voidReasons].
  TextColumn get reasonCode => text()();

  TextColumn get reasonNotes => text().withDefault(const Constant(''))();

  /// Bukti struk pembatalan terbit (butir 6).
  BoolColumn get receiptPrinted =>
      boolean().withDefault(const Constant(false))();

  DateTimeColumn get receiptPrintedAt => dateTime().nullable()();

  /// Salinan item dalam JSON untuk scope `heldOrder`/`transaction`.
  ///
  /// Pesanan tertahan **tidak pernah ada di server**; tanpa snapshot ini, isi
  /// pesanan yang dibatalkan hilang selamanya dan audit hanya melihat sebuah
  /// nilai rupiah tanpa penjelasan.
  TextColumn get itemsSnapshotJson => text().nullable()();

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
