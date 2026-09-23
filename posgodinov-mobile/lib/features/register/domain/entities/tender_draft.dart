import 'package:equatable/equatable.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';

/// Satu tender yang sedang disusun kasir — **butir 8 & 11** ([11 §M17.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// MENGAPA ADA TIPE TERSENDIRI
/// ═══════════════════════════════════════════════════════════════════════════
///
/// [PaymentMethod] tidak cukup: ia menyatakan CARA membayar, sedangkan
/// pembayaran split memerlukan BERAPA dan — untuk kartu — trace number serta
/// empat digit akhir. Menyimpannya sebagai tiga variabel terpisah di layar
/// membuat ketiganya dapat lepas dari pasangannya saat kasir menekan back.
///
/// `SPLIT` sengaja **bukan** nilai [TenderMethod]: ia adalah RINGKASAN atas dua
/// tender atau lebih, bukan cara membayar. Menaruhnya di enum yang sama berarti
/// kasir dapat memilih "Split" lalu tidak ada satu pun baris tender yang lahir
/// untuk menjelaskannya.
class TenderDraft extends Equatable {
  const TenderDraft({
    required this.method,
    required this.amountMinor,
    this.traceNumber,
    this.cardLast4,
  });

  final TenderMethod method;

  /// **Nominal gesek** untuk kartu — bukan total transaksi.
  final int amountMinor;

  /// WAJIB untuk `DEBIT`/`CREDIT`. Cerminan `ck_card_requires_trace`.
  final String? traceNumber;

  /// WAJIB untuk `DEBIT`/`CREDIT`. Tepat 4 digit.
  final String? cardLast4;

  @override
  List<Object?> get props =>
      <Object?>[method, amountMinor, traceNumber, cardLast4];
}

/// Aturan isian tender kartu — **butir 8** ([11 §M17.2]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// TIGA LAPIS, SATU RUMUS
/// ═══════════════════════════════════════════════════════════════════════════
///
///   1. LAYAR      — berkas ini, dipakai `PaymentCardPage`
///   2. KAWAT      — `assertTenderIntegrity` di `wire_mapper.dart`
///   3. BASIS DATA — `CHECK ck_card_requires_trace` di PostgreSQL
///
/// Ketiganya diperlukan. Lapis 1 memberi kasir pesan yang dapat ditindaklanjuti
/// SEBELUM uang berpindah. Lapis 2 menangkap baris yang lahir dari jalur lain.
/// Lapis 3 adalah kebenaran terakhir yang tidak dapat dilewati siapa pun.
///
/// Yang dijaga di sini adalah agar ketiganya memakai rumus yang SAMA — regex
/// yang disalin ke tiga tempat akan berbeda pada perbaikan pertama.
///
/// ⛔ **DILARANG** menambahkan PAN penuh, CVV, PIN, atau data magstripe
/// (aturan R8). Menyimpannya memindahkan seluruh sistem ke ruang lingkup
/// PCI-DSS penuh.
abstract final class CardTenderRules {
  /// Batas bawah trace number.
  ///
  /// Empat, bukan enam — LEBIH LONGGAR dari format EDC Indonesia yang lazim.
  /// Menolak trace number sah karena bank tertentu memakai format lain berarti
  /// kasir tidak dapat menyelesaikan transaksi yang uangnya sudah tergesek.
  /// Yang ditegakkan adalah **ada isinya**, bukan formatnya; yang memverifikasi
  /// trace number adalah struk EDC di tangan kasir.
  static const int traceMinLength = 4;
  static const int traceMaxLength = 20;

  /// Menyaring input menjadi angka saja.
  ///
  /// Dipakai saat DIKETIK, bukan saat submit: sebagian pemindai kartu
  /// mengirimkan karakter kontrol yang tidak terlihat di layar.
  static String digitsOnly(String value) =>
      value.replaceAll(RegExp(r'[^0-9]'), '');

  /// `null` berarti sah.
  static String? validateTrace(String value) {
    final String v = value.trim();
    if (v.length < traceMinLength) {
      return 'Trace number minimal $traceMinLength angka.';
    }
    if (v.length > traceMaxLength) {
      return 'Trace number maksimal $traceMaxLength angka.';
    }
    return null;
  }

  /// `null` berarti sah. Tepat empat angka — cerminan `card_last4 CHAR(4)`.
  static String? validateLast4(String value) {
    if (!RegExp(r'^[0-9]{4}$').hasMatch(value.trim())) {
      return '4 digit akhir kartu harus tepat 4 angka.';
    }
    return null;
  }
}
