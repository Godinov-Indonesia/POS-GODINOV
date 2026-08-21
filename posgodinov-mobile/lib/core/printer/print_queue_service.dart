import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:drift/drift.dart' show Value;
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/print_job_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/database/tables/print_jobs_table.dart';
import 'package:posgodinov_mobile/core/database/tables/security_events_table.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/printer/escpos_audit_builder.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';
import 'package:uuid/uuid.dart';

/// Antrean cetak yang tahan gagal — **butir 6 & 7** ([11 §M14.1]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// ATURAN R6 — KEGAGALAN CETAK TIDAK PERNAH MEMBATALKAN PENULISAN
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Uang sudah berpindah. Printer mati adalah masalah operasional, bukan alasan
/// menghilangkan penjualan, pembatalan, atau retur yang sudah terjadi.
///
/// Konsekuensinya mengikat seluruh berkas ini: **tidak satu pun metode
/// `enqueue*` boleh melempar.** Pemanggilnya berada tepat setelah penulisan
/// Drift, dan lemparan dari sini akan mendarat di blok `catch` yang — cepat
/// atau lambat — akan dipakai seseorang untuk menggulung transaksinya.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// DIRENDER SEKALI, DIKIRIM BERKALI-KALI
/// ═══════════════════════════════════════════════════════════════════════════
///
/// ```
/// enqueue → render ESC/POS SEKALI → simpan payload → kirim → tandai
/// ```
///
/// Payload disimpan sebagai byte jadi (base64), bukan sebagai data sumbernya.
/// Cetak ulang mengirim byte yang sama persis, sehingga kertas kedua identik
/// dengan yang pertama walau nama produk sudah diperbarui pemilik atau harganya
/// sudah naik. Struk pembatalan yang isinya berbeda dari cetakan pertama tidak
/// dapat dipakai sebagai bukti audit — dan bukti audit adalah satu-satunya
/// alasan ia dicetak.
class PrintQueueService {
  PrintQueueService({
    required AppDatabase database,
    required PrintJobDao dao,
    required SecurityEventDao securityEventDao,
    required SyncDao syncDao,
    required ReceiptPrinter printer,
    EscPosAuditBuilder auditBuilder = const EscPosAuditBuilder(),
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
  })  : _db = database,
        _dao = dao,
        _securityEvents = securityEventDao,
        _syncDao = syncDao,
        _printer = printer,
        _audit = auditBuilder,
        _uuid = uuid,
        _now = now ?? DateTime.now;

  final AppDatabase _db;
  final PrintJobDao _dao;
  final SecurityEventDao _securityEvents;
  final SyncDao _syncDao;
  final ReceiptPrinter _printer;
  final EscPosAuditBuilder _audit;
  final Uuid _uuid;
  final DateTime Function() _now;

  /// Mutex proses.
  ///
  /// Dua flush bersamaan akan mengirim job yang sama dua kali — dan tidak
  /// seperti sinkronisasi, printer **tidak idempoten**: hasilnya dua lembar
  /// kertas untuk satu peristiwa.
  bool _flushing = false;

  /// Nama outlet untuk kepala struk.
  ///
  /// Diselesaikan di SINI, bukan di setiap repositori: nama outlet hanya
  /// tersimpan di `sync_meta`, dan meneruskannya melalui empat konstruktor
  /// repositori hanya menyebarkan satu bacaan sepele ke seluruh lapisan data.
  Future<String> resolveOutletName() async =>
      await _syncDao.readMeta(SyncMetaKeys.outletName) ?? 'POS Godinov';

  /// Jumlah struk yang belum berhasil tercetak — sumber banner persisten.
  ///
  /// Mencakup `PENDING`, `FAILED`, dan `ABANDONED` karena ketiganya sama-sama
  /// berarti tidak ada kertas di tangan siapa pun.
  Stream<int> watchUnprintedCount() => _dao.watchUnprintedCount();

  /* ── Enqueue ─────────────────────────────────────────────────────────── */

  /// **Butir 6** — dipakai KETIGA cakupan void.
  Future<String?> enqueueCancelReceipt(String voidLogId, CancelReceiptData data) =>
      _enqueue(
        kind: PrintJobKind.cancelReceipt,
        refType: 'void_log',
        refId: voidLogId,
        render: () => _audit.buildCancel(data),
      );

  /// **Butir 7.**
  Future<String?> enqueueWasteReceipt(String wasteId, WasteReceiptData data) =>
      _enqueue(
        kind: PrintJobKind.wasteReceipt,
        refType: 'waste',
        refId: wasteId,
        render: () => _audit.buildWaste(data),
      );

