import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../../core/config/app_config.dart';
import '../../core/di/injection.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/theme/app_theme.dart';
import '../staff_auth/staff_select_screen.dart';

class DeviceBindingScreen extends StatefulWidget {
  const DeviceBindingScreen({super.key});

  @override
  State<DeviceBindingScreen> createState() => _DeviceBindingScreenState();
}

class _DeviceBindingScreenState extends State<DeviceBindingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _businessController = TextEditingController();
  final _outletController = TextEditingController();
  final _passwordController = TextEditingController();
  final _urlController = TextEditingController(text: AppConfig.baseUrl);
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void dispose() {
    _businessController.dispose();
    _outletController.dispose();
    _passwordController.dispose();
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _handleBind() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      AppConfig.baseUrl = _urlController.text.trim();
      final apiClient = getIt<ApiClient>();
      apiClient.dio.options.baseUrl = AppConfig.baseUrl;
      final tokenStorage = getIt<TokenStorage>();

      final res = await apiClient.bindDevice(
        serialBusiness: _businessController.text.trim(),
        serialOutlet: _outletController.text.trim(),
        password: _passwordController.text,
      );

      final data = res['data'] as Map<String, dynamic>? ?? {};
      final token = data['device_token'] as String? ?? '';
      if (token.isEmpty) {
        throw Exception('Server tidak mengembalikan token perangkat');
      }

      await tokenStorage.saveDeviceSession(token: token);

      // Sinkronisasi data staf outlet untuk login & verifikasi PIN
      try {
        final staffs = await apiClient.getStaffData();
        if (staffs.isNotEmpty) {
          await tokenStorage.saveSyncedStaffs(staffs);
        }
      } catch (_) {}

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const StaffSelectScreen()),
        );
      }
    } catch (e) {
      String msg = 'Gagal menghubungkan perangkat: ${e.toString()}';
      if (e is DioException) {
        final resp = e.response?.data;
        if (resp is Map<String, dynamic> && resp['message'] != null) {
          msg = resp['message'] as String;
        } else if (e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.connectionError) {
          msg =
              'Tidak dapat terhubung ke server (${AppConfig.baseUrl}). Pastikan URL benar dan server aktif.';
        }
      }
      setState(() {
        _errorMessage = msg;
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.inventory_2_rounded,
                    size: 64,
                    color: AppTheme.primary,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Godinov Stock Opname',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Hubungkan perangkat ini ke outlet toko Anda untuk memulai penghitungan fisik.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 32),
                  if (_errorMessage != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: AppTheme.danger.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.danger),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: AppTheme.danger, fontSize: 13),
                      ),
                    ),
                  TextFormField(
                    controller: _businessController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Serial Bisnis',
                      hintText: 'Contoh: KOPKO040926',
                      prefixIcon: Icon(Icons.business),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Serial bisnis wajib diisi' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _outletController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      labelText: 'Serial Outlet',
                      hintText: 'Contoh: KOPKO040926001',
                      prefixIcon: Icon(Icons.store),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Serial outlet wajib diisi' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Password Akun Bisnis',
                      prefixIcon: const Icon(Icons.lock_outline),
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        ),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    validator: (v) =>
                        (v == null || v.isEmpty) ? 'Password wajib diisi' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _urlController,
                    decoration: const InputDecoration(
                      labelText: 'Server API URL',
                      prefixIcon: Icon(Icons.cloud_outlined),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'URL server wajib diisi' : null,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _isLoading ? null : _handleBind,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            'Hubungkan Perangkat',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
