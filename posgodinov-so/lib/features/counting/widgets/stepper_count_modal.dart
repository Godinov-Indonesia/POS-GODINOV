import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_theme.dart';

class StepperCountModal extends StatefulWidget {
  final Map<String, dynamic> material;
  final double? initialPackageQty;
  final double? initialLooseQty;
  final double? initialActualStock;
  final String? initialNotes;
  final Function({
    required int actualPackages,
    required double actualLoose,
    required double actualStock,
    double? packageQty,
    String? notes,
  }) onSave;

  const StepperCountModal({
    super.key,
    required this.material,
    this.initialPackageQty,
    this.initialLooseQty,
    this.initialActualStock,
    this.initialNotes,
    required this.onSave,
  });

  static Future<void> show({
    required BuildContext context,
    required Map<String, dynamic> material,
    double? initialPackageQty,
    double? initialLooseQty,
    double? initialActualStock,
    String? initialNotes,
    required Function({
      required int actualPackages,
      required double actualLoose,
      required double actualStock,
      double? packageQty,
      String? notes,
    }) onSave,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (_) => StepperCountModal(
        material: material,
        initialPackageQty: initialPackageQty,
        initialLooseQty: initialLooseQty,
        initialActualStock: initialActualStock,
        initialNotes: initialNotes,
        onSave: onSave,
      ),
    );
  }

  @override
  State<StepperCountModal> createState() => _StepperCountModalState();
}

class _StepperCountModalState extends State<StepperCountModal> {
  late double _packageQty;
  late double _looseQty;
  late TextEditingController _notesController;

  late final bool _hasPackage;
  late final double _ratio;
  late final String _baseUnit;
  late final String _packageUnit;

  @override
  void initState() {
    super.initState();
    final mat = widget.material;
    _ratio = (mat['quantity_per_package'] as num?)?.toDouble() ?? 0.0;
    _hasPackage = _ratio > 0;
    _baseUnit = mat['unit']?.toString() ?? 'Pcs';
    _packageUnit = mat['package_unit']?.toString() ?? 'Dus';

    final totalActual = widget.initialActualStock ?? 0.0;
    final pkg = widget.initialPackageQty;
    final loose = widget.initialLooseQty;

    if (_hasPackage) {
      if (pkg != null) {
        _packageQty = pkg;
        _looseQty = loose ??
            (totalActual - (_packageQty * _ratio)).clamp(0.0, double.infinity);
      } else {
        _packageQty = (totalActual / _ratio).floorToDouble();
        _looseQty = loose ?? (totalActual % _ratio);
      }
    } else {
      _packageQty = 0.0;
      _looseQty = loose ?? totalActual;
    }

    _notesController = TextEditingController(text: widget.initialNotes ?? '');
  }

  @override
  void dispose() {
    _notesController.dispose;
    super.dispose();
  }

  double get _totalStock {
    if (_hasPackage) {
      return (_packageQty * _ratio) + _looseQty;
    }
    return _looseQty;
  }

  void _vibrateLight() {
    HapticFeedback.lightImpact();
  }

