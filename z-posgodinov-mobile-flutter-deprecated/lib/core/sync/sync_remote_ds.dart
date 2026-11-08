import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/database/app_database.dart';
import 'package:posgodinov_mobile/core/database/daos/return_dao.dart';
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

  /// Header penanda versi kontrak ([11 §4.1]).
  ///
  /// Tanpa header ini server memperlakukan permintaan sebagai v1 dan
  /// **mengabaikan** `returns`, `void_logs`, serta `security_events` secara
  /// diam-diam — kegagalan paling senyap yang mungkin terjadi, karena `200`
  /// tetap kembali dan hitungannya tetap masuk akal.
  static const String _contractVersionHeader = 'X-POS-Contract-Version';
  static const String _contractVersion = '2';

  Future<SyncUpResponse> syncUp({
    required List<LocalShift> shifts,
    required List<TransactionWithItems> transactions,
    required List<LocalWaste> wastes,
    required String deviceId,
    int? masterDataVersion,
    List<ReturnWithItems> returns = const <ReturnWithItems>[],
    List<LocalVoidLog> voidLogs = const <LocalVoidLog>[],
    List<LocalSecurityEvent> securityEvents = const <LocalSecurityEvent>[],
  }) async {
    try {
      final Response<dynamic> response = await _client.dio.post<dynamic>(
        _path,
        options: Options(
          headers: <String, String>{_contractVersionHeader: _contractVersion},
        ),
        data: WireMapper.bodyV2(
          deviceId: deviceId,
          masterDataVersion: masterDataVersion,
          shifts: shifts,
          transactions: transactions,
          returns: returns,
          voidLogs: voidLogs,
          wastes: wastes,
          securityEvents: securityEvents,
        ),
      );

      return await Envelope.data(response, SyncUpResponse.fromJson);
    } on DioException catch (e) {
      final Object? error = e.error;
      if (error is Failure) throw error;
      throw NetworkFailure(e.message ?? 'Gagal menghubungi server.');
    }
  }
}
