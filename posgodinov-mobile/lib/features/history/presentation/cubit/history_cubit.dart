import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';
import 'package:posgodinov_mobile/features/history/domain/repositories/history_repository.dart';
import 'package:posgodinov_mobile/core/database/daos/sync_dao.dart';
import 'package:posgodinov_mobile/core/config/pos_config.dart';

class HistoryState extends Equatable {
  const HistoryState({
    this.local = const <HistoryEntry>[],
    this.searching = false,
    this.searchResult,
    this.searchError,
    this.searchAttempted = false,
    this.scopeIsolated = true,
  });

  /// Transaksi **shift berjalan**, dari SQLite. Selalu tersedia saat offline.
  ///
  /// ⛔ Daftar `remote` yang dulu ada di sini **dihapus** bersama tab
  /// "Sebelumnya" ([11 §M17.3], butir 16). Ia menampilkan transaksi kasir lain
  /// kepada kasir yang sedang bertugas — dan layar ini adalah pintu masuk ke
  /// Void dan Retur.
  final List<HistoryEntry> local;

  final bool searching;

  /// Hasil pencarian kode struk — **satu** transaksi, tidak pernah daftar.
  final HistoryEntry? searchResult;

  final String? searchError;

  /// `true` setelah satu pencarian selesai, apa pun hasilnya. Membedakan
  /// "belum mencari" dari "sudah mencari, tidak ketemu".
  final bool searchAttempted;

  /// `config.history_scope` — **feature flag** ([11 §M18.2]).
  ///
  /// `true` (bawaan) = riwayat terbatas shift berjalan, perilaku v2 butir 16.
  /// `false` = perilaku v1 dipulihkan untuk satu bisnis yang belum siap.
  ///
  /// Bawaannya KETAT dengan sengaja: perangkat yang belum pernah menarik
  /// `config` berjalan dengan isolasi penuh, karena kebijakan longgar secara
  /// bawaan berarti outlet yang syncnya tertinggal kehilangan pengendalian
  /// tanpa ada yang menyadarinya.
  final bool scopeIsolated;

  HistoryState copyWith({
    List<HistoryEntry>? local,
    bool? searching,
    HistoryEntry? searchResult,
    bool clearResult = false,
    String? searchError,
    bool clearError = false,
    bool? searchAttempted,
    bool? scopeIsolated,
  }) =>
      HistoryState(
        local: local ?? this.local,
        searching: searching ?? this.searching,
        searchResult: clearResult ? null : (searchResult ?? this.searchResult),
        searchError: clearError ? null : (searchError ?? this.searchError),
        searchAttempted: searchAttempted ?? this.searchAttempted,
        scopeIsolated: scopeIsolated ?? this.scopeIsolated,
      );

  @override
  List<Object?> get props => <Object?>[
        local,
        searching,
        searchResult,
        searchError,
        searchAttempted,
        scopeIsolated,
      ];
}

/// P-09 dan P-10.
class HistoryCubit extends Cubit<HistoryState> {
  HistoryCubit(this._repository, {SyncDao? syncDao})
      : _syncDao = syncDao,
        super(const HistoryState());

  final HistoryRepository _repository;

  /// Sumber `config`. `null` hanya pada uji yang tidak mempersoalkan flag —
  /// dan `null` berarti isolasi PENUH, bukan longgar.
  final SyncDao? _syncDao;

  StreamSubscription<List<HistoryEntry>>? _sub;

  /// Menyimak riwayat sesuai `config.history_scope` ([11 §M18.2]).
  ///
  /// Flag dibaca SEKALI di sini, bukan pada setiap emisi: `config` hanya
  /// berubah saat penarikan master data, dan membacanya per-emisi berarti satu
  /// kueri basis data untuk setiap transaksi baru pada jam sibuk.
  Future<void> observe(String shiftId) async {
    await _sub?.cancel();

    final bool isolated = _syncDao == null
        ? true
        : (await PosConfig.read(_syncDao)).historyScopeActiveShift;

    emit(state.copyWith(scopeIsolated: isolated));

    final Stream<List<HistoryEntry>> source = isolated
        ? _repository.watchCurrentShift(shiftId)
        : _repository.watchAllTransactions();

    _sub = source.listen(
      (List<HistoryEntry> items) => emit(state.copyWith(local: items)),
    );
  }

  /// Panjang minimum kode pencarian. Cerminan `service.MinLookupCodeLength`.
  ///
  /// Enam karakter, bukan tiga: "cari `A`" adalah penelusuran massal yang
  /// dilakukan sedikit demi sedikit ([11 §M17.3]).
  static const int minCodeLength = 6;