  void _showDirectInputDialog({
    required String title,
    required double currentValue,
    required String unit,
    required ValueChanged<double> onValueSubmitted,
  }) {
    final controller = TextEditingController(
      text: currentValue == 0 ? '' : (currentValue % 1 == 0 ? currentValue.toInt().toString() : currentValue.toString()),
    );

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Input $title ($unit)'),
          content: TextField(
            controller: controller,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              hintText: 'Ketik jumlah $unit',
              suffixText: unit,
              border: const OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () {
                final parsed = double.tryParse(controller.text.trim()) ?? 0.0;
                onValueSubmitted(parsed >= 0 ? parsed : 0.0);
                Navigator.of(ctx).pop();
              },
              child: const Text('Terapkan'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildStepperRow({
    required String label,
    required String unit,
    required double value,
    required VoidCallback onMinus,
    required VoidCallback onPlus,
    required VoidCallback onMiddleTap,
  }) {
    final formattedValue = value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(2);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
            color: AppTheme.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          height: 58,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.border, width: 1.5),
          ),
          child: Row(
            children: [
              // [-] Left Button
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: const BorderRadius.horizontal(left: Radius.circular(12)),
                  onTap: value > 0
                      ? () {
                          _vibrateLight();
                          onMinus();
                        }
                      : null,
                  child: Container(
                    width: 60,
                    alignment: Alignment.center,
                    child: Icon(
                      Icons.remove_rounded,
                      size: 26,
                      color: value > 0 ? AppTheme.primaryDark : Colors.grey[300],
                    ),
                  ),
                ),
              ),
              const VerticalDivider(width: 1, color: AppTheme.border),

              // Middle Clickable Row for direct number typing
              Expanded(
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      _vibrateLight();
                      onMiddleTap();
                    },
                    child: Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 180),
                            transitionBuilder: (child, animation) {
                              return SlideTransition(
                                position: Tween<Offset>(
                                  begin: const Offset(0.0, 0.2),
                                  end: Offset.zero,
                                ).animate(animation),
                                child: FadeTransition(opacity: animation, child: child),
                              );
                            },
                            child: Text(
                              '$formattedValue $unit',
                              key: ValueKey<String>('$formattedValue-$unit'),
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                          ),
                          const Text(
                            'Klik tengah untuk ketik angka',
                            style: TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const VerticalDivider(width: 1, color: AppTheme.border),

              // [+] Right Button
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(12)),
                  onTap: () {
                    _vibrateLight();
                    onPlus();
                  },
                  child: Container(
                    width: 60,
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.add_rounded,
                      size: 26,
                      color: AppTheme.primaryDark,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final mat = widget.material;
    final name = mat['name']?.toString() ?? 'Material';
    final sku = mat['sku']?.toString() ?? '-';
    final category = mat['category_name']?.toString() ?? 'Bahan Baku';

    // Zero-flicker RepaintBoundary isolation
    return RepaintBoundary(
      child: AnimatedPadding(
        padding: MediaQuery.viewInsetsOf(context),
        duration: const Duration(milliseconds: 250),
        curve: Curves.fastOutSlowIn,
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Handle bar
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Title and Category
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Kategori: $category · SKU: $sku',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                        if (_hasPackage) ...[
                          const SizedBox(height: 2),
                          Text(
                            '💡 1 $_packageUnit = $_ratio $_baseUnit',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(height: 24),

              // Row 1: Kemasan Utuh (Dus) if dual stock
              if (_hasPackage) ...[
                _buildStepperRow(
                  label: 'Kemasan Utuh ($_packageUnit)',
                  unit: _packageUnit,
                  value: _packageQty,
                  onMinus: () => setState(() => _packageQty = (_packageQty - 1).clamp(0, double.infinity)),
                  onPlus: () => setState(() => _packageQty += 1),
                  onMiddleTap: () => _showDirectInputDialog(
                    title: 'Kemasan Utuh',
                    currentValue: _packageQty,
                    unit: _packageUnit,
                    onValueSubmitted: (v) => setState(() => _packageQty = v),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Row 2: Eceran Terbuka (Base Unit)
              _buildStepperRow(
                label: _hasPackage ? 'Eceran Terbuka ($_baseUnit)' : 'Jumlah Dihitung ($_baseUnit)',
                unit: _baseUnit,
                value: _looseQty,
                onMinus: () => setState(() => _looseQty = (_looseQty - 1).clamp(0, double.infinity)),
                onPlus: () => setState(() => _looseQty += 1),
                onMiddleTap: () => _showDirectInputDialog(
                  title: _hasPackage ? 'Eceran Terbuka' : 'Jumlah',
                  currentValue: _looseQty,
                  unit: _baseUnit,
                  onValueSubmitted: (v) => setState(() => _looseQty = v),
                ),
              ),

              const SizedBox(height: 16),

              // Live Total Formula Calculation Preview
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calculate_outlined, color: AppTheme.primary, size: 22),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'TOTAL AKHIR DIHITUNG:',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.8,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _hasPackage
                                ? '${_totalStock % 1 == 0 ? _totalStock.toInt() : _totalStock.toStringAsFixed(2)} $_baseUnit  (${_packageQty.toInt()} $_packageUnit × $_ratio + ${_looseQty % 1 == 0 ? _looseQty.toInt() : _looseQty.toStringAsFixed(2)} $_baseUnit)'
                                : '${_totalStock % 1 == 0 ? _totalStock.toInt() : _totalStock.toStringAsFixed(2)} $_baseUnit',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // Notes field
              TextField(
                controller: _notesController,
                decoration: const InputDecoration(
                  labelText: 'Catatan Kondisi Fisik (Opsional)',
                  hintText: 'Misal: 1 dus kemasan penyok di sudut rak',
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
              ),

              const SizedBox(height: 20),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Batal'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: () {
                        HapticFeedback.mediumImpact();
                        widget.onSave(
                          actualPackages: _hasPackage ? _packageQty.round() : 0,
                          actualLoose: _looseQty,
                          actualStock: _totalStock,
                          packageQty: _hasPackage ? _packageQty : null,
                          notes: _notesController.text.trim().isEmpty
                              ? null
                              : _notesController.text.trim(),
                        );
                        Navigator.of(context).pop();
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      icon: const Icon(Icons.check_circle_outline, size: 20),
                      label: const Text(
                        'Simpan Hitungan',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
