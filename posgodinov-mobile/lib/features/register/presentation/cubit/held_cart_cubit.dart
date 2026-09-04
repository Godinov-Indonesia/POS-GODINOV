import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:posgodinov_mobile/features/register/domain/repositories/register_repository.dart';

/// P-08 — daftar pesanan ditahan.
///
/// > **Murni lokal.** Tidak ada satu pun jalur di sini yang menyentuh jaringan;
/// > backend tidak mengenal konsep pesanan tertahan ([03 §14]).
class HeldCartCubit extends Cubit<List<HeldCartSummary>> {
  HeldCartCubit(this._repository) : super(const <HeldCartSummary>[]);

  final HeldCartRepository _repository;
  StreamSubscription<List<HeldCartSummary>>? _sub;

  Future<void> observe() async {
    await _sub?.cancel();
    _sub = _repository.watchAll().listen(emit);
  }

  /// Membatalkan pesanan tertahan — **butir 13** ([11 §M13.5]).
  ///
  /// Bukan `discard`: pembatalannya menulis jejak audit, dan nama metode yang
  /// menyembunyikan itu akan membuat pemanggil berikutnya mengira aksinya
  /// murah.
  Future<void> cancel({
    required String id,
    required String shiftId,
    required String staffId,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName = '',
    String? authorizedByName,
  }) =>
      _repository.cancel(
        id: id,
        shiftId: shiftId,
        staffId: staffId,
        reasonCode: reasonCode,
        reasonNotes: reasonNotes,
        authorizedBy: authorizedBy,
        cashierName: cashierName,
        authorizedByName: authorizedByName,
      );

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
