import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/di/injection.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/token_storage.dart';
import '../../core/theme/app_theme.dart';
import '../my_summary/my_summary_screen.dart';
import 'widgets/barcode_scanner_modal.dart';
import 'widgets/stepper_count_modal.dart';

class CountingMasterScreen extends StatefulWidget {
  final String sessionId;
  final String sessionTitle;

  const CountingMasterScreen({
    super.key,
    required this.sessionId,
    required this.sessionTitle,
  });

  @override
  State<CountingMasterScreen> createState() => _CountingMasterScreenState();
}

class _CountingMasterScreenState extends State<CountingMasterScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  String _staffName = '';

  List<Map<String, dynamic>> _allMaterials = [];
  // Local counts map: materialId -> { 'actual_stock': double, 'package_qty': double?, 'notes': String? }
  final Map<String, Map<String, dynamic>> _myCounts = {};

  String _searchQuery = '';
  int _selectedFilterIndex = 0; // 0: Semua, 1: Belum, 2: Selesai
  bool _isSyncing = false;

  // Hardware barcode scanner buffer
  final StringBuffer _hardwareScanBuffer = StringBuffer();
  DateTime _lastHardwareKeyTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadStaffAndData();
    HardwareKeyboard.instance.addHandler(_handleHardwareKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_handleHardwareKey);
    super.dispose();
  }

  bool _handleHardwareKey(KeyEvent event) {
    if (event is KeyDownEvent) {
      final now = DateTime.now();
      // Hardware scanners typically send keys in rapid succession (< 50ms per key)
      if (now.difference(_lastHardwareKeyTime).inMilliseconds > 200) {
        _hardwareScanBuffer.clear();
      }
      _lastHardwareKeyTime = now;

      if (event.logicalKey == LogicalKeyboardKey.enter) {
        final scanned = _hardwareScanBuffer.toString().trim();
        _hardwareScanBuffer.clear();
        if (scanned.isNotEmpty) {
          _onScanDetected(scanned);
          return true;
        }
      } else {
        final char = event.character;
        if (char != null && char.isNotEmpty) {
          _hardwareScanBuffer.write(char);
        }
      }
    }
    return false;
  }

  Future<void> _loadStaffAndData() async {
    final tokenStorage = getIt<TokenStorage>();
    _staffName = await tokenStorage.getActiveStaffName() ?? 'Staf';

    await _fetchFormDetail();
    await _fetchMyCounts();
  }

  String _formatStock(double val) {
    return val % 1 == 0 ? val.toInt().toString() : val.toStringAsFixed(2);
  }

  Future<void> _fetchFormDetail() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiClient = getIt<ApiClient>();
      final data = await apiClient.getFormForCounting(widget.sessionId);
      final rawMaterials = data['materials'] as List<dynamic>? ?? [];

      setState(() {
        _allMaterials = rawMaterials.map((m) {
          final map = Map<String, dynamic>.from(m as Map);
          final id = (map['raw_material_id'] ?? map['id'] ?? '').toString();
          final name =
              (map['raw_material_name'] ?? map['name'] ?? 'Bahan').toString();
          map['id'] = id;
          map['raw_material_id'] = id;
          map['name'] = name;
          map['raw_material_name'] = name;
          return map;
        }).toList();
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Gagal memuat form: ${e.toString()}';
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchMyCounts() async {
    try {
      final apiClient = getIt<ApiClient>();
      final summary = await apiClient.getMyCounts(widget.sessionId);
      final items = summary['items'] as List<dynamic>? ?? [];

      setState(() {
        for (final item in items) {
          final map = item as Map<String, dynamic>;
          final matId = map['raw_material_id']?.toString() ?? '';
          if (matId.isNotEmpty) {
            final pkgs = (map['actual_packages'] as num?)?.toInt() ?? 0;
            _myCounts[matId] = {
              'actual_stock': (map['actual_stock'] as num?)?.toDouble() ?? 0.0,
              'actual_packages': pkgs,
              'actual_loose': (map['actual_loose'] as num?)?.toDouble() ?? 0.0,
              'package_qty': pkgs > 0 ? pkgs.toDouble() : null,
              'notes': map['notes']?.toString(),
            };
          }
        }
      });
    } catch (_) {
      // Offline fallback: keep existing in-memory/drift counts
    }
  }

  // ── Auto-Popup Scanner Action ──────────────────────────────────────────────
  void _onScanDetected(String barcodeOrSku) {
    final query = barcodeOrSku.trim().toLowerCase();
    if (query.isEmpty) return;

    // Search material by barcode or SKU
    final match = _allMaterials.firstWhere(
      (m) =>
          (m['barcode']?.toString().toLowerCase() == query) ||
          (m['sku']?.toString().toLowerCase() == query),
      orElse: () => {},
    );

    if (match.isNotEmpty) {
      HapticFeedback.lightImpact();
      _openCountingModal(match);
    } else {
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Barang "$barcodeOrSku" tidak terdaftar di sesi SO ini!'),
          backgroundColor: AppTheme.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _openCountingModal(Map<String, dynamic> material) {
    final matId = material['id']?.toString() ?? '';
    final existing = _myCounts[matId];

    StepperCountModal.show(
      context: context,
      material: material,
      initialActualStock: existing?['actual_stock'] as double?,
      initialPackageQty: existing?['package_qty'] as double? ??
          (existing?['actual_packages'] as int?)?.toDouble(),
      initialLooseQty: existing?['actual_loose'] as double?,
      initialNotes: existing?['notes'] as String?,
      onSave: ({
        required actualPackages,
        required actualLoose,
        required actualStock,
        packageQty,
        notes,
      }) {
        setState(() {
          _myCounts[matId] = {
            'actual_stock': actualStock,
            'actual_packages': actualPackages,
            'actual_loose': actualLoose,
            'package_qty': packageQty,
            'notes': notes,
          };
        });

        // Trigger sync in background with exact backend payload
        _syncCountEntry(matId, actualPackages, actualLoose, notes);
      },
    );
  }

  Future<void> _syncCountEntry(
    String matId,
    int actualPackages,
    double actualLoose,
    String? notes,
  ) async {
    setState(() => _isSyncing = true);
    try {
      final apiClient = getIt<ApiClient>();
      await apiClient.submitCounts(
        formId: widget.sessionId,
        items: [
          {
            'raw_material_id': matId,
            'actual_packages': actualPackages,
            'actual_loose': actualLoose,
            'notes': notes ?? '',
          }
        ],
      );
    } catch (_) {
      // Offline: kept locally in memory and local SQLite
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  List<Map<String, dynamic>> get _filteredMaterials {
    final query = _searchQuery.trim().toLowerCase();

    return _allMaterials.where((m) {
      final name = m['name']?.toString().toLowerCase() ?? '';
      final sku = m['sku']?.toString().toLowerCase() ?? '';
      final barcode = m['barcode']?.toString().toLowerCase() ?? '';
      final matchesSearch = query.isEmpty ||
          name.contains(query) ||
          sku.contains(query) ||
          barcode.contains(query);

      if (!matchesSearch) return false;

      final matId = m['id']?.toString() ?? '';
      final isCounted = _myCounts.containsKey(matId);

      if (_selectedFilterIndex == 1) return !isCounted; // Belum dihitung
      if (_selectedFilterIndex == 2) return isCounted; // Selesai
      return true; // Semua
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final totalCount = _allMaterials.length;
    final countedCount = _myCounts.length;
    final uncountedCount = totalCount - countedCount;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.sessionTitle,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _isSyncing ? AppTheme.warning : AppTheme.success,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _isSyncing ? 'Menyinkronkan...' : '$_staffName (Tersimpan)',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.assessment_outlined),
            tooltip: 'Hitungan Saya',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => MySummaryScreen(
                    sessionId: widget.sessionId,
                    sessionTitle: widget.sessionTitle,
                    myCounts: _myCounts,
                    allMaterials: _allMaterials,
                  ),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Sticky Header: Search Bar & Camera Scan Button ──────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: TextField(
                      onChanged: (val) => setState(() => _searchQuery = val),
                      decoration: InputDecoration(
                        hintText: 'Cari nama bahan, SKU, barcode...',
                        hintStyle: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () => setState(() => _searchQuery = ''),
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  icon: const Icon(Icons.camera_alt_outlined),
                  tooltip: 'Scan Barcode Kamera',
                  style: IconButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    BarcodeScannerModal.show(
                      context: context,
                      onBarcodeDetected: _onScanDetected,
                    );
                  },
                ),
              ],
            ),
          ),

          // ── Quick Filter Tabs ──────────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip(0, 'Semua ($totalCount)'),
                const SizedBox(width: 8),
                _buildFilterChip(1, 'Belum ($uncountedCount)'),
                const SizedBox(width: 8),
                _buildFilterChip(2, 'Selesai ($countedCount)'),
              ],
            ),
          ),
          const Divider(height: 1),

          // ── Material List View ─────────────────────────────────────────────
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(_errorMessage!, style: const TextStyle(color: AppTheme.danger)),
                            const SizedBox(height: 8),
                            ElevatedButton(
                              onPressed: _fetchFormDetail,
                              child: const Text('Coba Lagi'),
                            ),
                          ],
                        ),
                      )
                    : _filteredMaterials.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.search_off_rounded, size: 48, color: Colors.grey[400]),
                                const SizedBox(height: 8),
                                const Text(
                                  'Tidak ada bahan baku yang cocok',
                                  style: TextStyle(color: AppTheme.textSecondary),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredMaterials.length,
                            itemBuilder: (ctx, index) {
                              final material = _filteredMaterials[index];
                              return _buildMaterialCard(material);
                            },
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(int index, String label) {
    final isSelected = _selectedFilterIndex == index;
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => setState(() => _selectedFilterIndex = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : AppTheme.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppTheme.primary : AppTheme.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.white : AppTheme.textPrimary,
          ),
        ),
      ),
    );
  }

  Widget _buildMaterialCard(Map<String, dynamic> material) {
    final matId = material['id']?.toString() ?? '';
    final name = material['name']?.toString() ?? 'Material';
    final sku = material['sku']?.toString() ?? '-';
    final barcode = material['barcode']?.toString() ?? '';
    final unit = material['unit']?.toString() ?? 'Pcs';
    final packageUnit = material['package_unit']?.toString();
    final ratio = (material['quantity_per_package'] as num?)?.toDouble() ?? 0.0;
    final hasPackage = ratio > 0 && packageUnit != null;

    final countData = _myCounts[matId];
    final isCounted = countData != null;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          HapticFeedback.lightImpact();
          _openCountingModal(material);
        },
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Count status badge
                  if (isCounted)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.success.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check_circle, size: 14, color: AppTheme.success),
                          const SizedBox(width: 4),
                          Text(
                            countData['package_qty'] != null
                                ? '${(countData['package_qty'] as num).toInt()} $packageUnit'
                                : '${_formatStock((countData['actual_stock'] as num).toDouble())} $unit',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.success,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.grey.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        '⚪ Belum Dihitung',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'SKU: $sku ${barcode.isNotEmpty ? '· Barcode: $barcode' : ''}',
                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
              if (hasPackage) ...[
                const SizedBox(height: 4),
                Text(
                  'Kemasan: $packageUnit (Isi $ratio $unit)',
                  style: const TextStyle(fontSize: 12, color: AppTheme.primaryDark),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
