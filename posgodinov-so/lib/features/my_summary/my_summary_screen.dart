import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class MySummaryScreen extends StatelessWidget {
  final String sessionId;
  final String sessionTitle;
  final Map<String, Map<String, dynamic>> myCounts;
  final List<Map<String, dynamic>> allMaterials;

  const MySummaryScreen({
    super.key,
    required this.sessionId,
    required this.sessionTitle,
    required this.myCounts,
    required this.allMaterials,
  });

  @override
  Widget build(BuildContext context) {
    final totalMaterials = allMaterials.length;
    final countedMaterials = myCounts.length;
    final progress = totalMaterials > 0 ? (countedMaterials / totalMaterials) : 0.0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rekap Hitungan Saya'),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Header stats card
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.primary,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withOpacity(0.25),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Kemajuan Area Anda',
                        style: TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      Text(
                        '${(progress * 100).toInt()}%',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                      minHeight: 8,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMetric(
                        label: 'Sudah Dihitung',
                        value: countedMaterials.toString(),
                      ),
                      Container(height: 30, width: 1, color: Colors.white24),
                      _buildMetric(
                        label: 'Belum Dihitung',
                        value: (totalMaterials - countedMaterials).toString(),
                      ),
                      Container(height: 30, width: 1, color: Colors.white24),
                      _buildMetric(
                        label: 'Total Material',
                        value: totalMaterials.toString(),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'DAFTAR ITEM YANG TELAH DIHITUNG',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ),
            ),

            Expanded(
              child: countedMaterials == 0
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 54, color: Colors.grey[400]),
                          const SizedBox(height: 12),
                          const Text(
                            'Belum ada item yang Anda hitung',
                            style: TextStyle(fontSize: 15, color: AppTheme.textSecondary),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: myCounts.length,
                      itemBuilder: (ctx, index) {
                        final matId = myCounts.keys.elementAt(index);
                        final count = myCounts[matId]!;
                        final material = allMaterials.firstWhere(
                          (m) => m['id'] == matId,
                          orElse: () => {'name': 'Material'},
                        );

                        final name = material['name']?.toString() ?? 'Material';
                        final unit = material['unit']?.toString() ?? 'Pcs';
                        final packageUnit = material['package_unit']?.toString();
                        final packageQty = count['package_qty'] as double?;
                        final actualStock = count['actual_stock'] as double? ?? 0.0;
                        final notes = count['notes'] as String?;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle, color: AppTheme.success, size: 22),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      if (notes != null && notes.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          'Catatan: $notes',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontStyle: FontStyle.italic,
                                            color: AppTheme.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '${actualStock % 1 == 0 ? actualStock.toInt() : actualStock.toStringAsFixed(2)} $unit',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textPrimary,
                                      ),
                                    ),
                                    if (packageQty != null) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        '(${packageQty.toInt()} $packageUnit)',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppTheme.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),

            Padding(
              padding: const EdgeInsets.all(16.0),
              child: FilledButton(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Hitungan Anda tersimpan dan tersinkronisasi.'),
                      backgroundColor: AppTheme.success,
                    ),
                  );
                  Navigator.of(context).pop();
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text(
                  'Selesai & Kembali ke Layar Hitung',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetric({required String label, required String value}) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Colors.white70),
        ),
      ],
    );
  }
}
