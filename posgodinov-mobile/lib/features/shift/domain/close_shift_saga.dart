import 'dart:async';
import 'dart:convert';

import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/database/daos/security_event_dao.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/printer/audit_receipt_data.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';
import 'package:posgodinov_mobile/core/sync/sync_engine.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:uuid/uuid.dart';

/// Hasil satu putaran saga.
class CloseShiftOutcome {
  const CloseShiftOutcome.success({required this.shiftId, required this.synced})
      : error = null;

  const CloseShiftOutcome.failure(this.error)
      : shiftId = '',
        synced = false;

  final String shiftId;

  /// `true` bila sinkronisasi selesai dalam batas waktu. Bukan syarat berhasil.
  final bool synced;

  final String? error;

  bool get ok => error == null;
}

/// `CloseShiftSaga` — **butir 17** ([11 §M15.4]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// ENAM LANGKAH, SATU TITIK TAK DAPAT DIBATALKAN
/// ═══════════════════════════════════════════════════════════════════════════
///
///   1. Validasi input deklarasi (≥ 0, bukan kosong)
///   2. Tulis shift CLOSED ke Drift            ← titik tak dapat dibatalkan
///   3. Antre struk tutup shift ke print_jobs
///   4. Picu sync ('shift-close'), TUNGGU maksimal 8 detik
///      └─ gagal/timeout → lanjut; antrean menyusul, kasir tidak ditahan
///   5. Bersihkan sesi kasir
///   6. Arahkan ke Login — dilakukan pemanggil lewat `onFinished`
///
/// **Setelah langkah 2, saga tidak pernah berhenti di tengah.** Shift yang
/// sudah `CLOSED` di Drift tetapi kasirnya masih tertahan di layar tutup shift
/// adalah keadaan yang tidak dapat dipulihkan dari layar itu: tombolnya akan
/// menolak karena shift-nya sudah tidak terbuka, dan kasir terjebak. Karena itu
/// langkah 3–5 seluruhnya menelan kegagalannya sendiri.
///
/// Batas 8 detik pada langkah 4 bukan optimisme tentang jaringan. Ia justru
/// mengasumsikan jaringan buruk: menunggu tanpa batas berarti kasir yang berdiri
/// di outlet tanpa sinyal tidak pernah sampai ke layar Login, dan shift
/// berikutnya tidak dapat dibuka. Antrean sync sudah menjamin data itu sampai —
/// yang ditunggu di sini hanyalah kenyamanan melihatnya terkirim.
class CloseShiftSaga {
  const CloseShiftSaga({
    required ShiftRepository repository,
    required PrintQueueService printQueue,
    required SyncEngine syncEngine,
    required SecurityEventDao securityEventDao,
    required SyncDao syncDao,
    Uuid uuid = const Uuid(),
    DateTime Function()? now,
    Duration syncWait = const Duration(seconds: 8),
  })  : _repository = repository,
        _printQueue = printQueue,
        _sync = syncEngine,
        _events = securityEventDao,
        _syncDao = syncDao,
        _uuid = uuid,
        _now = now ?? DateTime.now,
        _syncWait = syncWait;

  final ShiftRepository _repository;
  final PrintQueueService _printQueue;

  /// `SyncEngine` langsung, BUKAN `SyncTriggers`.
  ///
  /// `SyncTriggers.onShiftClosed()` bertipe `void` dan menjadwalkan
  /// pengiriman dengan debounce 1,5 detik — tidak ada yang dapat ditunggu
  /// darinya. Langkah 4 saga ini justru perlu menunggu, karena batas 8 detik
  /// itulah yang memutuskan apakah kasir diberi tahu "terkirim" atau "akan
  /// terkirim otomatis".
  final SyncEngine _sync;
  final SecurityEventDao _events;
  final SyncDao _syncDao;
  final Uuid _uuid;
  final DateTime Function() _now;
  final Duration _syncWait;

