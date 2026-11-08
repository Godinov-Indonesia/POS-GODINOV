import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/tables/transactions_table.dart';

/// Rincian pembayaran satu transaksi — **multi-tender**, butir 8
/// ([11 §3.2] migrasi `000017`).
///
/// # Mengapa tabel, bukan kolom di [Transactions]
///
/// Butir 8 mewajibkan **Nominal Gesek** dicatat terpisah. Nominal gesek yang
/// dapat berbeda dari total transaksi hanya punya satu arti: pelanggan membayar
/// sebagian tunai dan sebagian kartu. Satu kolom `trace_number` di induk tidak
/// dapat menampung dua kartu pada satu struk, dan tidak dapat menyatakan berapa
/// dari total yang benar-benar digesek.
///
/// # Invarian yang tidak boleh dilanggar
///
/// `Σ amountMinor == transactions.totalAmountMinor`. Server menolak
/// ketidakcocokan dengan `422 TENDER_MISMATCH` dan baris masuk karantina
/// ([11 §3.4]); `WireMapper` memeriksanya sebelum payload meninggalkan
/// perangkat agar kegagalan muncul di tempat, bukan berjam-jam kemudian.
///
/// # Larangan keras
///
/// ⛔ **Dilarang** menambahkan kolom untuk nomor kartu penuh (PAN), CVV, PIN
/// kartu, atau data magstripe ([11 §1] aturan R8). Menyimpannya memindahkan
/// seluruh sistem ke ruang lingkup PCI-DSS penuh. Hanya empat digit terakhir
/// dan *trace number* yang boleh hidup di sini.
@DataClassName('LocalTransactionPayment')
class TransactionPayments extends Table {
  /// UUID v4 dibuat KLIEN, tidak pernah diregenerasi ([11 §1] aturan R2).
  TextColumn get id => text()();

  /// FK **ditegakkan** — tender tanpa transaksi induk tidak memiliki arti, dan
  /// keduanya selalu lahir bersama di perangkat yang sama.
  TextColumn get transactionId => text().references(Transactions, #id)();

  /// Urutan tender dalam satu transaksi, mulai dari 1.
  IntColumn get sequence => integer().withDefault(const Constant(1))();

  /// Kontrak beku ([11 §3.5]). Drift menyimpan `.name` (`credit`);
  /// [TenderMethod.wireValue] (`CREDIT`) yang dikirim ke server.
  TextColumn get method => textEnum<TenderMethod>()();

  /// **INTEGER SEN** — nominal gesek untuk kartu, bukan total transaksi.
  IntColumn get amountMinor => integer()();

  /// WAJIB untuk `debit`/`credit` — cerminan `CHECK ck_card_requires_trace`.
  ///
  /// SQLite tidak memiliki `CHECK` lintas kolom yang setara, sehingga
  /// penegakannya ada di `WireMapper.assertTenderIntegrity` dan di PostgreSQL.
  TextColumn get traceNumber => text().nullable()();

  /// WAJIB untuk `debit`/`credit`. **Tepat 4 digit** — tidak pernah lebih.
  TextColumn get cardLast4 => text().withLength(min: 4, max: 4).nullable()();

  TextColumn get cardNetwork => text().nullable()();

  TextColumn get approvalCode => text().nullable()();

  TextColumn get edcTerminalId => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => <Column<Object>>{id};
}
