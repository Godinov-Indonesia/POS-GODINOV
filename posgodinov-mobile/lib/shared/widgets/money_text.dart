import 'package:flutter/material.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';

/// Ukuran nominal pada skala POS ([06 §2.3]).
enum MoneySize {
  /// 14 dp — nominal sekunder. **Batas bawah**; jangan dipakai untuk total.
  sm,

  /// 18 dp — nominal baris keranjang, harga di tile produk.
  md,

  /// 22 dp — subtotal.
  lg,

  /// 28 dp — total keranjang, saldo shift.
  xl,

  /// 40 dp — total di modal bayar, nominal kembalian.
  xxl,
}

/// Nada warna nominal.
enum MoneyTone {
  normal,
  muted,

  /// Kembalian, badge lunas, selisih shift lebih.
  success,

  /// Selisih shift kurang, kekurangan bayar, nominal void.
  danger,
}

/// **Satu-satunya cara merender nominal uang di seluruh aplikasi.**
///
/// ## Mengapa monospace wajib
///
/// Alasannya bukan estetika ([06 §2.4]):
///
/// 1. **Pemindaian kolom.** Digit berlebar sama membuat `Rp 22.000` dan
///    `Rp 220.000` berbeda panjang secara proporsional — kasir mendeteksi
///    kesalahan orde besaran secara visual tanpa membaca angkanya.
/// 2. **Tidak ada goyangan.** Total yang berubah dari `Rp 99.000` ke
///    `Rp 100.000` tidak menggeser tata letak. Tanpa `tabularFigures`, total
///    "berdenyut" setiap penambahan item.
/// 3. **Kesejajaran kanan.** Kolom nominal rata kanan hanya bekerja benar
///    dengan lebar digit tetap.
///
/// ## Lima larangan
///
/// | # | Larangan | Alasan |
/// |---|---|---|
/// | 1 | `Text('Rp $x')` di mana pun | Melewati widget ini = melewati monospace, minus tipografis, dan `Semantics` |
/// | 2 | Menampilkan desimal sen | Sen adalah detail internal, bukan realitas Rupiah |
/// | 3 | Singkatan `Rp 1,2jt` di layar kasir | Ambigu saat menghitung uang fisik |
/// | 4 | Nominal < 16 dp atau berwarna `fgSubtle` | Batas bawah [06 §2.3] |
/// | 5 | Aritmetika uang di dalam widget | Widget menerima hasil dari `cart_math` / `shift_math` |
class MoneyText extends StatelessWidget {
  const MoneyText(
    this.minor, {
    super.key,
    this.size = MoneySize.md,
    this.tone = MoneyTone.normal,
    this.signed = false,
    this.textAlign,
  });

  /// Nominal dalam **INTEGER SEN**.
  ///
  /// Widget ini tidak pernah menerima `double`; bila pemanggil memegang Rupiah,
  /// konversinya sudah harus terjadi di batas API lewat `Money.toMinor`.
  final int minor;

  final MoneySize size;
  final MoneyTone tone;

  /// Menampilkan tanda `+` eksplisit untuk nilai positif — selisih shift dan
  /// kembalian.
  final bool signed;

  final TextAlign? textAlign;

  TextStyle get _baseStyle => switch (size) {
        MoneySize.sm => PosText.moneySm,
        MoneySize.md => PosText.moneyMd,
        MoneySize.lg => PosText.moneyLg,
        MoneySize.xl => PosText.moneyXl,
        MoneySize.xxl => PosText.money2xl,
      };

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    final Color color = switch (tone) {
      MoneyTone.normal => tokens.fg,
      MoneyTone.muted => tokens.fgMuted,
      // emerald700, bukan emerald600 — hanya varian ini yang lolos AA di latar
      // terang ([06 §1.5]).
      MoneyTone.success => tokens.successText,
      MoneyTone.danger => tokens.danger,
    };

    final String text = signed ? Money.formatSigned(minor) : Money.format(minor);

    return Semantics(
      // Pembaca layar melafalkan nominal sebagai satu kalimat utuh, bukan
      // "R-p titik dua dua titik nol nol nol".
      label: text,
      excludeSemantics: true,
      child: Text(
        text,
        textAlign: textAlign,
        maxLines: 1,
        softWrap: false,
        overflow: TextOverflow.visible,
        style: _baseStyle.copyWith(color: color),
      ),
    );
  }
}
