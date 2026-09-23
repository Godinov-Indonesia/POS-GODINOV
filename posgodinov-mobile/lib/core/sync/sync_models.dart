import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/return_dao.dart';
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

  /// Tepat setelah sebuah transaksi tersimpan — **melewati debounce 1,5 detik**
  /// agar sepuluh struk beruntun menjadi satu batch ([11 §M12.2]).
  transactionCommit,

  /// Debounce yang sama, tetapi pemicunya sebuah pembatalan.
  ///
  /// Dibedakan dari [transactionCommit] semata agar `syncLog` dapat menjawab
  /// pertanyaan audit tanpa menebak; jalurnya identik.
  voidCommit,

  /// Debounce yang sama, tetapi pemicunya sebuah retur.
  returnCommit,

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
    this.returns = const <ReturnWithItems>[],
    this.voidLogs = const <LocalVoidLog>[],
    this.securityEvents = const <LocalSecurityEvent>[],
  });

  final List<LocalShift> shifts;
  final List<TransactionWithItems> transactions;
  final List<LocalWaste> wastes;

  /// Koleksi v2 ([11 §4.2]). Bawaannya kosong agar pemanggil lama — termasuk
  /// uji yang hanya peduli jalur transaksi — tetap terkompilasi apa adanya.
  final List<ReturnWithItems> returns;
  final List<LocalVoidLog> voidLogs;
  final List<LocalSecurityEvent> securityEvents;

  bool get isEmpty =>
      shifts.isEmpty &&
      transactions.isEmpty &&
      wastes.isEmpty &&
      returns.isEmpty &&
      voidLogs.isEmpty &&
      securityEvents.isEmpty;

  int get totalRows =>
      shifts.length +
      transactions.length +
      wastes.length +
      returns.length +
      voidLogs.length +
      securityEvents.length;
}

/// Satu galat per-entitas pada respons v2 ([11 §4.3]).
///
/// `retryable` adalah satu-satunya field yang menentukan nasib baris:
/// `false` memindahkannya ke KARANTINA. Kode dan pesan dipakai untuk
/// memberi tahu kasir APA yang harus dilaporkan ke supervisor.
class SyncEntityError extends Equatable {
  const SyncEntityError({
    required this.entity,
    required this.id,
    required this.code,
    required this.message,
    required this.retryable,
  });

  factory SyncEntityError.fromJson(Map<String, dynamic> json) =>
      SyncEntityError(
        entity: json['entity'] as String? ?? '',
        id: json['id'] as String? ?? '',
        code: json['code'] as String? ?? 'UNKNOWN',
        message: json['message'] as String? ?? '',
        // Bawaan `true` disengaja: galat tanpa penanda diperlakukan sebagai
        // layak dicoba ulang. Mengarantina baris karena field yang hilang
        // berarti membuang data atas dasar ketiadaan informasi.
        retryable: json['retryable'] as bool? ?? true,
      );

  /// shift | transaction | return | void_log | waste | security_event
  final String entity;
  final String id;
  final String code;
  final String message;
  final bool retryable;

  /// Kunci pencarian gabungan agar pencocokan `O(1)`.
  String get key => '$entity:$id';