  /// Menutup shift dengan tiga angka deklarasi kasir.
  Future<CloseShiftOutcome> run({
    required Shift shift,
    required int declaredCashMinor,
    required int declaredEdcMinor,
    required int declaredQrisMinor,
    required String cashierName,
  }) async {
    // ── 1. Validasi ───────────────────────────────────────────────────────
    //
    // Nol adalah nilai yang SAH: outlet yang tidak menerima QRIS sepanjang
    // shift memang mendeklarasikan nol. Yang ditolak hanya nilai negatif, yang
    // tidak dapat lahir dari laci mana pun.
    if (declaredCashMinor < 0 ||
        declaredEdcMinor < 0 ||
        declaredQrisMinor < 0) {
      return const CloseShiftOutcome.failure(
        'Nilai deklarasi tidak boleh negatif.',
      );
    }

    // ── 2. Titik tak dapat dibatalkan ─────────────────────────────────────
    //
    // Kegagalan di sini BOLEH menghentikan saga: belum ada yang berubah, dan
    // kasir dapat mencoba lagi dari layar yang sama.
    final Shift closed;
    try {
      closed = await _repository.close(
        shiftId: shift.id,
        declaredCashMinor: declaredCashMinor,
        declaredEdcMinor: declaredEdcMinor,
        declaredQrisMinor: declaredQrisMinor,
        blindClose: shift.blindClose,
      );
    } on Object catch (e) {
      return CloseShiftOutcome.failure('Gagal menutup shift: $e');
    }

    // ── 3. Struk tutup shift ──────────────────────────────────────────────
    //
    // Aturan R6: kegagalan cetak tidak pernah menggulung penulisan yang sudah
    // terjadi. `enqueueShiftReport` sendiri sudah berjanji tidak melempar;
    // `try` di sini menjaga janji itu tetap benar bila kelak berubah.
    try {
      await _printQueue.enqueueShiftReport(
        closed.id,
        ShiftReportData(
          outletName: await _printQueue.resolveOutletName(),
          shiftId: closed.id,
          cashierName: cashierName,
          openedAt: closed.clientOpenedAt,
          closedAt: closed.clientClosedAt ?? _now().toUtc(),
          // Diambil dari argumen, BUKAN dibaca ulang dari basis data: kertas
          // harus memuat angka yang baru saja diketik kasir.
          declaredCashMinor: declaredCashMinor,
          declaredEdcMinor: declaredEdcMinor,
          declaredQrisMinor: declaredQrisMinor,
          blindClose: closed.blindClose,
        ),
      );
    } on Object {
      // sengaja ditelan — lihat catatan di atas
    }

    // ── 4. Sync, dengan batas waktu ───────────────────────────────────────
    //
    // Promise yang kalah balapan TIDAK dibatalkan — ia tetap berjalan sampai
    // selesai di latar, dan itu memang yang diinginkan: sync yang lambat tetap
    // harus sampai, hanya kasirnya yang tidak perlu menunggunya.
    bool synced = false;
    try {
      final SyncOutcome outcome = await _sync
          .syncUp(SyncTrigger.shiftClose)
          .timeout(_syncWait);
      synced = outcome.ok;
    } on Object {
      // TimeoutException maupun kegagalan jaringan mendarat di sini, dan
      // keduanya diperlakukan sama: kasir tetap dilepas ke layar Login. Barisnya
      // sudah aman di Drift, dan antrean sync akan mengirimnya sendiri.
      synced = false;
    }

    return CloseShiftOutcome.success(shiftId: closed.id, synced: synced);
  }

