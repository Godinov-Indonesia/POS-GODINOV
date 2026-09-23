/// Konstanta lintas lapisan yang terikat kontrak backend.
///
/// Berkas ini adalah **prasyarat M1** yang ditarik maju ke M2 karena tabel Drift
/// memakai `textEnum<PaymentMethod>()` dan `textEnum<TransactionStatus>()`.
library;

/// ⚠️ **KONTRAK BEKU** — WAJIB identik huruf demi huruf dengan
/// `posgodinov-fe/lib/constants/payment.ts` ([05 §3.3] / [09 §9.3]).
///
/// `transactions.payment_method` adalah `VARCHAR(50)` bebas tanpa enum database
/// ([02 §2.12]) — backend menerima **string apa pun**. Salah ketik satu kali
/// memecah pengelompokan laporan **secara permanen**; tidak ada endpoint untuk
/// memperbaiki data lama.
///
/// Mengubah, mengganti nama, atau menghapus salah satu nilai SETELAH produksi
/// berjalan akan merusak seluruh laporan historis. Penambahan nilai baru harus
/// disepakati lintas tim (Web, Flutter, Backend, Analitik) sebelum dirilis.
///
/// Terakhir disepakati: [ISI TANGGAL] — [ISI NAMA PENYETUJU]
///
/// > Drift menyimpan `.name` (mis. `cash`) di basis data lokal, sedangkan
/// > [wireValue] (`CASH`) adalah yang dikirim ke server. Konversi terjadi di
/// > `core/sync/wire_mapper.dart` ([09 §6.2]).
enum PaymentMethod {
  cash('CASH', 'Tunai'),
  qris('QRIS', 'QRIS'),
  debit('DEBIT', 'Kartu Debit'),
  transfer('TRANSFER', 'Transfer Bank');

  const PaymentMethod(this.wireValue, this.label);

  /// Nilai yang masuk ke kolom `payment_method` di server.
  final String wireValue;

  /// Label yang dibaca kasir.
  final String label;

  /// Mengurai nilai kawat menjadi enum. Melempar bila tidak dikenal — lebih baik
  /// gagal keras daripada mencemari laporan dengan nilai liar.
  static PaymentMethod fromWire(String value) => PaymentMethod.values.firstWhere(
        (PaymentMethod m) => m.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Metode pembayaran tidak dikenal',
        ),
      );
}

/// Hanya `CASH` yang memengaruhi `expected_balance` saat tutup shift
/// ([04 §A.3] / [09 §7.4]).
const Set<PaymentMethod> cashMethods = <PaymentMethod>{PaymentMethod.cash};

/// `transactions.status` — `COMPLETED` memotong stok via BOM di server,
/// `VOIDED`/`CANCELLED` memicu *reverse deduction* ([02 §2.12], [03 §2.3]).
///
/// ## v2 — `cancelled` adalah nilai WARISAN
///
/// Baris baru memakai [voided] ([11 §2.1]). [cancelled] sengaja dipertahankan:
/// perangkat lapangan yang mati dua minggu akan kembali membawa antrean berisi
/// nilai lama, dan menolaknya berarti membuang pembatalan yang benar-benar
/// terjadi. Keduanya lolos `CHECK ck_txn_status` selama jendela deprekasi
/// ([11 §M18.4]).
///
/// Kode yang memeriksa "apakah transaksi ini batal" WAJIB memakai
/// [isCancellation], bukan `== TransactionStatus.cancelled`.
enum TransactionStatus {
  completed('COMPLETED'),
  voided('VOIDED'),
  cancelled('CANCELLED');

  const TransactionStatus(this.wireValue);

  final String wireValue;

  /// `true` untuk [voided] **dan** [cancelled].
  ///
  /// Melewatkan salah satunya berarti transaksi yang dibatalkan ikut terhitung
  /// sebagai penjualan — selisih kas yang harus dipertanggungjawabkan kasir di
  /// akhir shift ([11 §2.4]).
  bool get isCancellation =>
      this == TransactionStatus.voided || this == TransactionStatus.cancelled;

