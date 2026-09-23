import 'package:dio/dio.dart';
import 'package:posgodinov_mobile/core/error/failures.dart';
import 'package:posgodinov_mobile/core/network/api_client.dart';
import 'package:posgodinov_mobile/core/network/envelope.dart';
import 'package:posgodinov_mobile/features/device/data/models/master_data_dto.dart';

/// Panggilan jaringan untuk pemasangan perangkat dan master data.
class DeviceRemoteDataSource {
  const DeviceRemoteDataSource(this._client);

  final ApiClient _client;

  static const String _bindPath = '/v1/auth/device/bind';
  static const String _masterDataPath = '/v1/pos/sync/master-data';

  /// `POST /v1/auth/device/bind` ([03 §2.1]).
  ///
  /// Endpoint **publik** — `DeviceTokenInterceptor` sengaja tidak membubuhkan
  /// header pada prefiks `/v1/auth/`.
  ///
  /// Kegagalan umum:
  /// - `400` — ada field yang kosong
  /// - `401` — kredensial salah, atau serial outlet bukan milik bisnis tersebut
  ///
  /// Keduanya sampai ke pemanggil sebagai `ApiFailure` dengan pesan server apa
  /// adanya; jangan diterjemahkan ulang ([03 §0]).
  Future<DeviceBindResponseDto> bind({
    required String serialBusiness,
    required String serialOutlet,
    required String password,
  }) async {
    try {
      final Response<dynamic> response = await _client.dio.post<dynamic>(
        _bindPath,
        data: <String, dynamic>{
          'serial_business': serialBusiness,
          'serial_outlet': serialOutlet,
          'password': password,
        },
      );

      final DeviceBindResponseDto dto = Envelope.data(
        response,
        DeviceBindResponseDto.fromJson,
      );

      if (dto.deviceToken.isEmpty) {
        throw const ContractFailure(
          'Server menjawab berhasil tetapi tidak mengirim device token. '
          'Hubungi teknisi.',
        );
      }
      return dto;
    } on DioException catch (e) {
      throw _unwrap(e);
    }
  }

  /// `GET /v1/pos/sync/master-data` ([03 §2.2]).
  ///
  /// Konteks tenant otomatis diturunkan dari device token — tidak ada parameter
  /// dan tidak ada `outlet_id` yang perlu dikirim.
  Future<MasterDataDto> fetchMasterData() async {
    try {
      final Response<dynamic> response =
          await _client.dio.get<dynamic>(_masterDataPath);

      return await Envelope.data(response, MasterDataDto.fromJson);
    } on DioException catch (e) {
      throw _unwrap(e);
    }
  }

  /// Mengeluarkan [Failure] yang sudah dipetakan interceptor.
  ///
  /// Lapisan atas tidak perlu tahu apa pun tentang Dio.
  Failure _unwrap(DioException e) {
    final Object? error = e.error;
    if (error is Failure) return error;
    return NetworkFailure(e.message ?? 'Gagal menghubungi server.');
  }
}
