import 'package:posgodinov_mobile/core/crypto/pin_verifier.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/master_dao.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl({
    required MasterDao masterDao,
    required PinVerifier verifier,
    DateTime Function()? now,
  })  : _masterDao = masterDao,
        _verifier = verifier,
        _now = now ?? DateTime.now;

  final MasterDao _masterDao;
  final PinVerifier _verifier;
  final DateTime Function() _now;

  @override
  Future<CashierSession?> login({
    required String staffIdentifier,
    required String pin,
  }) async {
    final String identifier = staffIdentifier.trim();
    final Staff? staff = await _masterDao.findByIdentifier(identifier);

    // Perbandingan bcrypt DIJALANKAN walau staff tidak ditemukan, memakai hash
    // umpan. Tanpa ini, identifier yang salah dijawab dalam mikrodetik
    // sementara yang benar butuh ratusan milidetik — selisih yang cukup untuk
    // menebak identifier mana yang sah ([09 §5.3]).
    final bool cocok = await _verifier.verify(
      pin: pin,
      pinHash: staff?.pinHash,
    );

    if (!cocok || staff == null) return null;

    return CashierSession(
      staffId: staff.id,
      staffIdentifier: staff.staffIdentifier,
      name: staff.name,
      loginAt: _now(),
    );
  }
}
