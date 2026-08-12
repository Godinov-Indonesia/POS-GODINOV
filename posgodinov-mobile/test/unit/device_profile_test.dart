import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/device_profile.dart';
import 'package:posgodinov_mobile/shared/theme/breakpoints.dart';

void main() {
  group('resolveDeviceProfile — perangkat nyata', () {
    test('handheld Sunmi V2 (360 dp portrait)', () {
      expect(resolveDeviceProfile(360), DeviceProfile.handheld);
    });

    test('tablet 8" mdpi (1024 dp) mendapat grid 4 kolom', () {
      // Nama profil merujuk anggaran dp, bukan diagonal fisik: 1024 dp memang
      // muat 4 kolom walau perangkatnya 8 inci.
      expect(resolveDeviceProfile(1024), DeviceProfile.tablet10);
    });

    test('tablet 10" landscape mdpi (1280 dp) — target utama', () {
      expect(resolveDeviceProfile(1280), DeviceProfile.tablet10);
    });

    test('tablet 10" hdpi (853 dp) turun ke grid 3 kolom', () {
      // Densitas hdpi menyisakan 853 dp; menjejalkan 4 kolom ke ruang ini
      // membuat tile produk terlalu sempit untuk nama F&B dua baris.
      final DeviceProfile profile = resolveDeviceProfile(853);
      expect(profile, DeviceProfile.tablet8);
      expect(PosLayout.of(profile).gridColumns, 3);
      // Tetap split-screen — keranjang tidak boleh hilang.
      expect(PosLayout.of(profile).hasSplitScreen, isTrue);
    });

    test('layar sangat lebar mengunci lebar keranjang', () {
      final DeviceProfile profile = resolveDeviceProfile(1600);
      expect(profile, DeviceProfile.tabletWide);
      expect(PosLayout.of(profile).cartFixedWidth, isNotNull);
    });
  });

  group('resolveDeviceProfile — batas ambang', () {
    test('tepat di ambang handheld sudah dianggap tablet', () {
      expect(
        resolveDeviceProfile(Breakpoints.handheldMax - 1),
        DeviceProfile.handheld,
      );
      expect(
        resolveDeviceProfile(Breakpoints.handheldMax),
        DeviceProfile.tablet8,
      );
    });

    test('tepat di ambang tablet10 berpindah ke layar lebar', () {
      expect(
        resolveDeviceProfile(Breakpoints.tablet10Max - 1),
        DeviceProfile.tablet10,
      );
      expect(
        resolveDeviceProfile(Breakpoints.tablet10Max),
        DeviceProfile.tabletWide,
      );
    });
  });

  group('PosLayout', () {
    test('tablet 10" memakai split 62/38 dengan grid 4 kolom [06 §3.2]', () {
      const PosLayout layout = PosLayout.tablet10;
      expect(layout.productFlex, 62);
      expect(layout.cartFlex, 38);
      expect(layout.gridColumns, 4);
    });

    test('handheld tidak punya panel keranjang permanen', () {
      expect(DeviceProfile.handheld.hasPersistentCartPanel, isFalse);
      expect(PosLayout.handheld.cartFlex, 0);
      expect(PosLayout.handheld.gridColumns, 2);
    });

    test('hanya handheld yang berorientasi portrait', () {
      for (final DeviceProfile p in DeviceProfile.values) {
        expect(
          p.isPortrait,
          p == DeviceProfile.handheld,
          reason: p.name,
        );
      }
    });
  });
}