  static TransactionStatus fromWire(String value) =>
      TransactionStatus.values.firstWhere(
        (TransactionStatus s) => s.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Status transaksi tidak dikenal',
        ),
      );
}

/// `shifts.status` — `OPEN` | `CLOSED` ([02 §2.11]).
enum ShiftStatus {
  open('OPEN'),
  closed('CLOSED');

  const ShiftStatus(this.wireValue);

  final String wireValue;

  static ShiftStatus fromWire(String value) => ShiftStatus.values.firstWhere(
        (ShiftStatus s) => s.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Status shift tidak dikenal',
        ),
      );
}

/* ══════════════════════════ v2 — Fase M11.5 ════════════════════════════════
 *
 * TIGA DAFTAR METODE PEMBAYARAN, BUKAN SATU
 *
 * v1 memakai [PaymentMethod] untuk tiga peran sekaligus: nilai sah di kolom
 * server, nilai yang dirender pemilih metode, dan nilai yang muncul di laporan.
 * Multi-tender ([11 §3.2]) memisahkan ketiganya karena `SPLIT` **bukan** cara
 * membayar — ia adalah ringkasan atas dua tender atau lebih.
 *
 * | Enum                   | Peran                                            |
 * |------------------------|--------------------------------------------------|
 * | [PaymentMethod]        | Dirender `PaymentMethodPicker` — **tetap 4 nilai**|
 * | [TenderMethod]         | Sah di `transaction_payments.method`             |
 * | [PaymentSummary]       | Sah di `transactions.payment_method`             |
 *
 * ⚠️ [PaymentMethod] sengaja **tetap 4 nilai**, juga setelah M17.2.
 *
 * Sejak M17.2, pemilih metode (`payment_method_page.dart`) merender dari
 * [TenderMethod] — yang memuat `credit` — bukan dari `PaymentMethod.values`.
 * [PaymentMethod] karena itu tidak perlu tumbuh, dan TIDAK BOLEH: uji kontrak
 * lintas platform (`test/contract/payment_methods_test.dart`) menguncinya
 * terhadap `PAYMENT_METHODS` di Web, dan keduanya harus bergerak bersama-sama
 * dalam satu kesepakatan lintas tim — bukan diam-diam dari satu sisi.
 *
 * Perannya kini menyempit menjadi jembatan v1: ia masih dipakai jalur
 * pembayaran metode-tunggal dan `CashLine` pada aritmetika shift.
 * ═══════════════════════════════════════════════════════════════════════════ */

/// Nilai sah untuk **satu baris tender** (`transaction_payments.method`).
///
/// `credit` dipisah dari `debit` karena keduanya memiliki jalur settlement dan
/// biaya MDR yang berbeda; menggabungkannya membuat rekonsiliasi EDC saat Blind
/// Closing ([11 §M15.3]) tidak dapat dipisahkan lagi setelah datanya tertulis.
enum TenderMethod {
  cash('CASH', 'Tunai'),
  qris('QRIS', 'QRIS'),
  debit('DEBIT', 'Kartu Debit'),
  credit('CREDIT', 'Kartu Kredit'),
  transfer('TRANSFER', 'Transfer Bank');

  const TenderMethod(this.wireValue, this.label);

  final String wireValue;
  final String label;

  /// Wajib membawa `traceNumber` + `cardLast4` (butir 8).
  ///
  /// Cerminan `CHECK ck_card_requires_trace` di PostgreSQL ([11 §3.2]).
  bool get requiresCardDetails =>
      this == TenderMethod.debit || this == TenderMethod.credit;

  static TenderMethod fromWire(String value) => TenderMethod.values.firstWhere(
        (TenderMethod m) => m.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Metode tender tidak dikenal',
        ),
      );

  /// Jembatan dari enum v1 — setiap [PaymentMethod] adalah [TenderMethod] yang sah.
  static TenderMethod fromPaymentMethod(PaymentMethod m) =>
      TenderMethod.fromWire(m.wireValue);
}

