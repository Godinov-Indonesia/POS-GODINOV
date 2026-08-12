import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/tables/shifts_table.dart';

/// Transaksi penjualan — sumber kebenaran keuangan di perangkat ([02 §2.12]).
///
/// **Aturan yang tidak boleh dilanggar:**
///
/// - [id] adalah UUID v4 **buatan klien**, dibuat sekali saat transaksi lahir
///   dan **tidak pernah** diregenerasi saat pengiriman ulang. Inilah dasar
///   idempotensi backend ([03 §2.3]).
/// - Baris ditulis ke tabel ini **sebelum** perintah cetak dikirim. Printer mati
///   adalah masalah operasional, bukan alasan menghilangkan penjualan yang
///   uangnya sudah diterima ([09 §7.3]).
/// - Void dikirim sebagai baris dengan [id] **yang sama** berstatus `CANCELLED`;
///   server melakukan *reverse deduction* ([02 §2.12]).
/// - Baris **tidak pernah dihapus** setelah tersinkron — hanya ditandai
///   ([09 §6.3] aturan 4).
@DataClassName('LocalTransaction')
class Transactions extends Table {
  /// UUID v4 dibuat KLIEN.
  TextColumn get id => text()();

  /// Foreign key **ditegakkan** — berbeda dari relasi ke master data.
  ///
  /// Shift adalah data buatan perangkat ini sendiri, bukan data yang datang dan
  /// pergi lewat sync master. Backend juga memiliki FK yang sama dan memproses
  /// `Shifts → Transactions → Wastes` secara berurutan ([03 §2.3]), sehingga
  /// menegakkannya di sini menangkap kesalahan lebih awal.
  TextColumn get shiftId => text().references(Shifts, #id)();

  TextColumn get customerName => text().withDefault(const Constant(''))();

  /// **INTEGER SEN** (ADR-05). Tidak ada pajak maupun diskon di backend
  /// ([03 §14]), jadi ini sama dengan subtotal keranjang.
  IntColumn get totalAmountMinor => integer()();

  /// Kontrak beku ([09 §9.3]). Drift menyimpan `.name` (`cash`);
  /// `PaymentMethod.wireValue` (`CASH`) yang dikirim ke server.
  TextColumn get paymentMethod => textEnum<PaymentMethod>()();

  TextColumn get status => textEnum<TransactionStatus>()();

  /// Wajib diisi saat void, dikosongkan selain itu.
  TextColumn get cancelNotes => text().withDefault(const Constant(''))();

  /// Waktu transaksi menurut jam **perangkat**, UTC.
  ///
  /// Tidak pernah dikoreksi diam-diam walau *clock skew* terdeteksi — laporan
  /// pemilik justru difilter `created_at` sisi server ([05 §0.4]).
  DateTimeColumn get clientCreatedAt => dateTime()();

  // ── Metadata lokal — TIDAK PERNAH dikirim ke server ([09 §6.3] aturan 5) ────

  /// `false` = masih dalam antrean sync. Indeks `(synced, client_created_at)`
  /// membuat pembacaan antrean kronologis tetap murah ([09 §5.1]).
  BoolColumn get synced => boolean().withDefault(const Constant(false))();

  TextColumn get syncError => text().nullable()();

  IntColumn get syncAttempts => integer().withDefault(const Constant(0))();

  DateTimeColumn get lastSyncAttemptAt => dateTime().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
