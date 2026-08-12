/// Preset *Fast-Cash* pada modal pembayaran ([06 §4.6.3]).
///
/// Tiga lapis, dari yang paling sering ke paling jarang:
///
/// ```text
/// Lapis 1 — UANG PAS            lebar penuh · 72 dp
/// Lapis 2 — pembulatan cerdas   3 tombol · 72 dp · dihitung dari total
/// Lapis 3 — pecahan tetap       Rp 20rb · Rp 50rb · Rp 100rb · 72 dp
///                               (dinonaktifkan bila nilainya < total)
/// ```
///
/// Seluruh nilai **INTEGER SEN**.
abstract final class FastCash {
  static const int _sen = 100;

  /// Kelipatan lazim untuk pembulatan ke atas.
  static const List<int> _steps = <int>[5000, 10000, 50000, 100000];

  /// Pecahan fisik yang benar-benar dibawa pelanggan Indonesia.
  static const List<int> fixedDenoms = <int>[
    20000 * _sen,
    50000 * _sen,
    100000 * _sen,
  ];

  /// Pembulatan ke atas ke setiap kelipatan lazim, membuang yang tidak melebihi
  /// total.
  ///
  /// Memakai pembagian **bilangan bulat** (`(n + step - 1) ~/ step`), bukan
  /// `(n / step).ceil()`: pembagian ganda pada nominal besar dapat kehilangan
  /// presisi dan menghasilkan preset yang meleset satu Rupiah.
  static List<int> smartRoundUps(int totalMinor) {
    if (totalMinor <= 0) return const <int>[];

    final Set<int> hasil = <int>{};
    for (final int rupiah in _steps) {
      final int step = rupiah * _sen;
      final int dibulatkan = ((totalMinor + step - 1) ~/ step) * step;
      if (dibulatkan > totalMinor) hasil.add(dibulatkan);
    }
    return hasil.toList()..sort();
  }

  /// Tiga preset Lapis 2, dideduplikasi terhadap [fixedDenoms] agar tidak
  /// tampil ganda.
  static List<int> presets(int totalMinor) {
    final Set<int> tetap = fixedDenoms.toSet();
    return smartRoundUps(totalMinor)
        .where((int v) => !tetap.contains(v))
        .take(3)
        .toList(growable: false);
  }

  /// `true` bila pecahan tetap layak ditekan untuk total ini.
  ///
  /// Yang kurang dari total tetap **ditampilkan namun nonaktif** — bukan
  /// disembunyikan. Posisi tombol yang stabil antar-transaksi membuat kasir
  /// membangun memori otot; tombol yang berpindah-pindah menghancurkannya.
  static bool isDenomEnabled(int denomMinor, int totalMinor) =>
      denomMinor >= totalMinor;
}
