import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/printer/receipt_printer.dart';

/// Menyimpan printer yang dipilih kasir.
///
/// Memakai tabel `sync_meta`, **bukan** `flutter_secure_storage`: alamat MAC
/// printer bukan rahasia, dan menaruhnya di KeyStore hanya memperlambat
/// pembacaan pada setiap start tanpa menambah keamanan apa pun.
class PrinterPreferences {
  const PrinterPreferences(this._syncDao, {DateTime Function()? now})
      : _now = now ?? DateTime.now;

  final SyncDao _syncDao;
  final DateTime Function() _now;

  static const String _keyKind = 'printer_kind';
  static const String _keyId = 'printer_id';
  static const String _keyName = 'printer_name';

  Future<PrinterTarget?> readTarget() async {
    final String? kindName = await _syncDao.readMeta(_keyKind);
    final String? id = await _syncDao.readMeta(_keyId);
    if (kindName == null || id == null || id.isEmpty) return null;

    // Nama enum yang tidak dikenal berarti versi aplikasi lama menyimpan
    // transport yang sudah tidak ada — perlakukan sebagai "belum ada printer",
    // bukan melempar saat aplikasi start.
    final PrinterKind? kind = _parseKind(kindName);
    if (kind == null) return null;

    return PrinterTarget(
      id: id,
      name: await _syncDao.readMeta(_keyName) ?? id,
      kind: kind,
    );
  }

  Future<void> saveTarget(PrinterTarget target) async {
    final DateTime now = _now();
    await _syncDao.writeMeta(_keyKind, target.kind.name, now);
    await _syncDao.writeMeta(_keyId, target.id, now);
    await _syncDao.writeMeta(_keyName, target.name, now);
  }

  Future<void> clear() async {
    final DateTime now = _now();
    await _syncDao.writeMeta(_keyKind, '', now);
    await _syncDao.writeMeta(_keyId, '', now);
    await _syncDao.writeMeta(_keyName, '', now);
  }

  PrinterKind? _parseKind(String name) {
    for (final PrinterKind k in PrinterKind.values) {
      if (k.name == name) return k;
    }
    return null;
  }
}
