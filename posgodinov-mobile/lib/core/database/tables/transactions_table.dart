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
/// ── BUTIR 16 — riwayat terisolasi per shift ([11 §M17.3]) ─────────────────
///
/// Indeks komposit `(shift_id, client_created_at)` dipakai layar Riwayat, yang
/// SELALU memfilter shift berjalan lalu mengurutkan terbaru-dulu. Tanpa indeks
/// ini, pengurutan terjadi setelah seluruh baris shift ditarik ke memori —
/// terasa pada setiap pembukaan layar di shift dengan ratusan transaksi.
///
/// `shortCode` diindeks terpisah: pencarian struk lampau menembaknya secara
/// eksak, dan tanpa indeks itu berubah menjadi pemindaian tabel penuh.
@TableIndex(name: 'idx_txn_shift_created', columns: <String>{#shiftId, #clientCreatedAt})
@TableIndex(name: 'idx_txn_short_code', columns: <String>{#shortCode})
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
  /// Ringkasan pembayaran — [PaymentSummary] sejak M17.2 ([11 §M17.2]).
  ///
  /// Sebelumnya [PaymentMethod], yang tidak memiliki `split`. Rincian
  /// sesungguhnya hidup di `transaction_payments`; kolom ini adalah ringkasan
  /// v1-compat yang dipertahankan agar laporan pemilik yang sudah ada tetap
  /// hidup.
  ///
  /// Tanpa migrasi data: Drift menyimpan `textEnum` sebagai NAMA anggota, dan
  /// `cash`/`qris`/`debit`/`transfer` bernama identik di kedua enum.
  TextColumn get paymentMethod => textEnum<PaymentSummary>()();

  TextColumn get status => textEnum<TransactionStatus>()();

  /// Wajib diisi saat void, dikosongkan selain itu.
  TextColumn get cancelNotes => text().withDefault(const Constant(''))();

  /// Waktu transaksi menurut jam **perangkat**, UTC.
  ///
  /// Tidak pernah dikoreksi diam-diam walau *clock skew* terdeteksi — laporan
  /// pemilik justru difilter `created_at` sisi server ([05 §0.4]).
  DateTimeColumn get clientCreatedAt => dateTime()();

  // ── v2 — Fase M11.5 ([11 §3.2] migrasi 000017 & 000018) ───────────────────

  /// **DISKRIMINATOR VOID vs RETUR** (butir 15, [11 §2.1]).
  ///
  /// `null` = struk belum pernah terbit → wilayah VOID.
  /// Terisi = dokumen sudah berpindah ke pelanggan → wilayah RETUR.
  ///
  /// Ditulis saat `print_jobs` bertipe `SALE_RECEIPT` mencapai
  /// `PrintJobStatus.printed`, **bukan** saat perintah cetak dikirim: perintah
  /// yang gagal di tengah tidak menghasilkan kertas di tangan siapa pun.
  ///
  /// Migrasi v1→v2 mengisinya dengan `client_created_at` untuk seluruh baris
  /// lama — struk v1 selalu dicetak saat commit, jadi setiap transaksi lama
  /// memang sudah berpindah tangan sebagai kertas. Membiarkannya kosong akan
  /// membuka jalur VOID untuk seluruh transaksi lampau, persis lubang yang
  /// butir 15 dibangun untuk menutupnya.
  DateTimeColumn get receiptPrintedAt => dateTime().nullable()();

  /// Berapa kali struk dicetak ulang. Setiap kenaikan menulis peristiwa audit
  /// `RECEIPT_REPRINTED` ([11 §3.3]).
  IntColumn get reprintCount => integer().withDefault(const Constant(0))();

  /// Kode struk yang dapat **diketik manusia**, mis. `AB1234-250820-K7QF`.
  ///
  /// Satu-satunya jalan menuju transaksi lampau setelah riwayat dibatasi ke
  /// shift aktif (butir 16). Tidak dideklarasikan `unique` di sini: tabrakan
  /// diselesaikan server dengan `409` lalu klien membuat ulang suffix
  /// ([11 §3.2]); indeks unik lokal akan melempar di depan kasir yang sedang
  /// melayani.
  TextColumn get shortCode => text().nullable()();

  /// Agregat retur — **dihitung server**. Nilai lokal hanya untuk tampilan.
  ///
  /// `null` berarti **server belum memberi tahu**, bukan klaim sepihak bahwa
  /// transaksi ini belum pernah diretur. Pembacanya memperlakukan `null`
  /// setara [ReturnState.none] sampai sinkronisasi berikutnya mengisinya.
  TextColumn get returnState => textEnum<ReturnState>().nullable()();

  /// Identitas instalasi tempat transaksi lahir (butir 12).
  TextColumn get deviceId => text().withDefault(const Constant('legacy'))();

  DateTimeColumn get voidedAt => dateTime().nullable()();

  TextColumn get voidedBy => text().nullable()();

  /// Kamus beku [ReasonCodes.voidReasons].
  TextColumn get voidReasonCode => text().nullable()();

  // ── Metadata lokal — TIDAK PERNAH dikirim ke server ([09 §6.3] aturan 5) ────

  /// `false` = masih dalam antrean sync. Indeks `(synced, client_created_at)`
  /// membuat pembacaan antrean kronologis tetap murah ([09 §5.1]).
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
