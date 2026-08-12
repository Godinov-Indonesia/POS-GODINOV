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
/// `CANCELLED` memicu *reverse deduction* ([02 §2.12], [03 §2.3]).
enum TransactionStatus {
  completed('COMPLETED'),
  cancelled('CANCELLED');

  const TransactionStatus(this.wireValue);

  final String wireValue;

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
}

/// Kunci baris pada tabel `sync_meta` (penyimpanan kunci–nilai).
abstract final class SyncMetaKeys {
  static const String backoffUntil = 'backoff_until';
  static const String consecutiveFailures = 'consecutive_failures';
  static const String masterDataSyncedAt = 'master_data_synced_at';
  static const String outletName = 'outlet_name';
  static const String clockSkewMs = 'clock_skew_ms';
}
