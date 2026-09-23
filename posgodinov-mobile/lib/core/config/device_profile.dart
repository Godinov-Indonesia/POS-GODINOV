/// Klasifikasi perangkat berdasarkan lebar layar.
///
/// Dart murni — tanpa impor Flutter — agar dapat diuji tanpa binding widget.
/// Pembungkus `context.profile` ada di `shared/extensions/context_ext.dart`.
library;

/// Kelas perangkat yang menentukan tata letak ([09 §3.1]).
enum DeviceProfile {
  /// Handheld POS Sunmi/iMin — ±360 dp, **portrait dikunci**.
  handheld,

  /// Tablet 8" — 1024 × 768 px.
  tablet8,

  /// **Target utama (P0)** — tablet 10" 1280 × 800 px, *landscape* dikunci.
  tablet10,

  /// Desktop kasir / tablet besar — keranjang dikunci lebar tetap.
  tabletWide;

  /// `true` bila perangkat dioperasikan dalam orientasi tegak.
  bool get isPortrait => this == DeviceProfile.handheld;

  /// `true` bila keranjang tampil sebagai panel permanen, bukan *bottom sheet*.
  bool get hasPersistentCartPanel => this != DeviceProfile.handheld;
}

/// Ambang batas lebar, dalam **dp** — bukan piksel.
///
/// Dokumen [06 §3.1] menuliskan ambangnya dalam piksel CSS; di sini
/// diterjemahkan ke dp karena itulah satuan yang dipakai Flutter.
///
/// | Perangkat | Piksel | Densitas | Lebar dp | Profil |
/// |---|---|---|---|---|
/// | Handheld Sunmi V2 | 720 × 1280 | xhdpi | **360** (portrait) | `handheld` |
/// | Tablet 10" hdpi | 1280 × 800 | hdpi | **853** | `tablet8` |
/// | Tablet 8" mdpi | 1024 × 768 | mdpi | **1024** | `tablet10` |
/// | Tablet 10" mdpi | 1280 × 800 | mdpi | **1280** | `tablet10` |
///
/// > ⚠️ **Nama profil merujuk anggaran ruang, bukan diagonal fisik.** Karena dp
/// > sudah menormalkan densitas, tablet 10" berdensitas tinggi bisa saja
/// > memiliki dp lebih sedikit daripada tablet 8" mdpi — dan memang layak
/// > mendapat kolom grid lebih sedikit. Mengklasifikasi berdasarkan ukuran
/// > fisik justru akan menjejalkan 4 kolom ke ruang yang hanya muat 3.
abstract final class Breakpoints {
  /// Di bawah ini: handheld POS, keranjang menjadi *bottom sheet*.
  static const double handheldMax = 600;

  /// Di bawah ini: split-screen sempit, grid 3 kolom.
  static const double tablet8Max = 900;

  /// Di bawah ini: split-screen 62/38, grid 4 kolom — **target utama**.
  /// Di atasnya: keranjang dikunci lebar tetap, grid 6 kolom.
  static const double tablet10Max = 1400;
}

/// Memetakan lebar layar (dp) ke [DeviceProfile].
///
/// Fungsi bebas agar dapat diuji langsung:
/// ```dart
/// expect(resolveDeviceProfile(1280), DeviceProfile.tablet10);
/// ```
DeviceProfile resolveDeviceProfile(double widthDp) {
  if (widthDp < Breakpoints.handheldMax) return DeviceProfile.handheld;
  if (widthDp < Breakpoints.tablet8Max) return DeviceProfile.tablet8;
  if (widthDp < Breakpoints.tablet10Max) return DeviceProfile.tablet10;
  return DeviceProfile.tabletWide;
}
