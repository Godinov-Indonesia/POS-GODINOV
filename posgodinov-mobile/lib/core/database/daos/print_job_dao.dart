import 'package:drift/drift.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/tables/print_jobs_table.dart';

part 'print_job_dao.g.dart';

/// Akses `print_jobs` — antrean cetak, **murni lokal** ([11 §3.8]).
///
/// Tidak ada satu pun metode di sini yang menyentuh antrean sync: barisnya
/// tidak pernah meninggalkan perangkat.
@DriftAccessor(tables: <Type>[PrintJobs])
class PrintJobDao extends DatabaseAccessor<AppDatabase>
    with _$PrintJobDaoMixin {
  PrintJobDao(super.db);

  /// Batas percobaan sebelum job dinyatakan [PrintJobStatus.abandoned].
  ///
  /// Setelahnya dibutuhkan tindakan manual kasir; mencoba tanpa henti hanya
  /// menghabiskan baterai dan menyembunyikan bahwa printer memang mati.
  static const int maxAttempts = 3;

  /// Jeda sebelum percobaan ke-N+1 ([11 §M14.1]).
  ///
  /// Mencoba lagi seketika hampir selalu gagal dengan cara yang sama: adapter
  /// Bluetooth yang baru putus butuh beberapa detik sebelum mau menerima
  /// koneksi baru, dan tiga kegagalan dalam 200 ms hanya menghabiskan jatah
  /// percobaan tanpa pernah benar-benar mencoba.
  ///
  /// Entri ketiga tidak terjangkau selama [maxAttempts] bernilai 3 — ia ada
  /// agar menaikkan ambangnya tidak menuntut daftar ini ikut diubah.
  static const List<Duration> backoff = <Duration>[
    Duration(seconds: 3),
    Duration(seconds: 10),
    Duration(seconds: 30),
  ];

  /// Jeda yang berlaku untuk job dengan [attempts] kegagalan.
  static Duration backoffFor(int attempts) {
    if (attempts <= 0) return Duration.zero;
    return backoff[(attempts < backoff.length ? attempts : backoff.length) - 1];
  }

  /// Kapan sebuah job boleh dicoba lagi; `null` bila tidak akan pernah.
  static DateTime? dueAt(LocalPrintJob job) {
    switch (job.status) {
      case PrintJobStatus.pending:
        return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
      case PrintJobStatus.failed:
        final DateTime? last = job.lastAttemptAt;
        if (last == null) {
          return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
        }
        return last.toUtc().add(backoffFor(job.attempts));
      case PrintJobStatus.printing:
      case PrintJobStatus.printed:
      case PrintJobStatus.abandoned:
        return null;
    }
  }

  Future<void> enqueue(PrintJobsCompanion job) => into(db.printJobs).insert(job);

  /// Job yang menunggu giliran cetak, urut kronologis.
  Future<List<LocalPrintJob>> pending({int limit = 20}) {
    return (select(db.printJobs)
          ..where(($PrintJobsTable j) =>
              j.status.equalsValue(PrintJobStatus.pending),)
          ..orderBy(<OrderClauseGenerator<$PrintJobsTable>>[
            ($PrintJobsTable j) => OrderingTerm.asc(j.createdAt),
          ])
          ..limit(limit))
        .get();
  }

  /// Job yang **boleh dikirim sekarang**: `PENDING`, ditambah `FAILED` yang
  /// jeda mundurnya sudah lewat.
  ///
  /// ⚠️ Memakai [pending] sendirian membuat "retry otomatis ≤ 3×" tidak pernah
  /// terjadi: percobaan kedua hanya akan datang bila kasir menekan tombol, dan
  /// itu percobaan manual.
  ///
  /// Penyaringan jeda dilakukan di Dart, bukan di SQL: rumusnya bergantung pada
  /// [attempts] per baris, dan menuliskannya sebagai ekspresi SQL menyebarkan
  /// tabel [backoff] ke tempat kedua yang harus ikut diubah setiap kali
  /// angkanya disetel.
  Future<List<LocalPrintJob>> due({int limit = 20}) async {
    final List<LocalPrintJob> rows = await (select(db.printJobs)
          ..where(($PrintJobsTable j) =>
              j.status.equalsValue(PrintJobStatus.pending) |
              j.status.equalsValue(PrintJobStatus.failed),)
          ..orderBy(<OrderClauseGenerator<$PrintJobsTable>>[
            ($PrintJobsTable j) => OrderingTerm.asc(j.createdAt),
          ]))
        .get();

    final DateTime now = DateTime.now().toUtc();
    final List<LocalPrintJob> ready = <LocalPrintJob>[
      for (final LocalPrintJob job in rows)
        if (!(dueAt(job)?.isAfter(now) ?? true)) job,
    ];

    return ready.length > limit ? ready.sublist(0, limit) : ready;
  }

  /// Jeda menuju job berikutnya yang akan jatuh tempo; `null` bila tidak ada.
  Future<Duration?> untilNextDue() async {
    final List<LocalPrintJob> rows = await (select(db.printJobs)
          ..where(($PrintJobsTable j) =>
              j.status.equalsValue(PrintJobStatus.failed),))
        .get();

    DateTime? soonest;
    for (final LocalPrintJob job in rows) {
      final DateTime? at = dueAt(job);
      if (at == null) continue;
      if (soonest == null || at.isBefore(soonest)) soonest = at;
    }
    if (soonest == null) return null;

    final Duration delta = soonest.difference(DateTime.now().toUtc());
    return delta.isNegative ? Duration.zero : delta;
  }

  /// Jumlah struk yang **belum** berhasil tercetak.
  ///
  /// Sumber banner persisten di Bottom Bar ([11 §M14.1]). Mencakup
  /// [PrintJobStatus.failed] dan [PrintJobStatus.abandoned] karena keduanya
  /// sama-sama berarti tidak ada kertas di tangan siapa pun.
  Stream<int> watchUnprintedCount() {
    final Expression<int> count = db.printJobs.id.count();
    final JoinedSelectStatement<HasResultSet, dynamic> query =
        selectOnly(db.printJobs)
          ..addColumns(<Expression<Object>>[count])
          ..where(
            db.printJobs.status.equalsValue(PrintJobStatus.pending) |
                db.printJobs.status.equalsValue(PrintJobStatus.failed) |
                db.printJobs.status.equalsValue(PrintJobStatus.abandoned),
          );

    return query.map((TypedResult row) => row.read(count) ?? 0).watchSingle();
  }

  Future<LocalPrintJob?> byId(String id) {
    return (select(db.printJobs)..where(($PrintJobsTable j) => j.id.equals(id)))
        .getSingleOrNull();
  }

  /// Job pada satu status tertentu.
  ///
  /// Dipakai tombol "Cetak Ulang" pada banner, yang hanya menyentuh
  /// [PrintJobStatus.abandoned] — job yang sudah menghabiskan jatah
  /// percobaannya dan menunggu keputusan manusia.
  Future<List<LocalPrintJob>> byStatus(PrintJobStatus status, {int limit = 50}) {
    return (select(db.printJobs)
          ..where(($PrintJobsTable j) => j.status.equalsValue(status))
          ..orderBy(<OrderClauseGenerator<$PrintJobsTable>>[
            ($PrintJobsTable j) => OrderingTerm.asc(j.createdAt),
          ])
          ..limit(limit))
        .get();
  }

  /// Seluruh job untuk satu entitas — dasar fitur cetak ulang.
  Future<List<LocalPrintJob>> byRef(String refType, String refId) {
    return (select(db.printJobs)
          ..where(($PrintJobsTable j) =>
              j.refType.equals(refType) & j.refId.equals(refId),)
          ..orderBy(<OrderClauseGenerator<$PrintJobsTable>>[
            ($PrintJobsTable j) => OrderingTerm.asc(j.createdAt),
          ]))
        .get();
  }

  Future<void> markPrinting(String id) {
    return (update(db.printJobs)..where(($PrintJobsTable j) => j.id.equals(id)))
        .write(
      const PrintJobsCompanion(
        status: Value<PrintJobStatus>(PrintJobStatus.printing),
      ),
    );
  }

  Future<void> markPrinted(String id, DateTime printedAt) {
    return (update(db.printJobs)..where(($PrintJobsTable j) => j.id.equals(id)))
        .write(
      PrintJobsCompanion(
        status: const Value<PrintJobStatus>(PrintJobStatus.printed),
        printedAt: Value<DateTime?>(printedAt),
        lastError: const Value<String?>(null),
      ),
    );
  }

  /// Mencatat kegagalan dan memutuskan apakah job masih layak dicoba lagi.
  ///
  /// Mengembalikan status baru agar pemanggil tahu kapan harus memunculkan
  /// peringatan yang menuntut tindakan manual.
  Future<PrintJobStatus> markFailed(String id, String reason) async {
    return db.transaction(() async {
      final LocalPrintJob? row = await (select(db.printJobs)
            ..where(($PrintJobsTable j) => j.id.equals(id)))
          .getSingleOrNull();
      if (row == null) return PrintJobStatus.abandoned;

      final int attempts = row.attempts + 1;
      final PrintJobStatus next = attempts >= maxAttempts
          ? PrintJobStatus.abandoned
          : PrintJobStatus.failed;

      await (update(db.printJobs)
            ..where(($PrintJobsTable j) => j.id.equals(id)))
          .write(
        PrintJobsCompanion(
          status: Value<PrintJobStatus>(next),
          attempts: Value<int>(attempts),
          lastError: Value<String?>(reason),
          lastAttemptAt: Value<DateTime?>(DateTime.now().toUtc()),
        ),
      );

      return next;
    });
  }

  /// Mengembalikan job gagal ke antrean — dipicu kasir dari banner cetak ulang.
  ///
  /// [LocalPrintJob.payloadBase64] **tidak** dirender ulang: kertas hasil cetak
  /// ulang harus identik byte demi byte dengan yang pertama, karena data
  /// sumbernya mungkin sudah berubah sejak job dibuat.
  Future<void> requeue(String id) {
    return (update(db.printJobs)..where(($PrintJobsTable j) => j.id.equals(id)))
        .write(
      const PrintJobsCompanion(
        status: Value<PrintJobStatus>(PrintJobStatus.pending),
        lastError: Value<String?>(null),
        // Dinolkan supaya ketukan kasir dikirim SEKARANG. Jeda mundur ada untuk
        // percobaan otomatis; orang yang berdiri di depan printer sudah tahu
        // printernya baru saja diperbaiki.
        lastAttemptAt: Value<DateTime?>(null),
      ),
    );
  }
}