  @override
  List<Object?> get props => <Object?>[entity, id, code, message, retryable];
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
    this.returnsSynced = 0,
    this.voidLogsSynced = 0,
    this.securityEventsSynced = 0,
    this.errors = const <SyncEntityError>[],
    this.masterDataVersion,
  });

  factory SyncUpResponse.fromJson(Map<String, dynamic> json) => SyncUpResponse(
        shiftsSynced: (json['shifts_synced'] as num?)?.toInt() ?? 0,
        transactionsSynced:
            (json['transactions_synced'] as num?)?.toInt() ?? 0,
        wastesSynced: (json['wastes_synced'] as num?)?.toInt() ?? 0,
        // `failed_transactions` boleh `null`; normalisasinya wajib.
        failedTransactionIds: _stringList(json['failed_transactions']),
        returnsSynced: (json['returns_synced'] as num?)?.toInt() ?? 0,
        voidLogsSynced: (json['void_logs_synced'] as num?)?.toInt() ?? 0,
        securityEventsSynced:
            (json['security_events_synced'] as num?)?.toInt() ?? 0,
        errors: _errors(json['errors']),
        masterDataVersion: (json['master_data_version'] as num?)?.toInt(),
      );

  final int shiftsSynced;
  final int transactionsSynced;
  final int wastesSynced;

  // ── v2 ([11 §4.3]) ────────────────────────────────────────────────────────
  //
  // Server lama tidak mengirim satu pun field ini; nilai bawaan `0`/kosong
  // membuat perangkat v2 tetap berfungsi terhadap server yang belum diperbarui.
  final int returnsSynced;
  final int voidLogsSynced;
  final int securityEventsSynced;

  /// Galat per-entitas beserta alasannya.
  ///
  /// Kosong pada respons v1 — dan itu benar: server v1 memang tidak dapat
  /// membedakan kegagalan sementara dari penolakan permanen, sehingga tidak ada
  /// baris yang boleh dikarantina berdasarkan jawabannya.
  final List<SyncEntityError> errors;

  /// Versi master data terkini menurut server (butir 10).
  final int? masterDataVersion;

  /// **Satu-satunya entitas yang dilacak per-ID.** Shift dan waste yang gagal
  /// dilewati server secara diam-diam; selisih hitungan adalah satu-satunya
  /// petunjuk ([03 §2.3]).
  final List<String> failedTransactionIds;

  static List<String> _stringList(Object? raw) {
    if (raw is! List<dynamic>) return const <String>[];
    return raw.whereType<String>().toList(growable: false);
  }

  static List<SyncEntityError> _errors(Object? raw) {
    if (raw is! List<dynamic>) return const <SyncEntityError>[];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(SyncEntityError.fromJson)
        .toList(growable: false);
  }

  /// Indeks galat agar pencocokan per-baris tidak menjadi `O(n²)`.
  Map<String, SyncEntityError> get errorsByKey => <String, SyncEntityError>{
        for (final SyncEntityError e in errors) e.key: e,
      };

  @override
  List<Object?> get props => <Object?>[
        shiftsSynced,
        transactionsSynced,
        wastesSynced,
        failedTransactionIds,
        returnsSynced,
        voidLogsSynced,
        securityEventsSynced,
        errors,
        masterDataVersion,
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
    this.returnsSynced = 0,
    this.voidLogsSynced = 0,
    this.securityEventsSynced = 0,
    this.quarantined = 0,
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
        returnsSynced = 0,
        voidLogsSynced = 0,
        securityEventsSynced = 0,
        quarantined = 0,
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
        returnsSynced = 0,
        voidLogsSynced = 0,
        securityEventsSynced = 0,
        quarantined = 0,
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

  // ── v2 ([11 §M12.3]) ──────────────────────────────────────────────────────
  final int returnsSynced;
  final int voidLogsSynced;
  final int securityEventsSynced;

  /// Baris yang dipindahkan ke KARANTINA pada putaran ini.
  final int quarantined;

  final String? error;

  bool get wasSkipped => skipped != null;

  /// `true` bila ada baris yang menuntut tindakan manusia.
  bool get needsAttention => quarantined > 0;

  /// Kegagalan shift hanya terungkap lewat selisih hitungan — tidak ada
  /// `failed_shifts` di respons ([03 §2.3]).
  bool get hasShiftMismatch => shiftsSynced != shiftsSent;

  bool get hasWasteMismatch => wastesSynced != wastesSent;

  /// Layak dicoba ulang oleh WorkManager (M8).
  ///
  /// Karantina TIDAK membuat putaran layak diulang: barisnya memang tidak akan
  /// pernah diterima, dan menyuruh WorkManager mencoba lagi hanya membangunkan
  /// isolate untuk pekerjaan yang pasti sia-sia.
  bool get shouldRetry => !ok && quarantined == 0;

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
        returnsSynced: returnsSynced + other.returnsSynced,
        voidLogsSynced: voidLogsSynced + other.voidLogsSynced,
        securityEventsSynced:
            securityEventsSynced + other.securityEventsSynced,
        quarantined: quarantined + other.quarantined,
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
        returnsSynced,
        voidLogsSynced,
        securityEventsSynced,
        quarantined,
        error,
      ];
}
