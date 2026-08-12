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

  Future<void> discard(String id) => _repository.discard(id);

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