/// Nilai sah untuk **ringkasan** di `transactions.payment_method`.
///
/// Kolom `Transactions.paymentMethod` bertipe enum ini **sejak M17.2**
/// ([11 §M17.2]) — sebelumnya [PaymentMethod], yang tidak memiliki `split`.
///
/// `split` BUKAN cara membayar melainkan RINGKASAN atas dua tender atau lebih.
/// Ia tidak pernah muncul sebagai pilihan di layar mana pun; yang menuliskannya
/// adalah repositori, setelah menghitung berapa tender yang benar-benar lahir.
///
/// Nama enum `cash`/`qris`/`debit`/`transfer` sengaja identik dengan
/// [PaymentMethod]: Drift menyimpan `textEnum` sebagai NAMA anggota, sehingga
/// baris yang sudah tertulis sebelum M17.2 tetap terbaca tanpa migrasi data.
enum PaymentSummary {
  cash('CASH', 'Tunai'),
  qris('QRIS', 'QRIS'),
  debit('DEBIT', 'Kartu Debit'),
  credit('CREDIT', 'Kartu Kredit'),
  transfer('TRANSFER', 'Transfer Bank'),
  split('SPLIT', 'Bayar Terpisah');

  const PaymentSummary(this.wireValue, this.label);

  final String wireValue;

  /// Label yang dibaca kasir.
  final String label;

  /// `true` bila ringkasan ini menghasilkan uang di laci.
  ///
  /// `split` menghasilkan `false`: nominal tunai di dalamnya diketahui dari
  /// baris tender, bukan dari ringkasannya. Memperlakukan seluruh nilai
  /// transaksi split sebagai kas akan membuat laci tampak berisi uang yang
  /// sebagian tergesek di EDC.
  bool get isCash => this == PaymentSummary.cash;

  static PaymentSummary fromWire(String value) =>
      PaymentSummary.values.firstWhere(
        (PaymentSummary m) => m.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Ringkasan pembayaran tidak dikenal',
        ),
      );

  /// Jembatan dari enum pemilih metode.
  static PaymentSummary fromPaymentMethod(PaymentMethod m) =>
      PaymentSummary.fromWire(m.wireValue);

  /// Jembatan dari satu baris tender.
  static PaymentSummary fromTender(TenderMethod m) =>
      PaymentSummary.fromWire(m.wireValue);
}

/// Apa yang dibatalkan ([11 §3.2] `void_logs.scope`).
///
/// [cartLine] dan [heldOrder] membatalkan sesuatu yang **belum menjadi
/// transaksi** — itulah alasan `void_logs` harus berdiri sebagai tabel sendiri
/// dan tidak dapat direduksi menjadi kolom di `transactions`.
enum VoidScope {
  cartLine('CART_LINE'),
  heldOrder('HELD_ORDER'),
  transaction('TRANSACTION');

  const VoidScope(this.wireValue);

  final String wireValue;

  static VoidScope fromWire(String value) => VoidScope.values.firstWhere(
        (VoidScope s) => s.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Cakupan void tidak dikenal',
        ),
      );
}

/// Cakupan retur (`returns.return_type`).
enum ReturnKind {
  full('FULL'),
  partial('PARTIAL');

  const ReturnKind(this.wireValue);

  final String wireValue;

  static ReturnKind fromWire(String value) => ReturnKind.values.firstWhere(
        (ReturnKind k) => k.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Jenis retur tidak dikenal',
        ),
      );
}

/// Arah uang kembali (`returns.refund_method`).
enum RefundMethod {
  cash('CASH', 'Tunai'),
  cardReversal('CARD_REVERSAL', 'Pembatalan Kartu'),
  qrisReversal('QRIS_REVERSAL', 'Pembatalan QRIS'),
  exchange('EXCHANGE', 'Tukar Barang'),
  storeCredit('STORE_CREDIT', 'Kredit Toko');

  const RefundMethod(this.wireValue, this.label);

  final String wireValue;
  final String label;

  /// `true` bila uang benar-benar keluar dari laci.
  ///
  /// [exchange] menukar barang tanpa uang berpindah sama sekali; memasukkannya
  /// ke hitungan kas akan membuat laci tampak kekurangan sebesar nilai tukar.
  bool get movesCash => this == RefundMethod.cash;

