import 'package:bcrypt/bcrypt.dart';
import 'package:flutter/foundation.dart';

@immutable
class PinComparePayload {
  const PinComparePayload(this.pin, this.hash);

  final String pin;
  final String hash;
}

bool comparePinIsolate(PinComparePayload payload) =>
    BCrypt.checkpw(payload.pin, payload.hash);

class PinVerifier {
  const PinVerifier();

  static const String decoyHash =
      r'$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

  Future<bool> verify({required String pin, required String? pinHash}) async {
    final bool match = await compute(
      comparePinIsolate,
      PinComparePayload(pin, pinHash ?? decoyHash),
    );
    return match && pinHash != null && pinHash.isNotEmpty;
  }
}
