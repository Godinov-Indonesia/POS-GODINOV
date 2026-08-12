import 'package:posgodinov_mobile/core/config/device_profile.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Spesifikasi tata letak POS per [DeviceProfile].
///
/// Angka-angka ini adalah terjemahan langsung tabel [06 §3.2] / [09 §3.2].
/// Menaruhnya di satu tempat mencegah setiap layar menghitung ulang jumlah
/// kolom grid dengan rumus buatannya sendiri.
class PosLayout {
  const PosLayout({
    required this.productFlex,
    required this.cartFlex,
    required this.gridColumns,
    required this.tileHeight,
    required this.gutter,
    required this.panelPadding,
    required this.statusBarHeight,
    this.cartFixedWidth,
  });

  /// Bobot panel produk pada `Row`. `0` bila keranjang memakai lebar tetap.
  final int productFlex;

  /// Bobot panel keranjang. `0` bila memakai [cartFixedWidth].
  final int cartFlex;

  /// Jumlah kolom grid produk.
  final int gridColumns;

  final double tileHeight;
  final double gutter;
  final double panelPadding;
  final double statusBarHeight;

  /// Bila terisi, keranjang memakai lebar tetap alih-alih [cartFlex].
  final double? cartFixedWidth;

  /// `true` bila keranjang dirender sebagai kolom kanan permanen.
  bool get hasSplitScreen => productFlex > 0 || cartFixedWidth != null;

  /// **Target utama (P0).** Split 62/38 pada tablet 10" 1280 × 800.
  static const PosLayout tablet10 = PosLayout(
    productFlex: 62,
    cartFlex: 38,
    gridColumns: 4,
    tileHeight: 150,
    gutter: Gap.md,
    panelPadding: Gap.lg,
    statusBarHeight: Sizes.statusBarTablet,
  );

  static const PosLayout tablet8 = PosLayout(
    productFlex: 60,
    cartFlex: 40,
    gridColumns: 3,
    tileHeight: 150,
    gutter: 10,
    panelPadding: Gap.md,
    statusBarHeight: Sizes.statusBarTablet,
  );

  /// Keranjang dikunci 420 dp; sisa lebar diberikan ke grid produk.
  static const PosLayout tabletWide = PosLayout(
    productFlex: 1,
    cartFlex: 0,
    gridColumns: 6,
    tileHeight: 150,
    gutter: Gap.md,
    panelPadding: 20,
    statusBarHeight: Sizes.statusBarTablet,
    cartFixedWidth: Sizes.cartPanelFixedWidth,
  );

  /// Mode *degraded*: keranjang menjadi *bottom sheet* + bar ringkasan permanen
  /// ([06 §3.7]). Prinsip "keranjang tidak pernah hilang" dipertahankan lewat
  /// bar ringkasan, bukan lewat panel.
  static const PosLayout handheld = PosLayout(
    productFlex: 1,
    cartFlex: 0,
    gridColumns: 2,
    tileHeight: 132,
    gutter: Gap.sm,
    panelPadding: Gap.md,
    statusBarHeight: Sizes.statusBarHandheld,
  );

  static PosLayout of(DeviceProfile profile) => switch (profile) {
        DeviceProfile.handheld => handheld,
        DeviceProfile.tablet8 => tablet8,
        DeviceProfile.tablet10 => tablet10,
        DeviceProfile.tabletWide => tabletWide,
      };
}

/// Tata letak khusus mode Kiosk ([09 §3.6]).
///
/// Tema dan token identik dengan mode kasir; yang berbeda adalah ukuran dan
/// kosakata interaksi — penggunanya pelanggan, bukan kasir terlatih.
abstract final class KioskLayout {
  static const int gridColumns = 3;
  static const double tileWidth = 240;
  static const double tileHeight = 260;
  static const double productNameSize = 20;

  /// Bilah keranjang yang menempel di bawah.
  static const double cartBarHeight = 96;

  /// Tanpa sentuhan selama ini, keranjang dikosongkan dan layar kembali ke
  /// sambutan. Pelanggan yang pergi tidak boleh meninggalkan pesanan setengah
  /// jadi untuk orang berikutnya.
  static const Duration idleTimeout = Duration(seconds: 90);
}
