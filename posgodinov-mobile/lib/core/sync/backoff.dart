import 'dart:math';

/// Penundaan percobaan ulang setelah kegagalan sinkronisasi ([09 §6.4]).
///
/// > **Tidak ada batas percobaan.** Setelah sekian kegagalan, interval berhenti
/// > bertambah di [maxDelay] dan mesin **terus mencoba selamanya**. Baris yang
/// > berulang kali gagal dinaikkan ke P-13 sebagai peringatan yang terlihat,
/// > tetapi tidak pernah dibuang. Ini data keuangan; menyerah bukan pilihan.
class Backoff {
  const Backoff({Random? random}) : _random = random;

  final Random? _random;

  static const Duration baseDelay = Duration(seconds: 5);
  static const Duration maxDelay = Duration(minutes: 5);

  /// ±20 % agar banyak perangkat dalam satu outlet tidak menyerbu server
  /// bersamaan setelah listrik atau Wi-Fi pulih.
  static const double jitterRatio = 0.2;

  /// Penundaan untuk kegagalan beruntun ke-[consecutiveFailures] (mulai dari 1).
  Duration nextDelay(int consecutiveFailures) {
    if (consecutiveFailures <= 0) return Duration.zero;

    // Batasi pangkat sebelum menggeser bit: `1 << 40` pada perangkat 32-bit
    // menghasilkan nilai yang tidak masuk akal, dan kegagalan beruntun sebanyak
    // itu sangat mungkin terjadi pada perangkat yang berhari-hari offline.
    final int exponent = min(consecutiveFailures - 1, 20);
    final int rawMs = baseDelay.inMilliseconds * (1 << exponent);
    final int cappedMs = min(rawMs, maxDelay.inMilliseconds);

    final Random rnd = _random ?? Random();
    final double jitter = (rnd.nextDouble() * 2 - 1) * jitterRatio;
    final int withJitter = (cappedMs * (1 + jitter)).round();

    // Jangan pernah menghasilkan penundaan negatif atau nol.
    return Duration(milliseconds: max(withJitter, 100));
  }
}
