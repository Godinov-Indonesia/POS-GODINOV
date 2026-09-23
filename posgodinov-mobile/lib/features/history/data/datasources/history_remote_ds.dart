import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/config/constants.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/network/api_client.dart';
import 'package:posgodinov_mobile/core/network/envelope.dart';
import 'package:posgodinov_mobile/core/utils/money.dart';
import 'package:posgodinov_mobile/features/history/domain/entities/history_entry.dart';

/// `GET /v1/pos/transactions` ([03 §2.4]).
class HistoryRemoteDataSource {
  const HistoryRemoteDataSource(this._client);

  final ApiClient _client;

  static const String _path = '/v1/pos/transactions';

  /// > ⚠️ **Tidak ada parameter yang berfungsi.** Paginasi, filter tanggal, dan
  /// > filter kasir semuanya diabaikan handler; hasilnya selalu 50 transaksi
  /// > terbaru, diurutkan `created_at DESC` ([03 §2.4]).
  Future<List<HistoryEntry>> fetch() async {
    try {
      final Response<dynamic> response = await _client.dio.get<dynamic>(_path);
      return Envelope.dataList(response, _fromJson);
    } on DioException catch (e) {
      final Object? error = e.error;
      if (error is Failure) throw error;
      throw NetworkFailure(e.message ?? 'Gagal memuat riwayat.');
    }
  }

  /// `GET /v1/pos/transactions/lookup?code=` — **butir 16** ([11 §M17.3]).
  ///
  /// ⚠️ Mengembalikan SATU transaksi, bukan daftar. Endpoint yang mengembalikan
  /// daftar adalah penelusuran massal dengan nama lain.
  ///
  /// `null` berarti kodenya tidak ada — DAN juga berarti kodenya milik outlet
  /// lain. Server sengaja tidak membedakan keduanya: membedakannya akan
  /// membocorkan keberadaan transaksi cabang lain lewat pesan galat.
  Future<HistoryEntry?> lookup(String code) async {
    try {
      final Response<dynamic> response = await _client.dio.get<dynamic>(
        '$_path/lookup',
        queryParameters: <String, dynamic>{'code': code},
      );
      return await Envelope.data(response, _fromJson);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      final Object? error = e.error;
      if (error is Failure) throw error;
      throw NetworkFailure(e.message ?? 'Gagal mencari transaksi.');
    }
  }

  HistoryEntry _fromJson(Map<String, dynamic> json) {
    return HistoryEntry(
      id: json['id'] as String? ?? '',
      shiftId: json['shift_id'] as String? ?? '',
      // BATAS API MASUK — Rupiah dari server menjadi integer sen.
      totalMinor: Money.toMinor((json['total_amount'] as num?) ?? 0),
      paymentMethod: _method(json['payment_method'] as String?),
      status: _status(json['status'] as String?),
      clientCreatedAt:
          DateTime.tryParse(json['client_created_at'] as String? ?? '')
                  ?.toUtc() ??
              DateTime.now().toUtc(),
      customerName: json['customer_name'] as String? ?? '',
      cancelNotes: json['cancel_notes'] as String? ?? '',
      // Baris server tidak dapat di-void maupun dicetak ulang: itemnya tidak
      // membawa nama produk, sehingga struk tidak dapat dirakit ulang.
      isLocal: false,
      lines: Envelope.list(json['items'], _line),
    );
  }

  HistoryLine _line(Map<String, dynamic> json) => HistoryLine(
        productId: json['product_id'] as String? ?? '',
        // Server tidak menyimpan nama produk pada item ([02 §2.13]).
        productName: 'Produk',
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        unitPriceMinor: Money.toMinor((json['unit_price'] as num?) ?? 0),
      );

  /// Nilai tak dikenal dari data historis tidak boleh menggagalkan seluruh
  /// daftar — kolomnya `VARCHAR` bebas tanpa enum ([02 §2.12]).
  PaymentSummary _method(String? raw) {
    for (final PaymentSummary m in PaymentSummary.values) {
      if (m.wireValue == raw) return m;
    }
    return PaymentSummary.cash;
  }

  TransactionStatus _status(String? raw) =>
      raw == TransactionStatus.cancelled.wireValue
          ? TransactionStatus.cancelled
          : TransactionStatus.completed;
}
