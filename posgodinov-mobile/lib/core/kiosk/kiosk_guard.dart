import 'package:posgodinov_mobile/core/crypto/pin_verifier.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';

/// Gerbang keluar mode Kiosk.
///
/// # Dua lapis, keduanya disengaja
///
/// 1. **Ketukan tersembunyi.** Tidak ada tombol "keluar" yang terlihat;
///    pelanggan tidak boleh menemukan jalan keluar secara tidak sengaja.
/// 2. **PIN staff.** Memakai [PinVerifier] **yang sama** dengan login kasir —
///    tidak ada PIN kedua, dan **tidak ada kode master yang di-*hard-code***.
///    Kode master adalah rahasia bersama yang bocor pada pemasangan pertama.
class KioskGuard {
  KioskGuard({
    required MasterDao masterDao,
    PinVerifier verifier = const PinVerifier(),
    int tapsRequired = 5,
    Duration tapWindow = const Duration(seconds: 3),
    DateTime Function()? now,
  })  : _masterDao = masterDao,
        _verifier = verifier,
        _tapsRequired = tapsRequired,
        _tapWindow = tapWindow,
        _now = now ?? DateTime.now;

  final MasterDao _masterDao;
  final PinVerifier _verifier;
  final int _tapsRequired;
  final Duration _tapWindow;
  final DateTime Function() _now;

  final List<DateTime> _taps = <DateTime>[];

  /// Mencatat satu ketukan pada area tersembunyi.
  ///
  /// Mengembalikan `true` bila jumlah ketukan dalam jendela waktu sudah cukup
  /// untuk memunculkan dialog PIN.
  bool registerTap() {
    final DateTime now = _now();
    _taps
      ..add(now)
      ..removeWhere((DateTime t) => now.difference(t) > _tapWindow);

    if (_taps.length >= _tapsRequired) {
      _taps.clear();
      return true;
    }
    return false;
  }

  void reset() => _taps.clear();

  /// Memverifikasi PIN staff mana pun di outlet ini.
  ///
  /// Berbeda dari login kasir, di sini identifier tidak diminta: pelanggan tidak
  /// boleh melihat daftar staff, dan staf yang membuka Kiosk sudah jelas hadir
  /// secara fisik. PIN dicocokkan terhadap seluruh staff outlet.
  ///
  /// > **Biayanya nyata.** bcrypt dijalankan sekali per staff, masing-masing
  /// > 100–300 ms; outlet dengan 10 kasir memakan ~2–3 detik. Itu dapat
  /// > diterima untuk gerbang yang ditekan beberapa kali sehari, dan
  /// > kelambatannya justru menyulitkan penebakan PIN secara beruntun.
  /// > Perulangan **tidak** dihentikan lebih awal saat cocok pada staff
  /// > pertama — itu akan membocorkan urutan melalui waktu respons.
  Future<bool> verifyExitPin(String pin) async {
    if (pin.isEmpty) return false;

    final List<Staff> staffs = await _masterDao.allStaffs();
    if (staffs.isEmpty) return false;

    bool cocok = false;
    for (final Staff s in staffs) {
      // Sengaja TIDAK `return` saat cocok: keluar lebih awal membuat PIN milik
      // staff pertama terverifikasi jauh lebih cepat daripada staff terakhir,
      // dan selisih itu dapat diukur.
      if (await _verifier.verify(pin: pin, pinHash: s.pinHash)) cocok = true;
    }
    return cocok;
  }
}
