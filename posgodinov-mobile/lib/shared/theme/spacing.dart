/// Skala sentuh dan jarak — *fat-finger proof standard* ([06 §2.1] / [09 §3.4]).
///
/// Ukuran diturunkan dari **konsekuensi kesalahan**, bukan dari kepadatan
/// visual. Semakin sulit sebuah aksi dibatalkan, semakin besar targetnya.
library;

/// Tinggi/lebar minimum area sentuh, dalam dp.
abstract final class Touch {
  /// **48 dp — batas bawah absolut.** Ikon toolbar, tombol tutup, baris daftar.
  ///
  /// Salah tekan berakibat navigasi keliru yang mudah dibatalkan.
  static const double standard = 48;

  /// **56 dp** — numpad, keypad PIN, stepper `+`/`−`, tab kategori.
  ///
  /// Salah tekan mengubah kuantitas: dapat dikoreksi, tetapi memperlambat.
  static const double frequent = 56;

  /// **64 dp** — tombol Bayar di CartPanel, konfirmasi transaksi.
  ///
  /// Salah tekan mengirim transaksi sebelum waktunya.
  static const double primary = 64;

  /// **72 dp** — preset Fast-Cash, tombol `BAYAR` di modal pembayaran.
  ///
  /// Salah tekan membuat nominal atau kembalian keliru — **uang fisik keluar
  /// salah**. Inilah kelas paling mahal.
  static const double critical = 72;

  /// Target sentuh mode Kiosk ([09 §3.6]).
  ///
  /// Lebih besar dari [standard] karena penggunanya pelanggan yang tidak
  /// terlatih dan hanya memakai perangkat sekali.
  static const double kiosk = 64;
}

/// Jarak antar elemen, dalam dp.
abstract final class Gap {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// Jarak minimum antar dua target sentuh biasa.
  static const double betweenTargets = sm;

  /// **Jarak minimum bila salah satu target destruktif.**
  ///
  /// Tombol `Void` tidak pernah bersebelahan langsung dengan `Bayar`
  /// ([06 §2.2]).
  static const double destructive = xl;
}

/// Radius sudut.
abstract final class Radii {
  static const double sm = 8;

  /// Standar tombol, input, dan kartu.
  static const double md = 12;

  /// Tile produk.
  static const double lg = 16;

  /// Modal pembayaran.
  static const double xl = 24;
}

/// Tinggi elemen kerangka yang dipakai lintas layar.
abstract final class Sizes {
  /// StatusBar POS pada tablet ([06 §4.7]).
  static const double statusBarTablet = 56;

  /// StatusBar ringkas pada handheld.
  static const double statusBarHandheld = 48;

  /// Bar ringkasan keranjang yang menempel di bawah pada handheld ([06 §3.7]).
  static const double cartSummaryBar = 72;

  /// Lebar keranjang saat dikunci pada layar lebar ([06 §3.2]).
  ///
  /// Panel keranjang tidak menjadi lebih berguna saat melebar — ia hanya
  /// menambah jarak pandang antara nama item dan nominalnya. Lebar berlebih
  /// dialokasikan ke grid produk.
  static const double cartPanelFixedWidth = 420;
}
