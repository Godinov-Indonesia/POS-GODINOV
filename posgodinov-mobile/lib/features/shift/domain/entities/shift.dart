import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Shift kasir ([02 §2.11]).
///
/// Seluruh nominal **INTEGER SEN**. Dart murni — tanpa Drift, tanpa Flutter.
class Shift extends Equatable {
  const Shift({
    required this.id,
    required this.staffId,
    required this.openingBalanceMinor,
    required this.closingBalanceMinor,
    required this.expectedBalanceMinor,
    required this.discrepancyMinor,
    required this.status,
    required this.clientOpenedAt,
    this.clientClosedAt,
    this.declaredCashMinor = 0,
    this.declaredEdcTotalMinor = 0,
    this.declaredQrisTotalMinor = 0,
    this.blindClose = true,
    this.masterDataVersion,
    this.deviceId = 'legacy',
    this.closedBy,
  });

  /// UUID v4 **dibuat klien** saat shift dibuka ([03 §2.3]).
  final String id;

  final String staffId;

  /// Modal awal laci.
  final int openingBalanceMinor;

  /// Uang fisik hasil hitung saat tutup shift. `0` selama shift terbuka.
  final int closingBalanceMinor;

  /// ⚠️ **DEPRECATED pada v2** ([11 §M15.3]).
  ///
  /// Sejak Blind Closing, keduanya dihitung `ShiftReconcileService` di server
  /// dan **tidak pernah dikirim balik** ke perangkat kasir (aturan R3/R4).
  /// Nilainya di sini tetap `0` seumur hidup baris; field-nya dipertahankan
  /// agar migrasi tetap aditif dan laporan v1 tidak runtuh selama jendela
  /// deprekasi M18.
  ///
  /// ⛔ Kode v2 **dilarang** membacanya untuk pengambilan keputusan apa pun.
  final int expectedBalanceMinor;

  /// ⚠️ DEPRECATED pada v2 — lihat [expectedBalanceMinor].
  final int discrepancyMinor;

  /* ── v2 · Blind Closing (butir 9) ────────────────────────────────────── */

  /// Uang fisik hasil hitung laci. **Satu-satunya** angka kas dari kasir.
  final int declaredCashMinor;

  /// Total settle EDC yang dibacakan kasir dari mesin EDC.
  final int declaredEdcTotalMinor;

  /// Total settle QRIS.
  final int declaredQrisTotalMinor;

  /// `true` bila shift ditutup tanpa kasir melihat angka sistem.
  ///
  /// `false` menandai Force Close oleh supervisor: angkanya bukan hasil
  /// hitungan siapa pun, dan laporan pemilik harus dapat memisahkannya dari
  /// shift yang deklarasinya sungguhan ([11 §M15.2]).
  final bool blindClose;

  /* ── v2 · Gerbang & penguncian sesi (butir 10 & 12) ──────────────────── */

  /// Versi master data yang dipegang perangkat saat shift dibuka.
  final int? masterDataVersion;

  /// Identitas instalasi pemilik sesi.
  final String deviceId;

  /// Staff yang menutup shift — berbeda dari [staffId] pada Force Close.
  final String? closedBy;

  final ShiftStatus status;
  final DateTime clientOpenedAt;
  final DateTime? clientClosedAt;

  bool get isOpen => status == ShiftStatus.open;

  /// Lama shift berjalan sampai [now].
  Duration durationUntil(DateTime now) =>
      (clientClosedAt ?? now).difference(clientOpenedAt);

  @override
  List<Object?> get props => <Object?>[
        id,
        staffId,
        openingBalanceMinor,
        closingBalanceMinor,
        expectedBalanceMinor,
        discrepancyMinor,
        status,
        clientOpenedAt,
        clientClosedAt,
        declaredCashMinor,
        declaredEdcTotalMinor,
        declaredQrisTotalMinor,
        blindClose,
        masterDataVersion,
        deviceId,
        closedBy,
      ];
}