  Future<String?> enqueueReturnReceipt(String returnId, ReturnReceiptData data) =>
      _enqueue(
        kind: PrintJobKind.returnReceipt,
        refType: 'return',
        refId: returnId,
        render: () => _audit.buildReturn(data),
      );

  /// Struk tutup shift — **butir 9** ([11 §M15.3]).
  ///
  /// ⚠️ [data] hanya memuat angka DEKLARASI. Lihat catatan pada
  /// [ShiftReportData]: mencetak ekspektasi di kertas membatalkan Blind Closing
  /// dengan cara yang lebih sulit ditarik kembali daripada menampilkannya di
  /// layar.
  Future<String?> enqueueShiftReport(String shiftId, ShiftReportData data) =>
      _enqueue(
        kind: PrintJobKind.shiftReport,
        refType: 'shift',
        refId: shiftId,
        render: () => _audit.buildShiftReport(data),
      );

  /// Struk penjualan, memakai renderer yang sudah ada.
  Future<String?> enqueueSaleReceipt(
    String transactionId,
    Future<Uint8List> Function() render,
  ) =>
      _enqueue(
        kind: PrintJobKind.saleReceipt,
        refType: 'transaction',
        refId: transactionId,
        render: render,
      );

  /// Inti antrean. **Tidak pernah melempar** (aturan R6).
  Future<String?> _enqueue({
    required PrintJobKind kind,
    required String refType,
    required String refId,
    required Future<Uint8List> Function() render,
  }) async {
    try {
      final Uint8List payload = await render();
      final String id = _uuid.v4();

      await _dao.enqueue(
        PrintJobsCompanion.insert(
          id: id,
          kind: kind,
          status: PrintJobStatus.pending,
          refType: refType,
          refId: refId,
          payloadBase64: base64Encode(payload),
          createdAt: _now().toUtc(),
        ),
      );

      // Pengiriman TIDAK ditunggu: kasir tidak boleh menatap layar beku selama
      // adapter Bluetooth menegosiasikan koneksi. Barisnya sudah aman di SQLite.
      unawaited(flush());

      return id;
    } on Object {
      // Termasuk kegagalan menulis job itu sendiri. Yang hilang hanyalah
      // kertas; transaksinya tetap tersimpan, dan itulah urutan prioritas yang
      // benar.
      return null;
    }
  }

  /* ── Flush ───────────────────────────────────────────────────────────── */

  /// Mengirim seluruh job `PENDING` secara berurutan.
  ///
  /// **Tidak pernah melempar.** Kegagalan satu job dicatat pada barisnya
  /// sendiri dan tidak menghentikan job berikutnya: printer yang menolak satu
  /// struk bermasalah tetap dapat mencetak sisanya.
  Future<void> flush() async {
    if (_flushing) return;
    _flushing = true;

    try {
      final List<LocalPrintJob> jobs = await _dao.due();
      for (final LocalPrintJob job in jobs) {
        await _sendOne(job);
      }
    } on Object {
      // Kegagalan di luar per-job. Job-nya tetap `PENDING` dan akan dicoba lagi
      // pada pemicu berikutnya.
    } finally {
      _flushing = false;
      await _scheduleNextFlush();
    }
  }

  /// Menjadwalkan flush berikutnya saat job `FAILED` paling awal jatuh tempo.
  ///
  /// Tanpa penjadwal, "retry otomatis ≤ 3×" hanya terjadi bila kebetulan ada
  /// peristiwa lain yang memicu flush — dan pada perangkat yang menganggur
  /// setelah transaksi terakhir, peristiwa itu tidak pernah datang. Percobaan
  /// kedua akan menunggu sampai kasir menekan tombol, yang membuatnya
  /// percobaan manual.
  Timer? _retryTimer;

  Future<void> _scheduleNextFlush() async {
    _retryTimer?.cancel();
    _retryTimer = null;

    try {
      final Duration? delay = await _dao.untilNextDue();
      if (delay == null) return;

      _retryTimer = Timer(delay, () {
        _retryTimer = null;
        unawaited(flush());
      });
    } on Object {
      // Penjadwalan yang gagal hanya berarti percobaan berikutnya menunggu
      // pemicu lain — bukan alasan merambatkan lemparan ke pemanggil flush.
    }
  }

  /// Melepas timer yang tertunda.
  ///
  /// Dipanggil saat aplikasi ditutup; tanpa ini timer menahan referensi ke
  /// basis data yang sudah ditutup dan melempar saat menyala.
  void dispose() {
    _retryTimer?.cancel();
    _retryTimer = null;
  }

