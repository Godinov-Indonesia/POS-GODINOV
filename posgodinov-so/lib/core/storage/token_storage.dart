import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  final FlutterSecureStorage _storage;

  TokenStorage([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  static const _keyDeviceToken = 'so_device_token';
  static const _keyOutletId = 'so_outlet_id';
  static const _keyBusinessId = 'so_business_id';
  static const _keyDeviceName = 'so_device_name';
  static const _keyActiveStaffId = 'so_active_staff_id';
  static const _keyActiveStaffName = 'so_active_staff_name';
  static const _keySyncedStaffs = 'so_synced_staffs';

  Future<void> saveDeviceSession({
    required String token,
    String? outletId,
    String? businessId,
    String? deviceName,
  }) async {
    await _storage.write(key: _keyDeviceToken, value: token);
    if (outletId != null) await _storage.write(key: _keyOutletId, value: outletId);
    if (businessId != null) await _storage.write(key: _keyBusinessId, value: businessId);
    if (deviceName != null) await _storage.write(key: _keyDeviceName, value: deviceName);
  }

  Future<String?> getDeviceToken() => _storage.read(key: _keyDeviceToken);
  Future<String?> getOutletId() => _storage.read(key: _keyOutletId);
  Future<String?> getBusinessId() => _storage.read(key: _keyBusinessId);
  Future<String?> getDeviceName() => _storage.read(key: _keyDeviceName);

  Future<void> saveActiveStaff({
    required String staffId,
    required String staffName,
  }) async {
    await _storage.write(key: _keyActiveStaffId, value: staffId);
    await _storage.write(key: _keyActiveStaffName, value: staffName);
  }

  Future<String?> getActiveStaffId() => _storage.read(key: _keyActiveStaffId);
  Future<String?> getActiveStaffName() => _storage.read(key: _keyActiveStaffName);

  Future<void> saveSyncedStaffs(List<dynamic> staffs) async {
    await _storage.write(key: _keySyncedStaffs, value: jsonEncode(staffs));
  }

  Future<List<dynamic>> getSyncedStaffs() async {
    final raw = await _storage.read(key: _keySyncedStaffs);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) return decoded;
    } catch (_) {}
    return [];
  }

  Future<void> clearStaffSession() async {
    await _storage.delete(key: _keyActiveStaffId);
    await _storage.delete(key: _keyActiveStaffName);
  }

  Future<void> clearAll() => _storage.deleteAll();
}