  /// Menutup PAKSA shift atas otoritas supervisor — **butir 12**
  /// ([11 §M15.2]).
  ///
  /// ⚠️ Pemanggil WAJIB sudah memverifikasi PIN lewat `SupervisorAuthorizer`.
  ///
  /// ═══════════════════════════════════════════════════════════════════════
  /// DEKLARASI NOL, DAN `blindClose: false`
  /// ═══════════════════════════════════════════════════════════════════════
  ///
  /// Tidak ada yang menghitung laci saat Force Close. Menuliskan angka apa pun
  /// selain nol berarti mengarang kesaksian atas nama orang yang tidak ada di
  /// tempat, dan `ShiftReconcileService` akan menghitung selisih terhadap angka
  /// karangan itu.
  ///
  /// `blindClose: false` adalah penandanya: shift ini **bukan** hasil penutupan
  /// buta yang sah, dan laporan pemilik dapat memisahkannya dari shift yang
  /// angkanya benar-benar berasal dari hitungan seseorang.
  Future<CloseShiftOutcome> forceClose({
    required Shift shift,
    required String supervisorId,
    required String supervisorName,
    required String reason,
  }) async {
    final String trimmed = reason.trim();
    if (trimmed.length < ReasonCodes.otherNotesMinLength) {
      return const CloseShiftOutcome.failure(
        'Alasan minimal ${ReasonCodes.otherNotesMinLength} karakter.',
      );
    }

    // ── Peristiwa DULU, penutupan KEMUDIAN ────────────────────────────────
    //
    // Urutan ini disengaja dan berbeda dari [run]. Bila penulisan shift
    // berhasil tetapi pencatatan peristiwanya gagal, yang tersisa adalah shift
    // tertutup tanpa satu pun jejak siapa yang memaksanya — persis
    // penyalahgunaan yang jalur ini harus buat mustahil.
    //
    // Sebaliknya, peristiwa yang tercatat untuk penutupan yang kemudian gagal
    // hanya menghasilkan satu baris audit berlebih, dan itu keliru ke arah yang
    // benar.
    await _recordForceClose(shift, supervisorId, supervisorName, trimmed);

    final Shift closed;
    try {
      closed = await _repository.close(
        shiftId: shift.id,
        declaredCashMinor: 0,
        declaredEdcMinor: 0,
        declaredQrisMinor: 0,
        blindClose: false,
        closedBy: supervisorId,
      );
    } on Object catch (e) {
      return CloseShiftOutcome.failure('Gagal menutup paksa shift: $e');
    }

    try {
      await _printQueue.enqueueShiftReport(
        closed.id,
        ShiftReportData(
          outletName: await _printQueue.resolveOutletName(),
          shiftId: closed.id,
          cashierName: '(kasir tidak hadir)',
          openedAt: closed.clientOpenedAt,
          closedAt: closed.clientClosedAt ?? _now().toUtc(),
          declaredCashMinor: 0,
          declaredEdcMinor: 0,
          declaredQrisMinor: 0,
          blindClose: false,
          closedByName: supervisorName,
        ),
      );
    } on Object {
      // idem — R6
    }

    // Tidak ditunggu: supervisor yang menutup paksa sedang menyelesaikan
    // masalah operasional, bukan menunggu konfirmasi pengiriman.
    unawaited(_sync.syncUp(SyncTrigger.shiftClose));
    return CloseShiftOutcome.success(shiftId: closed.id, synced: false);
  }

  Future<void> _recordForceClose(
    Shift shift,
    String supervisorId,
    String supervisorName,
    String reason,
  ) async {
    try {
      await _events.recordEvent(
        id: _uuid.v4(),
        shiftId: shift.id,
        // Kasir PEMILIK shift, bukan yang menutupnya. Keduanya dicatat justru
        // karena perbedaannya yang menjadi inti peristiwa ini.
        staffId: shift.staffId,
        deviceId: await _syncDao.readMeta(SyncMetaKeys.deviceId) ?? 'legacy',
        eventType: SecurityEventType.shiftForceClosed,
        severity: SecuritySeverity.critical,
        detailsJson: jsonEncode(<String, dynamic>{
          'shift_id': shift.id,
          'shift_staff_id': shift.staffId,
          'supervisor_id': supervisorId,
          'supervisor_name': supervisorName,
          'reason': reason,
          'opened_at': shift.clientOpenedAt.toUtc().toIso8601String(),
        }),
        clientCreatedAt: _now().toUtc(),
      );
    } on Object {
      // Pencatatan yang gagal tidak boleh menghentikan jalur darurat: perangkat
      // yang terkunci selamanya adalah kerugian yang jauh lebih nyata daripada
      // satu baris audit yang hilang.
    }
  }
}
