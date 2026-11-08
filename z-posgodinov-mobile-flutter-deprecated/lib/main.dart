import 'package:posgodinov_mobile/app.dart';
import 'package:posgodinov_mobile/bootstrap.dart';

/// Titik masuk aplikasi.
///
/// Seluruh persiapan — penguncian orientasi, penangkap error, perakitan
/// dependensi, pembukaan basis data — terjadi di `bootstrap.dart`, dijalankan
/// di dalam zona yang menangkap error asinkron ([09 §2.1]).
void main() {
  runGuardedApp(PosGodinovApp.new);
}
