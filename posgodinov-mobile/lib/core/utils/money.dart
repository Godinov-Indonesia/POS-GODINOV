import 'package:intl/intl.dart';

/// Aritmetika dan pemformatan uang — **ADR-05, integer sen** ([09 §3.5]).
///
/// ## Aturan induk
///
/// Seluruh nominal di dalam aplikasi — state, basis data, aritmetika — adalah
/// `int` **sen**. `double` tidak pernah menyentuh uang. Alasannya bukan
/// kerapian: `0.1 + 0.2 != 0.3` pada IEEE-754, dan kesalahan pembulatan pada
/// total keranjang berarti selisih kas yang harus dipertanggungjawabkan kasir
/// di akhir shift.
///
/// ## Konversi hanya terjadi di tiga titik
///
/// 1. **Batas API masuk** — [toMinor], saat membaca harga dari master data.
/// 2. **Batas API keluar** — [toMajor], saat mengirim payload sinkronisasi.
/// 3. **Tampilan** — [format], dipanggil eksklusif oleh `MoneyText`.
///
/// Di luar ketiganya, nominal berpindah sebagai `int` apa adanya.
abstract final class Money {
  /// Rupiah → sen. Dipakai saat membaca respons server.
  ///
  /// Server mengirim `22000` (Rupiah) pada master data; state internal menyimpan
  /// `2200000` (sen).
  static int toMinor(num major) => (major * 100).round();

  /// Sen → Rupiah desimal. Dipakai saat menyusun payload sinkronisasi.
  ///
  /// Kolom server bertipe `DECIMAL(15,2)` ([02 §2.12]), sehingga nilai pecahan
  /// tetap sah walau dalam praktik seluruh harga adalah Rupiah bulat.
  static num toMajor(int minor) => minor / 100;

  static final NumberFormat _idr = NumberFormat.currency(
    locale: 'id_ID',
    symbol: 'Rp ',
    decimalDigits: 0,
  );

  /// Sen → teks siap tampil, mis. `2200000` → `Rp 22.000`.
  ///
  /// **Enam aturan tampilan** ([06 §2.5]):
  ///
  /// 1. **Tanpa desimal.** Sen adalah detail representasi internal, bukan
  ///    realitas Rupiah.
  /// 2. **Pemisah ribuan titik**, dijamin locale `id_ID`. Jangan pernah
  ///    memformat manual dengan `replaceAll`.
  /// 3. **Nol tampil sebagai `Rp 0`**, bukan `-` maupun string kosong —
  ///    placeholder menciptakan ambiguitas antara "nol" dan "tidak diketahui".
  /// 4. **Negatif memakai minus tipografis `−` (U+2212)**, bukan tanda hubung.
  /// 5. **Tanpa singkatan** di layar kasir. `Rp 1,2jt` dilarang.
  /// 6. Konversi hanya di tiga titik — lihat catatan kelas.
  ///
  /// > Pembulatan mengikuti perilaku `Intl.NumberFormat` dan **harus tetap
  /// > identik dengan `formatIdr()` di Web** ([06 §2.5]): kedua platform
  /// > mencetak struk untuk transaksi yang sama, dan nominalnya tidak boleh
  /// > berbeda satu Rupiah pun.
  static String format(int minor) {
    final String formatted = _idr.format(minor / 100);
    // `Intl` menghasilkan `-Rp 15.000`; normalkan ke minus tipografis.
    return formatted.startsWith('-')
        ? formatted.replaceFirst('-', '−')
        : formatted;
  }

  /// Varian [format] dengan tanda `+` eksplisit untuk nilai positif.
  ///
  /// Dipakai selisih shift dan kembalian, tempat arah selisih sama pentingnya
  /// dengan besarnya.
  static String formatSigned(int minor) {
    if (minor > 0) return '+${format(minor)}';
    return format(minor);
  }
}
