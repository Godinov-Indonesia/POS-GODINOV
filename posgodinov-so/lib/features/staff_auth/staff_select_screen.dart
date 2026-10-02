import 'package:flutter/material.dart';
import '../../core/crypto/pin_verifier.dart';
import '../../core/di/injection.dart';
import '../../core/error/error_formatter.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/theme/app_theme.dart';
import '../opname_session/session_list_screen.dart';

class StaffSelectScreen extends StatefulWidget {
  const StaffSelectScreen({super.key});

  @override
  State<StaffSelectScreen> createState() => _StaffSelectScreenState();
}

class _StaffSelectScreenState extends State<StaffSelectScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _pinController = TextEditingController();
  final _pinVerifier = const PinVerifier();

  List<dynamic> _staffs = [];
  bool _isLoading = false;
  bool _isSyncing = false;
  bool _obscurePin = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadStaffs();
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _loadStaffs() async {
    final tokenStorage = getIt<TokenStorage>();
    final cached = await tokenStorage.getSyncedStaffs();
    if (cached.isNotEmpty) {
      if (mounted) setState(() => _staffs = cached);
    } else {
      await _syncStaffs();
    }
  }

  Future<void> _syncStaffs() async {
    setState(() => _isSyncing = true);
    try {
      final apiClient = getIt<ApiClient>();
      final tokenStorage = getIt<TokenStorage>();
      final fetched = await apiClient.getStaffData();
      if (fetched.isNotEmpty) {
        await tokenStorage.saveSyncedStaffs(fetched);
        if (mounted) {
          setState(() {
            _staffs = fetched;
            _errorMessage = null;
          });
        }
      }
    } catch (e) {
      if (mounted && _staffs.isEmpty) {
        setState(() {
          _errorMessage = ErrorFormatter.format(
            e,
            fallback: 'Gagal memuat data staf dari server.',
          );
        });
      }
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final idInput = _identifierController.text.trim().toLowerCase();
    final pin = _pinController.text.trim();

    try {
      // Cari staf berdasarkan staff_identifier atau email atau id
      dynamic matchedStaff = _findStaff(idInput);

      // Jika belum ditemukan, coba sinkronkan sekali lagi dengan backend
      if (matchedStaff == null) {
        final apiClient = getIt<ApiClient>();
        final tokenStorage = getIt<TokenStorage>();
        final fresh = await apiClient.getStaffData();
        if (fresh.isNotEmpty) {
          await tokenStorage.saveSyncedStaffs(fresh);
          _staffs = fresh;
          matchedStaff = _findStaff(idInput);
        }
      }

      if (matchedStaff == null) {
        setState(() {
          _errorMessage = 'Staf dengan identifier "$idInput" tidak ditemukan di outlet ini.';
        });
        return;
      }

      final pinHash = matchedStaff['pin_hash'] as String?;
      final isValid = await _pinVerifier.verify(pin: pin, pinHash: pinHash);

      if (!isValid) {
        setState(() {
          _errorMessage = 'PIN salah. Silakan coba lagi.';
        });
        return;
      }

      // Simpan UUID staff sebagai activeStaffId untuk header X-Staff-Id
      final staffId = matchedStaff['id'] as String;
      final staffName = (matchedStaff['name'] as String?) ?? 'Staf';

      final tokenStorage = getIt<TokenStorage>();
      await tokenStorage.saveActiveStaff(staffId: staffId, staffName: staffName);

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const SessionListScreen()),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = ErrorFormatter.format(
          e,
          fallback: 'Terjadi kendala saat login. Silakan coba lagi.',
        );
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  dynamic _findStaff(String identifier) {
    for (final s in _staffs) {
      if (s is Map<String, dynamic>) {
        final staffId = s['staff_identifier']?.toString().toLowerCase();
        final email = s['email']?.toString().toLowerCase();
        final uuid = s['id']?.toString().toLowerCase();
        if (staffId == identifier || email == identifier || uuid == identifier) {
          return s;
        }
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Login Staf Opname'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: _isSyncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.sync),
            tooltip: 'Sinkronkan Data Staf',
            onPressed: _isSyncing ? null : _syncStaffs,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                const Icon(
                  Icons.lock_person_outlined,
                  size: 56,
                  color: AppTheme.primary,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Autentikasi Staf',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Masukkan Staff Identifier dan PIN Anda untuk memulai penghitungan opname fisik.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 24),
                if (_errorMessage != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.danger.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.danger),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: AppTheme.danger, fontSize: 13),
                    ),
                  ),

                // Pilihan cepat jika data staf sudah tersinkronisasi
                if (_staffs.isNotEmpty) ...[
                  const Text(
                    'Pilih Staf Terdaftar:',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _staffs.map((s) {
                      final name = s['name']?.toString() ?? 'Staf';
                      final id = s['staff_identifier']?.toString() ?? '';
                      final isSelected = _identifierController.text == id;
                      return ChoiceChip(
                        label: Text('$name ($id)'),
                        selected: isSelected,
                        onSelected: (_) {
                          setState(() {
                            _identifierController.text = id;
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                ],

                TextFormField(
                  controller: _identifierController,
                  decoration: const InputDecoration(
                    labelText: 'Staff Identifier / Email',
                    hintText: 'Contoh: 242424 atau kasir_utama',
                    prefixIcon: Icon(Icons.badge_outlined),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Staff identifier wajib diisi' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _pinController,
                  obscureText: _obscurePin,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(
                    labelText: 'PIN Akses (6 Digit)',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePin ? Icons.visibility_off : Icons.visibility,
                      ),
                      onPressed: () => setState(() => _obscurePin = !_obscurePin),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'PIN wajib diisi';
                    if (v.length < 4) return 'PIN minimal 4 digit';
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _isLoading ? null : _handleLogin,
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
                          'Masuk & Mulai Opname',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
