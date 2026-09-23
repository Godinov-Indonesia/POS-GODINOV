import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/shift/domain/session_lock_guard.dart';

/// Fake sederhana — lebih terbaca daripada mock untuk kontrak sekecil ini.
class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.session, this.delay = Duration.zero});

  final CashierSession? session;
  final Duration delay;
  int callCount = 0;

  @override
  Future<CashierSession?> login({
    required String staffIdentifier,
    required String pin,
  }) async {
    callCount++;
    if (delay > Duration.zero) await Future<void>.delayed(delay);
    return session;
  }
}

final CashierSession _siti = CashierSession(
  staffId: 'staff-uuid-1',
  staffIdentifier: 'kasir01',
  name: 'Siti Aminah',
  loginAt: DateTime.utc(2026, 8, 12, 8),
);

void main() {
  group('CashierAuthCubit', () {
    blocTest<CashierAuthCubit, CashierAuthState>(
      'login berhasil melewati verifying menuju loggedIn',
      build: () => CashierAuthCubit(_FakeAuthRepository(session: _siti)),
      act: (CashierAuthCubit c) =>
          c.login(staffIdentifier: 'kasir01', pin: '1234'),
      expect: () => <Matcher>[
        isA<CashierVerifying>(),
        isA<CashierLoggedIn>(),
      ],
    );

    blocTest<CashierAuthCubit, CashierAuthState>(
      'kredensial salah menghasilkan pesan yang disamakan',
      build: () => CashierAuthCubit(_FakeAuthRepository()),
      act: (CashierAuthCubit c) =>
          c.login(staffIdentifier: 'kasir01', pin: '0000'),
      expect: () => <Matcher>[
        isA<CashierVerifying>(),
        isA<CashierAuthFailure>().having(
          (CashierAuthFailure f) => f.message,
          'message',
          'ID atau PIN salah.',
        ),
      ],
    );

    blocTest<CashierAuthCubit, CashierAuthState>(
      'identifier tidak dikenal memakai pesan yang SAMA dengan PIN salah',
      // Membedakan keduanya akan memberi tahu penyerang identifier mana yang
      // sah ([09 §5.3]).
      build: () => CashierAuthCubit(_FakeAuthRepository()),
      act: (CashierAuthCubit c) =>
          c.login(staffIdentifier: 'tidak-ada', pin: '1234'),
      expect: () => <Matcher>[
        isA<CashierVerifying>(),
        isA<CashierAuthFailure>().having(
          (CashierAuthFailure f) => f.message,
          'message',
          'ID atau PIN salah.',
        ),
      ],
    );

    blocTest<CashierAuthCubit, CashierAuthState>(
      'input kosong ditolak tanpa memanggil repository',
      build: () => CashierAuthCubit(_FakeAuthRepository(session: _siti)),
      act: (CashierAuthCubit c) => c.login(staffIdentifier: '  ', pin: ''),
      expect: () => <Matcher>[isA<CashierAuthFailure>()],
    );

    test('ketukan ganda tidak memicu dua verifikasi', () async {
      // Setiap panggilan membangun isolate bcrypt; dua sekaligus membuang
      // ratusan milidetik dan dapat menghasilkan dua sesi.
      final _FakeAuthRepository repo = _FakeAuthRepository(
        session: _siti,
        delay: const Duration(milliseconds: 50),
      );
      final CashierAuthCubit cubit = CashierAuthCubit(repo);

      final Future<void> pertama =
          cubit.login(staffIdentifier: 'kasir01', pin: '1234');
      final Future<void> kedua =
          cubit.login(staffIdentifier: 'kasir01', pin: '1234');
      await Future.wait(<Future<void>>[pertama, kedua]);

      expect(repo.callCount, 1);
      await cubit.close();
    });

    blocTest<CashierAuthCubit, CashierAuthState>(
      'requestLogout mengembalikan ke loggedOut saat tidak ada shift terbuka',
      // `lockGuard` sengaja tidak disuntikkan: tanpa penjaga, tidak ada shift
      // yang mengunci apa pun, dan inilah jalur yang harus tetap berfungsi.
      build: () => CashierAuthCubit(_FakeAuthRepository(session: _siti)),
      act: (CashierAuthCubit c) async {
        await c.login(staffIdentifier: 'kasir01', pin: '1234');
        await c.requestLogout(source: 'uji');
      },
      skip: 2,
      expect: () => <Matcher>[isA<CashierLoggedOut>()],
    );

    blocTest<CashierAuthCubit, CashierAuthState>(
      'requestLogout DITOLAK selama shift berjalan — butir 12 ([11 §M15.2])',
      build: () => CashierAuthCubit(
        _FakeAuthRepository(session: _siti),
        lockGuard: _AlwaysLockedGuard(),
      ),
      act: (CashierAuthCubit c) async {
        await c.login(staffIdentifier: 'kasir01', pin: '1234');
        final bool keluar = await c.requestLogout(source: 'uji');
        expect(keluar, isFalse);
      },
      skip: 2,
      // Sesi TETAP masuk: tidak ada state baru setelah login.
      expect: () => <Matcher>[],
    );

    blocTest<CashierAuthCubit, CashierAuthState>(
      'clearSession menembus kunci — hanya untuk saga & force close',
      build: () => CashierAuthCubit(
        _FakeAuthRepository(session: _siti),
        lockGuard: _AlwaysLockedGuard(),
      ),
      act: (CashierAuthCubit c) async {
        await c.login(staffIdentifier: 'kasir01', pin: '1234');
        c.clearSession();
      },
      skip: 2,
      expect: () => <Matcher>[isA<CashierLoggedOut>()],
    );

    test('session mengembalikan null saat belum login', () {
      final CashierAuthCubit cubit =
          CashierAuthCubit(_FakeAuthRepository(session: _siti));
      expect(cubit.session, isNull);
    });
  });

  group('CashierSession.shortName', () {
    test('memendekkan nama majemuk untuk StatusBar', () {
      expect(_siti.shortName, 'Siti A.');
    });

    test('nama tunggal dibiarkan utuh', () {
      final CashierSession budi = CashierSession(
        staffId: 'x',
        staffIdentifier: 'budi',
        name: 'Budi',
        loginAt: DateTime.utc(2026),
      );
      expect(budi.shortName, 'Budi');
    });
  });
}

/// Penjaga yang selalu mengunci — mewakili perangkat dengan shift `OPEN`.
///
/// `SessionLockGuard` asli menyentuh Drift; yang diuji di sini adalah keputusan
/// Cubit-nya, bukan kuerinya.
class _AlwaysLockedGuard implements SessionLockGuard {
  @override
  Future<bool> isLocked({String source = 'unknown'}) async => true;

  @override
  Future<bool> isLockedSilently() async => true;
}
