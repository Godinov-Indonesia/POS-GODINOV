import 'dart:async';

import 'package:posgodinov_mobile/core/config/constants.dart';

/// Hasil pengukuran selisih jam perangkat terhadap jam server.
class ClockSkew {
  const ClockSkew({required this.offset, required this.measuredAt});

  /// `waktuPerangkat − waktuServer`.
  ///
  /// Positif = jam perangkat **maju**; negatif = jam perangkat **mundur**.
  final Duration offset;

  /// Kapan pengukuran ini diambil, menurut jam perangkat.
  final DateTime measuredAt;

  /// Nilai awal sebelum ada respons server mana pun.
  ///
  /// `static final`, bukan `const`: [DateTime] tidak memiliki konstruktor
  /// konstan.
  static final ClockSkew unknown = ClockSkew(
    offset: Duration.zero,
    measuredAt: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
  );

  /// `false` selama belum ada satu pun respons server yang terbaca.
  bool get isMeasured => measuredAt.millisecondsSinceEpoch != 0;

  /// Selisih tanpa memandang arah — dasar keputusan menampilkan peringatan.
  Duration get magnitude => offset.abs();

  bool get exceedsThreshold =>
      isMeasured && magnitude > SyncLimits.clockSkewThreshold;

  /// Kalimat siap tampil untuk banner StatusBar ([06 §4.7.2]).
  String get warningLabel {
    final int minutes = magnitude.inMinutes;
    final String arah = offset.isNegative ? 'tertinggal dari' : 'mendahului';
    return 'Jam perangkat $arah jam server sekitar $minutes menit. '
        'Waktu pada struk dan riwayat dapat keliru.';
  }

  @override
  String toString() => 'ClockSkew(${offset.inSeconds}s @ $measuredAt)';
}

/// Memantau selisih jam perangkat terhadap server.
///
/// ## Mengapa ini penting
///
/// `client_created_at` dibuat dari jam **perangkat** dan dikirim apa adanya ke
/// server ([03 §2.3]). Tablet kasir yang jamnya melenceng — baterai RTC habis,
/// zona waktu salah, atau seseorang mengubahnya iseng — menghasilkan urutan
/// transaksi yang kacau di riwayat dan struk bertanggal salah.
///
/// **Yang TIDAK boleh dilakukan: mengoreksi `client_created_at` diam-diam.**
/// Nilai itu adalah kesaksian perangkat tentang kapan uang diterima; membetulkan
/// diam-diam menghapus jejak bahwa ada yang salah. Yang benar adalah
/// memperingatkan kasir dan membiarkan datanya apa adanya ([05 §1.8.2]).
///
/// Status disimpan di memori. Nilainya juga layak dipersistensi ke `sync_meta`
/// (`SyncMetaKeys.clockSkewMs`) agar peringatan bertahan melewati restart —
/// penulisan itu dilakukan mesin sync pada M5, bukan di sini, supaya lapisan
/// jaringan tidak menyentuh basis data.
class ClockSkewMonitor {
  final StreamController<ClockSkew> _controller =
      StreamController<ClockSkew>.broadcast();

  ClockSkew _current = ClockSkew.unknown;

  /// Pengukuran terakhir.
  ///
  /// Dibaca StatusBar saat pertama kali dipasang, sebelum event stream mana pun
  /// tiba.
  ClockSkew get current => _current;

  /// Perubahan pengukuran yang layak diperhatikan UI.
  ///
  /// Sengaja **tidak** memancar pada setiap respons HTTP: kasir yang sibuk tidak
  /// perlu StatusBar yang dibangun ulang puluhan kali per menit. Event dikirim
  /// hanya saat pengukuran pertama, saat status ambang batas berubah, atau saat
  /// selisihnya bergeser lebih dari [_emitDelta].
  Stream<ClockSkew> get changes => _controller.stream;

  /// Pergeseran minimum yang dianggap layak dipancarkan ulang.
  static const Duration _emitDelta = Duration(seconds: 30);

  /// Mencatat satu pengukuran.
  ///
  /// Dipisahkan dari interceptor agar dapat diuji tanpa Dio sama sekali.
  void record({required DateTime serverUtc, required DateTime deviceUtc}) {
    final ClockSkew previous = _current;
    final ClockSkew next = ClockSkew(
      offset: deviceUtc.toUtc().difference(serverUtc.toUtc()),
      measuredAt: deviceUtc.toUtc(),
    );
    _current = next;

    final bool firstMeasurement = !previous.isMeasured;
    final bool crossedThreshold =
        previous.exceedsThreshold != next.exceedsThreshold;
    final Duration shift = (next.offset - previous.offset).abs();

    if (firstMeasurement || crossedThreshold || shift > _emitDelta) {
      if (!_controller.isClosed) _controller.add(next);
    }
  }

  Future<void> dispose() => _controller.close();
}
