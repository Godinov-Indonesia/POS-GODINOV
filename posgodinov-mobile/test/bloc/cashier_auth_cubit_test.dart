import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/features/auth/domain/entities/cashier_session.dart';
import 'package:posgodinov_mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';

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
      'logout mengembalikan ke loggedOut',
      build: () => CashierAuthCubit(_FakeAuthRepository(session: _siti)),
      act: (CashierAuthCubit c) async {
        await c.login(staffIdentifier: 'kasir01', pin: '1234');
        c.logout();
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