  /// Batas pencarian dan jendelanya.
  static const int searchLimit = 10;
  static const Duration searchWindow = Duration(minutes: 1);

  /// Jejak waktu pencarian dalam jendela berjalan.
  ///
  /// ⚠️ Pembatas KENYAMANAN, bukan pengamanan — ia hidup di memori dan hilang
  /// saat aplikasi ditutup. Yang dicegah adalah kasir yang menebak kode secara
  /// beruntun tanpa berpikir, bukan penyerang yang menulis skripnya sendiri.
  final List<DateTime> _searchAttempts = <DateTime>[];

  /// Mencari SATU transaksi lampau lewat kode struk — **butir 16**.
  ///
  /// Menggantikan `loadRemote()` yang menarik 50 transaksi terakhir. Perbedaan
  /// bentuknya adalah inti butir 16: kasir harus MENGETAHUI kode yang
  /// dicarinya, bukan menelusuri daftar.
  Future<void> searchByCode(String code) async {
    if (state.searching) return;

    final String needle = code.trim();
    if (needle.length < minCodeLength) {
      emit(
        state.copyWith(
          searchError: 'Kode minimal $minCodeLength karakter.',
          clearResult: true,
          searchAttempted: true,
        ),
      );
      return;
    }

    final DateTime now = DateTime.now();
    _searchAttempts.removeWhere(
      (DateTime t) => now.difference(t) > searchWindow,
    );
    if (_searchAttempts.length >= searchLimit) {
      final Duration sisa = searchWindow - now.difference(_searchAttempts.first);
      emit(
        state.copyWith(
          searchError:
              'Terlalu banyak pencarian. Coba lagi dalam ${sisa.inSeconds} detik.',
          clearResult: true,
          searchAttempted: true,
        ),
      );
      return;
    }
    _searchAttempts.add(now);

    emit(state.copyWith(searching: true, clearError: true, clearResult: true));

    try {
      final HistoryEntry? found = await _repository.lookupByCode(needle);
      emit(
        state.copyWith(
          searching: false,
          searchResult: found,
          searchAttempted: true,
          searchError: found == null
              ? 'Transaksi tidak ditemukan. Periksa kembali kode pada struk.'
              : null,
        ),
      );
    } on Failure catch (f) {
      // Kegagalan JARINGAN dibedakan dari "tidak ditemukan": yang pertama
      // berarti kasir harus mencoba lagi nanti, yang kedua berarti kodenya
      // salah. Menyamakannya membuat kasir menyerah mencari struk yang
      // sebenarnya ada.
      emit(
        state.copyWith(
          searching: false,
          searchError: f.message,
          searchAttempted: true,
        ),
      );
    }
  }

  /// Membersihkan hasil pencarian saat kasir mulai mengetik lagi.
  void clearSearch() =>
      emit(state.copyWith(clearResult: true, clearError: true, searchAttempted: false));

  /// P-10 — membatalkan transaksi.
  /// Membatalkan transaksi — **butir 15** ([11 §M13.2]).
  ///
  /// `reasonCode` wajib dan berasal dari kamus beku [ReasonCodes.voidReasons];
  /// teks bebas saja tidak dapat dikelompokkan laporan kecurangan, dan laporan
  /// yang tidak dapat dikelompokkan tidak pernah dibaca.
  ///
  /// Keputusan Void-vs-Retur **tidak** diambil di sini: pemanggil wajib sudah
  /// melewatkan `decideCancellation()` ([11 §M13.1]).
  Future<void> voidTransaction({
    required String id,
    required String shiftId,
    required String staffId,
    required String reasonCode,
    required String reasonNotes,
    String? authorizedBy,
    String cashierName = '',
    String? authorizedByName,
    Future<void> Function()? onVoided,
  }) async {
    if (reasonCode.isEmpty) return;

    // Aturan `OTHER` ditegakkan di sini juga, bukan hanya di form: form dapat
    // dilewati, cubit tidak.
    if (reasonCode == ReasonCodes.other &&
        reasonNotes.trim().length < ReasonCodes.otherNotesMinLength) {
      return;
    }

    await _repository.voidTransaction(
      id: id,
      shiftId: shiftId,
      staffId: staffId,
      reasonCode: reasonCode,
      reasonNotes: reasonNotes.trim(),
      authorizedBy: authorizedBy,
      cashierName: cashierName,
      authorizedByName: authorizedByName,
    );
    await onVoided?.call();
  }

  @override
  Future<void> close() async {
    await _sub?.cancel();
    return super.close();
  }
}
