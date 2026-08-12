import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';

/// Apa yang memicu sebuah upaya sinkronisasi ([09 §6.4]).
enum SyncTrigger {
  /// Setelah basis data terbuka — menangkap antrean sesi sebelumnya.
  startup,

  /// Koneksi kembali (dengan jeda 2 detik).
  online,

  /// Timer berkala saat aplikasi di depan.
  periodic,

  /// Aplikasi kembali dari latar.
  resumed,

  /// Tepat setelah sebuah transaksi tersimpan.
  transaction,

  /// Tutup shift — momen paling penting, laci sudah dihitung.
  shiftClose,

  /// Tombol di P-13. **Mengabaikan backoff.**
  manual,

  /// WorkManager, aplikasi boleh tertutup (M8).
  background,
}

/// Alasan sebuah upaya dilewati tanpa menyentuh jaringan.
enum SyncSkipReason { locked, backoff, offline, empty, notBound }

/// Isi satu batch yang dikirim ke server.
class SentBatch {
  const SentBatch({
    required this.shifts,
    required this.transactions,
    required this.wastes,
  });

  final List<LocalShift> shifts;
  final List<TransactionWithItems> transactions;
  final List<LocalWaste> wastes;

  bool get isEmpty =>
      shifts.isEmpty && transactions.isEmpty && wastes.isEmpty;

  int get totalRows => shifts.length + transactions.length + wastes.length;
}

/// Respons `POST /v1/pos/sync` ([03 §2.3]).
///
/// > ⚠️ **`200` tidak berarti semuanya berhasil.** Ini kontrak terpenting
/// > endpoint tersebut, dan sumber kegagalan produksi yang paling mungkin.
class SyncUpResponse extends Equatable {
  const SyncUpResponse({
    required this.shiftsSynced,
    required this.transactionsSynced,
    required this.wastesSynced,
    required this.failedTransactionIds,
  });

  factory SyncUpResponse.fromJson(Map<String, dynamic> json) => SyncUpResponse(
        shiftsSynced: (json['shifts_synced'] as num?)?.toInt() ?? 0,
        transactionsSynced:
            (json['transactions_synced'] as num?)?.toInt() ?? 0,
        wastesSynced: (json['wastes_synced'] as num?)?.toInt() ?? 0,
        // `failed_transactions` boleh `null`; normalisasinya wajib.
        failedTransactionIds: _stringList(json['failed_transactions']),
      );

  final int shiftsSynced;
  final int transactionsSynced;
  final int wastesSynced;

  /// **Satu-satunya entitas yang dilacak per-ID.** Shift dan waste yang gagal
  /// dilewati server secara diam-diam; selisih hitungan adalah satu-satunya
  /// petunjuk ([03 §2.3]).
  final List<String> failedTransactionIds;

  static List<String> _stringList(Object? raw) {
    if (raw is! List<dynamic>) return const <String>[];
    return raw.whereType<String>().toList(growable: false);
  }

  @override
  List<Object?> get props => <Object?>[
        shiftsSynced,
        transactionsSynced,
        wastesSynced,
        failedTransactionIds,
      ];
}

/// Hasil satu putaran sinkronisasi.
class SyncOutcome extends Equatable {
  const SyncOutcome({
    required this.ok,
    this.skipped,
    this.failedTransactionIds = const <String>[],
    this.shiftsSynced = 0,
    this.transactionsSynced = 0,
    this.wastesSynced = 0,
    this.shiftsSent = 0,
    this.wastesSent = 0,
    this.error,
  });

  const SyncOutcome.skip(SyncSkipReason reason)
      : ok = true,
        skipped = reason,
        failedTransactionIds = const <String>[],
        shiftsSynced = 0,
        transactionsSynced = 0,
        wastesSynced = 0,
        shiftsSent = 0,
        wastesSent = 0,
        error = null;

  const SyncOutcome.failure(String message)
      : ok = false,
        skipped = null,
        failedTransactionIds = const <String>[],
        shiftsSynced = 0,
        transactionsSynced = 0,
        wastesSynced = 0,
        shiftsSent = 0,
        wastesSent = 0,
        error = message;

  /// `true` hanya bila **seluruh** hitungan cocok dan tidak ada transaksi gagal.
  final bool ok;

  final SyncSkipReason? skipped;
  final List<String> failedTransactionIds;
  final int shiftsSynced;
  final int transactionsSynced;
  final int wastesSynced;
  final int shiftsSent;
  final int wastesSent;
  final String? error;

  bool get wasSkipped => skipped != null;

  /// Kegagalan shift hanya terungkap lewat selisih hitungan — tidak ada
  /// `failed_shifts` di respons ([03 §2.3]).
  bool get hasShiftMismatch => shiftsSynced != shiftsSent;

  bool get hasWasteMismatch => wastesSynced != wastesSent;

  /// Layak dicoba ulang oleh WorkManager (M8).
  bool get shouldRetry => !ok;

  /// Menggabungkan hasil beberapa batch dalam satu putaran.
  SyncOutcome merge(SyncOutcome other) => SyncOutcome(
        ok: ok && other.ok,
        failedTransactionIds: <String>[
          ...failedTransactionIds,
          ...other.failedTransactionIds,
        ],
        shiftsSynced: shiftsSynced + other.shiftsSynced,
        transactionsSynced: transactionsSynced + other.transactionsSynced,
        wastesSynced: wastesSynced + other.wastesSynced,
        shiftsSent: shiftsSent + other.shiftsSent,
        wastesSent: wastesSent + other.wastesSent,
        error: error ?? other.error,
      );

  @override
  List<Object?> get props => <Object?>[
        ok,
        skipped,
        failedTransactionIds,
        shiftsSynced,
        transactionsSynced,
        wastesSynced,
        shiftsSent,
        wastesSent,
        error,
      ];
}
