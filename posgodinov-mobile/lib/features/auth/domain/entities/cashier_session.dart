import 'package:equatable/equatable.dart';

/// Sesi kasir yang sedang bertugas.
///
/// Berumur satu shift dan **sepenuhnya lokal** — backend tidak mengenal sesi
/// kasir sama sekali ([01 §4.5]). Yang sampai ke server hanyalah `staff_id` di
/// dalam payload shift dan waste.
class CashierSession extends Equatable {
  const CashierSession({
    required this.staffId,
    required this.staffIdentifier,
    required this.name,
    required this.loginAt,
  });

  /// UUID staff dari master data — nilai inilah yang dikirim sebagai
  /// `staff_id` saat sinkronisasi ([03 §2.3]).
  final String staffId;

  final String staffIdentifier;
  final String name;
  final DateTime loginAt;

  /// Nama pendek untuk StatusBar, mis. `Siti Aminah` → `Siti A.` ([06 §4.7]).
  ///
  /// Slot kasir di StatusBar sempit; nama panjang akan terpotong elipsis di
  /// tempat yang tidak terduga.
  String get shortName {
    final List<String> parts =
        name.trim().split(RegExp(r'\s+')).where((String p) => p.isNotEmpty)
            .toList(growable: false);

    if (parts.length < 2) return name.trim();
    return '${parts.first} ${parts[1].substring(0, 1)}.';
  }

  @override
  List<Object?> get props =>
      <Object?>[staffId, staffIdentifier, name, loginAt];
}
