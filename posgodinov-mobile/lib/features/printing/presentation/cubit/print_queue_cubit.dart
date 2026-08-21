import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/printer/print_queue_service.dart';

/// Keadaan antrean cetak yang dilihat kasir ([11 §M14.1]).
class PrintQueueState extends Equatable {
  const PrintQueueState({this.unprinted = 0, this.retrying = false});

  /// `PENDING` + `FAILED` + `ABANDONED`.
  ///
  /// Ketiganya dihitung bersama karena maknanya bagi kasir identik: tidak ada
  /// kertas di tangan siapa pun. Memisahkannya di banner hanya menuntut kasir
  /// memahami perbedaan yang tidak mengubah tindakannya.
  final int unprinted;

  final bool retrying;

  bool get hasUnprinted => unprinted > 0;

  PrintQueueState copyWith({int? unprinted, bool? retrying}) => PrintQueueState(
        unprinted: unprinted ?? this.unprinted,
        retrying: retrying ?? this.retrying,
      );

  @override
  List<Object?> get props => <Object?>[unprinted, retrying];
}

/// Sumber banner persisten "N struk belum tercetak".
///
/// ═══════════════════════════════════════════════════════════════════════════
/// MENGAPA PERSISTEN, BUKAN SNACKBAR
/// ═══════════════════════════════════════════════════════════════════════════
///
/// SnackBar hilang dalam beberapa detik. Kasir yang sedang melayani antrean
/// tidak akan melihatnya, dan struk pembatalan yang gagal tercetak baru
/// diketahui saat tutup shift — ketika kertasnya sudah tidak mungkin lagi
/// ditandatangani supervisor yang sudah pulang.
///
/// Banner ini menetap sampai antreannya benar-benar kosong. Ketidaknyamanannya
/// disengaja: ia mewakili kewajiban yang belum selesai.
class PrintQueueCubit extends Cubit<PrintQueueState> {
  PrintQueueCubit({required PrintQueueService service})
      : _service = service,
        super(const PrintQueueState());

  final PrintQueueService _service;
  StreamSubscription<int>? _sub;

  /// Mulai menyimak, lalu mencoba mengirim apa yang tertinggal.
  ///
  /// Job dari sesi sebelumnya harus langsung terlihat — dan, bila printernya
  /// sudah hidup kembali, langsung terkirim tanpa kasir menekan apa pun.
  Future<void> observe() async {
    await _sub?.cancel();
    _sub = _service.watchUnprintedCount().listen(
          (int count) => emit(state.copyWith(unprinted: count)),
        );

    unawaited(_service.flush());
  }

  /// Tombol "Cetak Ulang" pada banner.
  ///
  /// Ikut membangkitkan job `ABANDONED`, yang **tidak pernah** dikirim ulang
  /// otomatis: ia sudah menghabiskan jatah percobaannya, dan mencobanya lagi
  /// tanpa ada yang berubah hanya mengulang kegagalan yang sama. Ketukan kasir
  /// adalah perubahan itu.
  Future<void> retryAll() async {
    if (state.retrying) return;
    emit(state.copyWith(retrying: true));
    try {
      await _service.retryAllAbandoned();
    } finally {
      emit(state.copyWith(retrying: false));
    }
  }

  @override
  Future<void> close() async {
    await _sub?.cancel();
    _sub = null;
    return super.close();
  }
}
