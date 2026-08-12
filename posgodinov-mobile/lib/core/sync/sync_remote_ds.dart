import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/transaction_dao.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/network/api_client.dart';
import 'package:posgodinov_mobile/core/network/envelope.dart';
import 'package:posgodinov_mobile/core/sync/sync_models.dart';
import 'package:posgodinov_mobile/core/sync/wire_mapper.dart';

/// Panggilan `POST /v1/pos/sync`.
class SyncRemoteDataSource {
  const SyncRemoteDataSource(this._client);

  final ApiClient _client;

  static const String _path = '/v1/pos/sync';

  Future<SyncUpResponse> syncUp({
    required List<LocalShift> shifts,
    required List<TransactionWithItems> transactions,
    required List<LocalWaste> wastes,
  }) async {
    try {
      final Response<dynamic> response = await _client.dio.post<dynamic>(
        _path,
        data: WireMapper.body(
          shifts: shifts,
          transactions: transactions,
          wastes: wastes,
        ),
      );

      return Envelope.data(response, SyncUpResponse.fromJson);
    } on DioException catch (e) {
      final Object? error = e.error;
      if (error is Failure) throw error;
      throw NetworkFailure(e.message ?? 'Gagal menghubungi server.');
    }
  }
}