  Future<void> _sendOne(LocalPrintJob job) async {
    await _dao.markPrinting(job.id);

    final bool ok = await _printer.printBytes(
      Uint8List.fromList(base64Decode(job.payloadBase64)),
    );

    if (ok) {
      await _dao.markPrinted(job.id, _now().toUtc());
      await _stampSource(job);
      return;
    }

    // `markFailed` yang memutuskan kapan menyerah (≤ 3 percobaan), bukan
    // pemanggilnya — batasnya hidup di satu tempat bersama kolomnya.
    final PrintJobStatus next = await _dao.markFailed(job.id, 'Printer menolak data');

    if (next == PrintJobStatus.abandoned) {
      // ── R9 — jejaknya ikut antrean sync ────────────────────────────────
      //
      // Ditulis di sini, bukan di dalam kait [onAbandoned]: kait itu opsional
      // dan hanya terpasang selama ada UI yang memasangnya. Struk pembatalan
      // yang menyerah pada perangkat yang layarnya sedang menampilkan hal lain
      // tetap harus sampai ke pemilik.
      await _recordPrintFailure(job);

      // Sengaja TIDAK melempar. Job yang menyerah adalah kondisi yang harus
      // dilihat kasir lewat banner, bukan kondisi yang menghentikan antrean —
      // struk berikutnya mungkin justru berhasil.
      onAbandoned?.call(job);
    }
  }

  /// Kait opsional untuk lapisan UI: dipanggil saat sebuah job menyerah.
  ///
  /// Peringatan di layar saja; pencatatan `pos_security_events` tidak
  /// bergantung padanya — lihat [_recordPrintFailure].
  void Function(LocalPrintJob job)? onAbandoned;

  /// Jenis job → jenis peristiwa keamanan saat ia menyerah ([11 §3.3]).
  ///
  /// Struk penjualan `WARN`, sisanya `CRITICAL`: penjualan yang struknya gagal
  /// masih meninggalkan barisnya sendiri di server, sedangkan pembatalan,
  /// retur, dan pembuangan justru KERTASNYA yang menjadi bukti — tanda tangan
  /// pemberi otoritas tidak ada di tempat lain mana pun.
  static const Map<PrintJobKind, String> _failureEvent = <PrintJobKind, String>{
    PrintJobKind.saleReceipt: SecurityEventType.saleReceiptPrintFailed,
    PrintJobKind.cancelReceipt: SecurityEventType.voidReceiptPrintFailed,
    PrintJobKind.wasteReceipt: SecurityEventType.wasteReceiptPrintFailed,
    PrintJobKind.returnReceipt: SecurityEventType.returnReceiptPrintFailed,
    PrintJobKind.shiftReport: SecurityEventType.saleReceiptPrintFailed,
  };

  static const Set<PrintJobKind> _criticalKinds = <PrintJobKind>{
    PrintJobKind.cancelReceipt,
    PrintJobKind.wasteReceipt,
    PrintJobKind.returnReceipt,
  };

  Future<void> _recordPrintFailure(LocalPrintJob job) async {
    try {
      await _securityEvents.record(
        SecurityEventsCompanion.insert(
          id: _uuid.v4(),
          eventType: _failureEvent[job.kind] ??
              SecurityEventType.saleReceiptPrintFailed,
          severity: _criticalKinds.contains(job.kind)
              ? SecuritySeverity.critical
              : SecuritySeverity.warn,
          detailsJson: Value<String>(
            jsonEncode(<String, dynamic>{
              'print_job_id': job.id,
              'kind': job.kind.name,
              'ref_type': job.refType,
              'ref_id': job.refId,
              'attempts': PrintJobDao.maxAttempts,
              'last_error': job.lastError,
            }),
          ),
          clientCreatedAt: _now().toUtc(),
        ),
      );
    } on Object {
      // Pencatatan yang gagal tidak boleh menghentikan antrean. Bannernya tetap
      // menyala, dan itu tetap sampai ke mata kasir.
    }
  }

  /* ── Penandaan sumber ────────────────────────────────────────────────── */

