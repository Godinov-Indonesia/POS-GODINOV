import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Satu slot pada [PosBottomBar].
class PosBottomBarSlot {
  const PosBottomBarSlot({
    required this.icon,
    required this.label,
    required this.onTap,
    this.badge = 0,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  /// Lencana angka, mis. jumlah pesanan tertahan. `0` menyembunyikannya.
  final int badge;

  final bool active;
}

/// `PosBottomBar` — **butir 18** ([11 §M17.1]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// MENGAPA AKSI PINDAH KE BAWAH
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Zona jempol pada handheld POS 6" yang dipegang satu tangan mencakup sekitar
/// sepertiga bawah layar. Setiap `IconButton` di `AppBar` memaksa penyesuaian
/// genggaman — puluhan kali per jam pada jam sibuk. Ini bukan preferensi
/// estetika melainkan **biaya waktu per transaksi**, dan yang membayarnya
/// kasir.
///
/// Konsekuensinya mengikat header: `AppBar` menjadi KONTEKS murni — nama kasir
/// dan jam shift. Nol `IconButton`.
///
/// ═══════════════════════════════════════════════════════════════════════════
/// LIMA SLOT, DAN YANG KELIMA SELALU "LAINNYA"
/// ═══════════════════════════════════════════════════════════════════════════
///
/// Empat aksi utama muat di zona jempol pada layar 6"; slot kelima membuka
/// *bottom sheet*, bukan menu di atas. Menu yang terbuka ke ATAS mengembalikan
/// persis masalah yang bar ini selesaikan.
///
/// Batas lima bukan angka bulat yang dipilih sembarangan: pada lebar 360 dp,
/// enam slot menghasilkan target 60 dp — lebih sempit dari lebar jempol dewasa
/// (±45–57 dp), dan ketukan mulai mendarat di tetangganya.
class PosBottomBar extends StatelessWidget {
  const PosBottomBar({super.key, required this.slots, this.roomy = false});

  /// Maksimal LIMA. Slot ke-6 dan seterusnya diabaikan — lihat catatan kelas.
  final List<PosBottomBarSlot> slots;

  /// Varian tablet: bar lebih tinggi, ikon dan label lebih besar.
  ///
  /// Pada handheld 6" setiap dp vertikal diperebutkan grid produk, sehingga
  /// bar ditahan di 64 dp. Tablet 10" tidak punya keterbatasan itu — dan
  /// dilihat dari jarak lebih jauh, di atas meja, bukan digenggam. Ukuran
  /// adalah SATU-SATUNYA pembeda kedua varian: susunan, urutan, dan perilaku
  /// slot identik, supaya kasir yang pindah perangkat tidak perlu belajar
  /// ulang.
  final bool roomy;

  /// Tinggi bar itu sendiri, di luar area aman perangkat.
  static const double height = 64;

  /// Tinggi varian [roomy].
  static const double heightRoomy = 72;

  /// Batas keras jumlah slot.
  static const int maxSlots = 5;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    // `viewPadding.bottom`, BUKAN `padding.bottom`.
    //
    // `padding` menjadi nol ketika papan ketik terbuka, sehingga bar melompat
    // naik lalu turun setiap kali kasir mengetik. `viewPadding` melaporkan
    // takik perangkat apa adanya, terlepas dari papan ketik.
    final double safeBottom = MediaQuery.of(context).viewPadding.bottom;

    final List<PosBottomBarSlot> visible =
        slots.length > maxSlots ? slots.sublist(0, maxSlots) : slots;

    return Container(
      // Area aman DITAMBAHKAN di bawah 64 dp, bukan memakannya. Menghitungnya
      // ke dalam tinggi bar akan menyusutkan target sentuh menjadi ±30 dp pada
      // perangkat berponi.
      height: (roomy ? heightRoomy : height) + safeBottom,
      padding: EdgeInsets.only(bottom: safeBottom),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(top: BorderSide(color: t.border)),
      ),
      child: Row(
        children: <Widget>[
          for (final PosBottomBarSlot slot in visible)
            Expanded(child: _BarButton(slot: slot, roomy: roomy)),
        ],
      ),
    );
  }
}

class _BarButton extends StatelessWidget {
  const _BarButton({required this.slot, required this.roomy});

  final PosBottomBarSlot slot;
  final bool roomy;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;
    final Color color = slot.active ? t.accent : t.fgMuted;

    return Semantics(
      button: true,
      selected: slot.active,
      label: slot.label,
      child: InkWell(
        onTap: slot.onTap,
        // Seluruh kolom menjadi target sentuh, bukan hanya ikonnya.
        child: Stack(
          alignment: Alignment.center,
          children: <Widget>[
            // Penanda aktif berupa GARIS di tepi atas, bukan warna saja
            // ([06 §1.5]). 8% pria mengalami defisiensi penglihatan
            // merah-hijau.
            if (slot.active)
              Positioned(
                top: 0,
                left: Gap.md,
                right: Gap.md,
                child: Container(
                  height: 2,
                  decoration: BoxDecoration(
                    color: t.accent,
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(2),
                    ),
                  ),
                ),
              ),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                _IconWithBadge(
                  icon: slot.icon,
                  badge: slot.badge,
                  color: color,
                  size: roomy ? 28 : 24,
                ),
                SizedBox(height: roomy ? 4 : 2),
                // Label teks SELALU ditampilkan, tidak pernah hanya ikon.
                // Ikon tanpa label menuntut kasir menghafal, dan kasir baru
                // pada shift pertamanya adalah orang yang paling sering
                // menekan tombol yang salah.
                Text(
                  slot.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: (roomy ? PosText.sm : PosText.xs).copyWith(
                    color: color,
                    fontWeight: slot.active ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _IconWithBadge extends StatelessWidget {
  const _IconWithBadge({
    required this.icon,
    required this.badge,
    required this.color,
    required this.size,
  });

  final IconData icon;
  final int badge;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    if (badge <= 0) return Icon(icon, size: size, color: color);

    return Stack(
      clipBehavior: Clip.none,
      children: <Widget>[
        Icon(icon, size: size, color: color),
        Positioned(
          right: -6,
          top: -4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: t.warning,
              borderRadius: BorderRadius.circular(Radii.sm),
            ),
            child: Text(
              badge > 9 ? '9+' : '$badge',
              style: PosText.xs.copyWith(
                color: t.fg,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
