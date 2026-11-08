import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/core/config/device_profile.dart';
import 'package:posgodinov_mobile/shared/theme/breakpoints.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';

/// Pintasan yang membuat aturan desain nyaman dipatuhi.
///
/// Bila mengambil token warna lebih merepotkan daripada mengetik nilai
/// heksadesimal, cepat atau lambat seseorang akan mengetik nilai heksadesimal.
extension GodinovContext on BuildContext {
  /// **Lapis 2** token semantik — satu-satunya sumber warna bagi widget.
  ///
  /// ```dart
  /// color: context.tokens.accent   // ✅
  /// color: GodinovColors.blue600   // ❌ dilarang import_lint
  /// ```
  ///
  /// Melempar bila [GodinovTokens] belum terpasang di `ThemeData.extensions` —
  /// itu kesalahan perakitan tema, bukan kondisi yang perlu ditangani widget.
  GodinovTokens get tokens => Theme.of(this).extension<GodinovTokens>()!;

  /// Kelas perangkat berdasarkan lebar layar saat ini.
  ///
  /// Memakai `MediaQuery.sizeOf` agar widget hanya dibangun ulang saat **ukuran**
  /// berubah, bukan saat metrik lain (padding, keyboard) berubah.
  DeviceProfile get profile =>
      resolveDeviceProfile(MediaQuery.sizeOf(this).width);

  /// Spesifikasi tata letak untuk perangkat saat ini — flex panel, jumlah
  /// kolom grid, gutter, padding.
  PosLayout get layout => PosLayout.of(profile);

  /// `true` pada handheld POS, tempat keranjang menjadi *bottom sheet*.
  bool get isHandheld => profile == DeviceProfile.handheld;
}