  /// Menandai baris SUMBER bahwa kertasnya benar-benar terbit.
  ///
  /// ═══════════════════════════════════════════════════════════════════════
  /// INILAH TITIK YANG MENENTUKAN VOID vs RETUR
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// `transactions.receipt_printed_at` adalah diskriminator butir 15
  /// ([11 §2.1]), dan ia diisi **di sini** — bukan saat perintah cetak dikirim.
  /// Perintah yang gagal di tengah tidak menghasilkan kertas di tangan siapa
  /// pun, dan menandai transaksi sebagai "sudah tercetak" karena perintahnya
  /// terkirim akan menutup jalur Void untuk transaksi yang struknya tidak
  /// pernah keluar.
  ///
  /// Cetakan pertama mengisi `receipt_printed_at`; cetakan berikutnya hanya
  /// menaikkan `reprint_count` dan **tidak** menggeser waktunya — waktu itu
  /// menandai kapan dokumen pertama berpindah tangan, bukan kapan salinannya
  /// dibuat.
  ///
  /// Kegagalan menandai ditelan: kertasnya sudah terlanjur keluar, dan melempar
  /// di sini tidak akan menariknya kembali.
  Future<void> _stampSource(LocalPrintJob job) async {
    final DateTime at = _now().toUtc();

    try {
      switch (job.kind) {
        case PrintJobKind.saleReceipt:
          await _db.customStatement(
            'UPDATE transactions '
            'SET receipt_printed_at = COALESCE(receipt_printed_at, ?), '
            '    reprint_count = reprint_count + '
            '        CASE WHEN receipt_printed_at IS NULL THEN 0 ELSE 1 END '
            'WHERE id = ?',
            <Object?>[at, job.refId],
          );
        case PrintJobKind.cancelReceipt:
          await (_db.update(_db.voidLogs)
                ..where(($VoidLogsTable v) => v.id.equals(job.refId)))
              .write(
            VoidLogsCompanion(
              receiptPrinted: const Value<bool>(true),
              receiptPrintedAt: Value<DateTime?>(at),
            ),
          );
        case PrintJobKind.wasteReceipt:
          await (_db.update(_db.wastes)
                ..where(($WastesTable w) => w.id.equals(job.refId)))
              .write(
            WastesCompanion(
              receiptPrinted: const Value<bool>(true),
              printedAt: Value<DateTime?>(at),
            ),
          );
        case PrintJobKind.returnReceipt:
          await (_db.update(_db.returns)
                ..where(($ReturnsTable r) => r.id.equals(job.refId)))
              .write(
            ReturnsCompanion(
              receiptPrinted: const Value<bool>(true),
              receiptPrintedAt: Value<DateTime?>(at),
            ),
          );
        case PrintJobKind.shiftReport:
          // Laporan shift tidak memiliki kolom bukti cetak; barisnya sendiri
          // yang menjadi buktinya.
          break;
      }
    } on Object {
      // sengaja diabaikan — lihat catatan di atas
    }
  }

  /* ── Cetak ulang ─────────────────────────────────────────────────────── */

  /// Mengembalikan job ke antrean dan mencoba mengirimnya lagi.
  ///
  /// Memakai payload TERSIMPAN — lihat catatan pada [PrintJobDao.requeue].
  Future<void> retry(String jobId) async {
    try {
      // Dibaca SEBELUM di-requeue: statusnya adalah satu-satunya cara memisahkan
      // cetak ULANG dari percobaan pertama yang tertunda. Job `FAILED` yang
      // belum pernah menghasilkan kertas bukan cetak ulang — mencatatnya sebagai
      // `RECEIPT_REPRINTED` akan memenuhi laporan pemilik dengan cetak ulang
      // palsu dan menenggelamkan yang sungguhan.
      final LocalPrintJob? before = await _dao.byId(jobId);

      await _dao.requeue(jobId);
      await flush();

      if (before?.status == PrintJobStatus.printed) {
        final LocalPrintJob? after = await _dao.byId(jobId);
        if (after?.status == PrintJobStatus.printed) {
          await _recordReprint(before!);
        }
      }
    } on Object {
      // Kegagalan di sini tidak boleh merambat ke tombol yang menekannya.
    }
  }

  Future<void> _recordReprint(LocalPrintJob job) async {
    try {
      await _securityEvents.record(
        SecurityEventsCompanion.insert(
          id: _uuid.v4(),
          eventType: SecurityEventType.receiptReprinted,
          severity: SecuritySeverity.warn,
          detailsJson: Value<String>(
            jsonEncode(<String, dynamic>{
              'print_job_id': job.id,
              'kind': job.kind.name,
              'ref_type': job.refType,
              'ref_id': job.refId,
            }),
          ),
          clientCreatedAt: _now().toUtc(),
        ),
      );
    } on Object {
      // idem
    }
  }

  /// Mencetak ulang seluruh job yang sudah menyerah.
  ///
  /// Dipakai tombol pada banner. `ABANDONED` **tidak pernah** dikirim ulang
  /// otomatis: ia sudah menghabiskan jatah percobaannya, dan mencobanya lagi
  /// tanpa ada yang berubah hanya mengulang kegagalan yang sama. Kasir yang
  /// menekan tombol ini adalah perubahan itu.
  Future<void> retryAllAbandoned() async {
    try {
      final List<LocalPrintJob> jobs = await _dao.byStatus(PrintJobStatus.abandoned);
      for (final LocalPrintJob job in jobs) {
        await _dao.requeue(job.id);
      }
      await flush();
    } on Object {
      // idem
    }
  }
}