  static RefundMethod fromWire(String value) => RefundMethod.values.firstWhere(
        (RefundMethod m) => m.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Metode refund tidak dikenal',
        ),
      );
}

/// Agregat retur atas sebuah transaksi. **Dihitung server**, bukan klien.
enum ReturnState {
  none('NONE'),
  partial('PARTIAL'),
  full('FULL');

  const ReturnState(this.wireValue);

  final String wireValue;

  static ReturnState fromWire(String value) => ReturnState.values.firstWhere(
        (ReturnState s) => s.wireValue == value,
        orElse: () => throw ArgumentError.value(
          value,
          'value',
          'Status retur tidak dikenal',
        ),
      );
}

/// Bobot peristiwa audit (`pos_security_events.severity`).
enum SecuritySeverity {
  info('INFO'),
  warn('WARN'),
  critical('CRITICAL');

  const SecuritySeverity(this.wireValue);

  final String wireValue;
}

/// Jenis dokumen pada antrean cetak ([11 §3.8]).
enum PrintJobKind {
  saleReceipt('SALE_RECEIPT'),
  cancelReceipt('CANCEL_RECEIPT'),
  returnReceipt('RETURN_RECEIPT'),
  wasteReceipt('WASTE_RECEIPT'),
  shiftReport('SHIFT_REPORT');

  const PrintJobKind(this.wireValue);

  final String wireValue;
}

/// ```
/// PENDING → PRINTING → PRINTED
///                    ↘ FAILED → (retry ≤ 3) → PENDING
///                             ↘ ABANDONED (butuh tindakan manual)
/// ```
enum PrintJobStatus {
  pending('PENDING'),
  printing('PRINTING'),
  printed('PRINTED'),
  failed('FAILED'),
  abandoned('ABANDONED');

  const PrintJobStatus(this.wireValue);

  final String wireValue;
}

/// Kamus `event_type` untuk `pos_security_events` ([11 §3.3]).
///
/// Sengaja `String` dan bukan `enum`: peristiwa baru akan bermunculan sepanjang
/// umur produk, dan perangkat lama harus tetap dapat mengirim jenis yang belum
/// dikenalnya tanpa gagal mengurai.
abstract final class SecurityEventType {
  static const String kioskExitGranted = 'KIOSK_EXIT_GRANTED';
  static const String kioskExitDenied = 'KIOSK_EXIT_DENIED';

  /// Tiga kegagalan berturut menjatuhkan jeda 60 detik ([11 §M17.4]).
  ///
  /// Dipisah dari [kioskExitDenied] karena maknanya berbeda bagi pemilik: satu
  /// penolakan adalah salah ketik, tiga berturut adalah pola.
  static const String kioskExitLockedOut = 'KIOSK_EXIT_LOCKED_OUT';
  static const String logoutBlockedActiveShift = 'LOGOUT_BLOCKED_ACTIVE_SHIFT';
  static const String staffSwitchBlocked = 'STAFF_SWITCH_BLOCKED';
  static const String openShiftBlockedStaleMaster =
      'OPEN_SHIFT_BLOCKED_STALE_MASTER';
  static const String qtyDecreaseEscalatedToVoid =
      'QTY_DECREASE_ESCALATED_TO_VOID';
  static const String voidReceiptPrintFailed = 'VOID_RECEIPT_PRINT_FAILED';
  static const String wasteReceiptPrintFailed = 'WASTE_RECEIPT_PRINT_FAILED';
  static const String returnReceiptPrintFailed = 'RETURN_RECEIPT_PRINT_FAILED';
  static const String saleReceiptPrintFailed = 'SALE_RECEIPT_PRINT_FAILED';
  static const String receiptReprinted = 'RECEIPT_REPRINTED';

  /// Supervisor menutup paksa shift orang lain ([11 §M15.2]) — selalu CRITICAL.
  static const String shiftForceClosed = 'SHIFT_FORCE_CLOSED';

