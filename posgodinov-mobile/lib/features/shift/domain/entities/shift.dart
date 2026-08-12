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
  });

  /// UUID v4 **dibuat klien** saat shift dibuka ([03 §2.3]).
  final String id;

  final String staffId;

  /// Modal awal laci.
  final int openingBalanceMinor;

  /// Uang fisik hasil hitung saat tutup shift. `0` selama shift terbuka.
  final int closingBalanceMinor;

  /// `opening + Σ(transaksi COMPLETED bermetode CASH)` — **dihitung klien**;
  /// server tidak menghitung ulang ([02 §2.11]).
  final int expectedBalanceMinor;

  /// `closing − expected`. Negatif berarti kas kurang.
  final int discrepancyMinor;

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
      ];
}
