import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/domain/shift_math.dart';
import 'package:posgodinov_mobile/features/shift/domain/repositories/shift_repository.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';

class _FakeShiftRepository implements ShiftRepository {
  _FakeShiftRepository({this.throwOnOpen = false});

  final bool throwOnOpen;
  final StreamController<Shift?> _controller =
      StreamController<Shift?>.broadcast();

  Shift? current;
  int openCount = 0;

  @override
  Future<Shift?> currentOpenShift() async => current;

  @override
  Stream<Shift?> watchOpenShift() => _controller.stream;

  @override
  Future<Shift> open({
    required String staffId,
    required int openingBalanceMinor,
  }) async {
    openCount++;
    if (throwOnOpen) throw StateError('basis data terkunci');

    final Shift shift = Shift(
      id: 'shift-uuid-1',
      staffId: staffId,
      openingBalanceMinor: openingBalanceMinor,
      closingBalanceMinor: 0,
      expectedBalanceMinor: 0,
      discrepancyMinor: 0,
      status: ShiftStatus.open,
      clientOpenedAt: DateTime.utc(2026, 8, 12, 8),
    );
    current = shift;
    _controller.add(shift);
    return shift;
  }

  @override
  Future<List<CashLine>> cashLinesOf(String shiftId) async => const <CashLine>[];

  @override
  Future<Shift> close({
    required String shiftId,
    required int closingBalanceMinor,
  }) async => throw UnimplementedError();

  void emitShift(Shift? shift) => _controller.add(shift);

  Future<void> dispose() => _controller.close();
}

void main() {
  group('ShiftCubit (P-04)', () {
    blocTest<ShiftCubit, ShiftState>(
      'membuka shift dengan modal awal',
      build: () => ShiftCubit(_FakeShiftRepository()),
      act: (ShiftCubit c) => c.openShift(
        staffId: 'staff-1',
        // Rp 200.000 dalam INTEGER SEN.
        openingBalanceMinor: 20000000,
      ),
      expect: () => <Matcher>[
        isA<ShiftOpening>(),
        isA<ShiftActive>().having(
          (ShiftActive s) => s.shift.openingBalanceMinor,
          'openingBalanceMinor',
          20000000,
        ),
      ],
    );

    blocTest<ShiftCubit, ShiftState>(
      'modal Rp 0 diperbolehkan — sebagian laci dimulai kosong',
      build: () => ShiftCubit(_FakeShiftRepository()),
      act: (ShiftCubit c) =>
          c.openShift(staffId: 'staff-1', openingBalanceMinor: 0),
      expect: () => <Matcher>[isA<ShiftOpening>(), isA<ShiftActive>()],
    );

    blocTest<ShiftCubit, ShiftState>(
      'modal negatif ditolak sebelum menyentuh basis data',
      build: () => ShiftCubit(_FakeShiftRepository()),
      act: (ShiftCubit c) =>
          c.openShift(staffId: 'staff-1', openingBalanceMinor: -1),
      expect: () => <Matcher>[isA<ShiftFailure>()],
    );

    blocTest<ShiftCubit, ShiftState>(
      'kegagalan basis data dilaporkan, bukan ditelan',
      // Kasir tidak boleh berjualan tanpa induk transaksi: `transactions`
      // memiliki FK ke `shifts(id)` ([03 §2.3]).
      build: () => ShiftCubit(_FakeShiftRepository(throwOnOpen: true)),
      act: (ShiftCubit c) =>
          c.openShift(staffId: 'staff-1', openingBalanceMinor: 0),
      expect: () => <Matcher>[isA<ShiftOpening>(), isA<ShiftFailure>()],
    );

    test('ketukan ganda tidak membuka dua shift', () async {
      final _FakeShiftRepository repo = _FakeShiftRepository();
      final ShiftCubit cubit = ShiftCubit(repo);

      await Future.wait(<Future<void>>[
        cubit.openShift(staffId: 'staff-1', openingBalanceMinor: 0),
        cubit.openShift(staffId: 'staff-1', openingBalanceMinor: 0),
      ]);

      expect(repo.openCount, 1);
      await cubit.close();
      await repo.dispose();
    });

    test('observe memancarkan ShiftNone saat tidak ada shift terbuka', () async {
      final _FakeShiftRepository repo = _FakeShiftRepository();
      final ShiftCubit cubit = ShiftCubit(repo);

      await cubit.observe();
      repo.emitShift(null);
      await Future<void>.delayed(Duration.zero);

      expect(cubit.state, isA<ShiftNone>());
      await cubit.close();
      await repo.dispose();
    });

    test('observe mengambil shift yang sudah berjalan', () async {
      // Kasir yang login ulang di tengah shift tidak boleh diminta membuka
      // shift kedua.
      final _FakeShiftRepository repo = _FakeShiftRepository();
      final ShiftCubit cubit = ShiftCubit(repo);

      await cubit.observe();
      repo.emitShift(
        Shift(
          id: 'shift-lama',
          staffId: 'staff-1',
          openingBalanceMinor: 20000000,
          closingBalanceMinor: 0,
          expectedBalanceMinor: 0,
          discrepancyMinor: 0,
          status: ShiftStatus.open,
          clientOpenedAt: DateTime.utc(2026, 8, 12, 8),
        ),
      );
      await Future<void>.delayed(Duration.zero);

      expect(cubit.state, isA<ShiftActive>());
      await cubit.close();
      await repo.dispose();
    });
  });

  group('Shift', () {
    test('shift terbuka dikenali dari status', () {
      final Shift s = Shift(
        id: 'x',
        staffId: 'y',
        openingBalanceMinor: 0,
        closingBalanceMinor: 0,
        expectedBalanceMinor: 0,
        discrepancyMinor: 0,
        status: ShiftStatus.open,
        clientOpenedAt: DateTime.utc(2026, 8, 12, 8),
      );

      expect(s.isOpen, isTrue);
      expect(
        s.durationUntil(DateTime.utc(2026, 8, 12, 14)),
        const Duration(hours: 6),
      );
    });
  });
}
