import 'package:flutter/material.dart';
import '../../core/di/injection.dart';
import '../../core/error/error_formatter.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/theme/app_theme.dart';
import '../counting/counting_master_screen.dart';
import '../staff_auth/staff_select_screen.dart';

class SessionListScreen extends StatefulWidget {
  const SessionListScreen({super.key});

  @override
  State<SessionListScreen> createState() => _SessionListScreenState();
}

class _SessionListScreenState extends State<SessionListScreen> {
  bool _isLoading = false;
  List<dynamic> _sessions = [];
  String? _errorMessage;
  String _staffName = '';

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final tokenStorage = getIt<TokenStorage>();
    final name = await tokenStorage.getActiveStaffName() ?? 'Staf';
    if (mounted) {
      setState(() => _staffName = name);
      // Sapaan awal berupa Toast / SnackBar yang otomatis hilang setelah 5 detik
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.waving_hand, color: Colors.amber, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Halo, $name! Selamat bertugas.',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          duration: const Duration(seconds: 5),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      );
    }
    await _fetchSessions();
  }

  Future<void> _fetchSessions() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiClient = getIt<ApiClient>();
      final sessions = await apiClient.getAvailableSessions();
      if (mounted) {
        setState(() {
          _sessions = sessions;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = ErrorFormatter.format(
            e,
            fallback: 'Tidak dapat memuat sesi opname. Periksa koneksi ke server.',
          );
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _openCounting(Map<String, dynamic> session) {
    final rawNotes = session['notes']?.toString();
    final scope = session['scope']?.toString();
    final recountNum = session['recount_number'] as int? ?? 0;
    final baseTitle = (rawNotes != null && rawNotes.isNotEmpty)
        ? rawNotes
        : (scope == 'FULL' ? 'Stock Opname Lengkap' : 'Stock Opname Parsial');
    final title = recountNum > 0 ? '$baseTitle (Recount ke-$recountNum)' : baseTitle;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CountingMasterScreen(
          sessionId: session['id']?.toString() ?? '',
          sessionTitle: title,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Sesi Stock Opname'),
            if (_staffName.isNotEmpty)
              Text(
                'Staf: $_staffName',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
              ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.switch_account_outlined),
            tooltip: 'Ganti Staf',
            onPressed: () {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const StaffSelectScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchSessions,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'SESI TERSEDIA',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.1,
                color: AppTheme.textSecondary,
              ),
            ),
            const SizedBox(height: 12),

            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.danger.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    Text(_errorMessage!, style: const TextStyle(color: AppTheme.danger)),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: _fetchSessions,
                      child: const Text('Coba Lagi'),
                    ),
                  ],
                ),
              )
            else if (_sessions.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48.0),
                  child: Column(
                    children: [
                      Icon(Icons.inventory_outlined, size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      const Text(
                        'Tidak ada sesi opname aktif',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Minta Store Manager mem-publish form SO melalui web admin.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              )
            else
              ..._sessions.map((s) {
                final session = s as Map<String, dynamic>;
                final rawNotes = session['notes']?.toString();
                final scope = session['scope']?.toString();
                final recountNum = session['recount_number'] as int? ?? 0;
                final baseTitle = (rawNotes != null && rawNotes.isNotEmpty)
                    ? rawNotes
                    : (scope == 'FULL' ? 'Stock Opname Lengkap' : 'Stock Opname Parsial');
                final title = recountNum > 0 ? '$baseTitle (Recount ke-$recountNum)' : baseTitle;
                final status = session['status']?.toString() ?? 'OPEN';
                final isCounting = status == 'COUNTING';

                final progress = session['count_progress'] as Map<String, dynamic>?;
                final totalMat = progress?['total_materials'] ??
                    (session['materials'] as List?)?.length ??
                    0;
                final countedMat = progress?['counted_materials'] ?? 0;

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => _openCounting(session),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: isCounting
                                      ? AppTheme.primary.withValues(alpha: 0.15)
                                      : AppTheme.warning.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  status,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isCounting
                                        ? AppTheme.primaryDark
                                        : AppTheme.warning,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              if (scope != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.grey[200],
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    scope,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey[800],
                                    ),
                                  ),
                                ),
                              const Spacer(),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: AppTheme.textSecondary,
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Icon(
                                Icons.inventory_2_outlined,
                                size: 16,
                                color: Colors.grey[600],
                              ),
                              const SizedBox(width: 6),
                              Text(
                                progress != null
                                    ? '$countedMat / $totalMat material terhitung'
                                    : '$totalMat material',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