  static const String voidAfterPrintAttempted = 'VOID_AFTER_PRINT_ATTEMPTED';
  static const String pinFailedThreshold = 'PIN_FAILED_THRESHOLD';
  static const String clockSkewDetected = 'CLOCK_SKEW_DETECTED';
}

/// Kamus `reason_code` — **kontrak beku lintas platform** ([11 §3.5]).
///
/// `OTHER` wajib disertai catatan minimal 10 karakter. Tanpa aturan itu seluruh
/// kamus runtuh menjadi `OTHER` dalam dua minggu dan laporan kecurangan
/// kehilangan seluruh dayanya.
abstract final class ReasonCodes {
  static const List<String> voidReasons = <String>[
    'CUSTOMER_CANCEL',
    'WRONG_ITEM',
    'WRONG_QTY',
    'PRICE_DISPUTE',
    'TRAINING',
    'SYSTEM_ERROR',
    'DUPLICATE_ENTRY',
    'OTHER',
  ];

  static const List<String> returnReasons = <String>[
    'DEFECTIVE',
    'WRONG_ITEM_DELIVERED',
    'CUSTOMER_CHANGED_MIND',
    'EXPIRED',
    'SIZE_EXCHANGE',
    'OTHER',
  ];

  static const List<String> wasteReasons = <String>[
    'EXPIRED',
    'SPOILED',
    'BROKEN',
    'SPILLED',
    'STAFF_MEAL',
    'SAMPLE_TASTING',
    'PRODUCTION_ERROR',
    'OTHER',
  ];

  static const String other = 'OTHER';

  /// Panjang minimum catatan bila `reason_code == OTHER`.
  static const int otherNotesMinLength = 10;
}

/// Ambang batas operasional yang dirujuk beberapa lapisan sekaligus.
abstract final class SyncLimits {
  /// Batas ukuran payload `POST /v1/pos/sync` — server tidak berpaginasi
  /// ([09 §6.1]).
  static const int maxTransactionsPerBatch = 200;

  /// Master data ditarik ulang bila snapshot lebih tua dari ini ([04 §A.2]).
  static const Duration masterDataMaxAge = Duration(hours: 12);

  /// Selisih jam perangkat vs header `Date` server yang memicu peringatan
  /// ([05 §1.8.2]).
  static const Duration clockSkewThreshold = Duration(minutes: 5);

  /// Penurunan kuantitas melebihi angka ini **wajib** lewat alur Void (butir 5).
  ///
  /// Nilai bawaan; sumber sesungguhnya adalah `config.void_threshold_qty` dari
  /// master data ([11 §4.4]) agar pemilik dapat mengubahnya tanpa merilis ulang
  /// aplikasi. Dipakai hanya bila perangkat belum pernah menarik master v2.
  static const int voidThresholdQty = 5;
}

/// Kunci baris pada tabel `sync_meta` (penyimpanan kunci–nilai).
abstract final class SyncMetaKeys {
  static const String backoffUntil = 'backoff_until';
  static const String consecutiveFailures = 'consecutive_failures';
  static const String masterDataSyncedAt = 'master_data_synced_at';
  static const String outletName = 'outlet_name';
  static const String clockSkewMs = 'clock_skew_ms';

  /* ── v2 ──────────────────────────────────────────────────────────────── */

  /// Identitas instalasi, dibuat sekali saat binding — dasar butir 12.
  static const String deviceId = 'device_id';

  /// Versi master data yang sedang dipegang perangkat (butir 10).
  static const String masterDataVersion = 'master_data_version';

  /// Versi master data TERKINI menurut server, dari respons sync terakhir.
  ///
  /// Dibandingkan dengan [masterDataVersion] oleh gerbang Buka Shift. Disimpan
  /// terpisah supaya perbandingannya tidak memerlukan permintaan jaringan
  /// tersendiri setiap kali kasir membuka shift ([11 §M15.1]).
  static const String masterDataServerVersion = 'master_data_server_version';

  /// Blok `config` dari master-data ([11 §4.4]), disimpan sebagai JSON.
  static const String remoteConfig = 'remote_config';
}
