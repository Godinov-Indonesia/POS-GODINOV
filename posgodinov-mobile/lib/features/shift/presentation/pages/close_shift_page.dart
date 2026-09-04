import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/core/di/injection.dart';
import 'package:posgodinov_mobile/features/auth/presentation/cubit/cashier_auth_cubit.dart';
import 'package:posgodinov_mobile/features/shift/domain/close_shift_saga.dart';
import 'package:posgodinov_mobile/features/shift/domain/entities/shift.dart';
import 'package:posgodinov_mobile/features/shift/presentation/cubit/shift_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';
import 'package:posgodinov_mobile/shared/widgets/touch_button.dart';

/// **P-12 — Tutup Shift.** Blind Closing, butir 9 ([11 §M15.3]).
///
/// ═══════════════════════════════════════════════════════════════════════════
/// APA YANG SENGAJA TIDAK ADA DI LAYAR INI
/// ═══════════════════════════════════════════════════════════════════════════
///
///   ⛔ modal awal laci              ⛔ penjualan tunai / non-tunai
///   ⛔ "SEHARUSNYA DI LACI"         ⛔ blok SELISIH (PAS / KURANG / LEBIH)
///   ⛔ jumlah transaksi             ⛔ dialog konfirmasi selisih
///
/// Semuanya pernah ada di sini dan **dihapus dari kode**, bukan disembunyikan
/// di balik flag. Kode yang disembunyikan akan dinyalakan kembali oleh orang
/// yang tidak tahu mengapa ia dimatikan.
///
/// Alasannya satu kalimat: angka deklarasi yang diketik sambil melihat
/// ekspektasi tidak memiliki nilai audit apa pun. Kasir yang tahu laci
/// *seharusnya* berisi Rp 3.240.000 akan mengetik Rp 3.240.000, apa pun isi
/// lacinya.
///
/// Dialog "Selisih kas terdeteksi" ikut hilang dengan alasan yang sama, dan
/// itu penting untuk dicatat: dialog itu justru **memberi tahu** kasir bahwa
/// hitungannya meleset, lalu menawarkan tombol "Hitung Ulang". Ia mengubah
/// penutupan shift dari kesaksian menjadi permainan tebak sampai benar.
///
/// Modal awal pun ikut hilang — ia suku pertama rumus ekspektasi, dan kasir
/// yang melihatnya bersama penjualan tunai dapat menghitung sisanya di kepala.
class CloseShiftPage extends StatefulWidget {
  const CloseShiftPage({super.key, this.onClosed});

  /// Dipanggil setelah saga selesai — pemanggil menutup layar ini dan gerbang
  /// navigasi mengarahkan ke Login (butir 17, [11 §M15.4]).
  final VoidCallback? onClosed;

  @override
  State<CloseShiftPage> createState() => _CloseShiftPageState();
}

class _CloseShiftPageState extends State<CloseShiftPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // `beginClose`, bukan `prepareClose`: tidak ada apa pun yang disiapkan
      // atau dihitung — lihat catatan pada [ShiftCubit.beginClose].
      if (mounted) context.read<ShiftCubit>().beginClose();
    });
  }

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Scaffold(
      appBar: AppBar(title: const Text('Tutup Shift')),
      backgroundColor: t.bg,
      body: BlocConsumer<ShiftCubit, ShiftState>(
        listener: (BuildContext context, ShiftState state) {
          if (state is ShiftClosed) widget.onClosed?.call();
        },
        builder: (BuildContext context, ShiftState state) {
          return switch (state) {
            ShiftClosing(shift: final Shift shift) => _BlindCloseForm(
                // `key` mengikat state isian pada shift-nya: pergantian shift
                // melahirkan formulir baru, sehingga tidak ada angka milik
                // shift sebelumnya yang tertinggal di kotak isian.
                key: ValueKey<String>(shift.id),
                shift: shift,
              ),
            ShiftClosed() => const _Done(),
            ShiftFailure(message: final String m) => _Failed(message: m),
            _ => const Center(child: CircularProgressIndicator()),
          };
        },
      ),
    );
  }
}

/// Formulir tiga isian. Tidak ada yang keempat.
class _BlindCloseForm extends StatefulWidget {
  const _BlindCloseForm({super.key, required this.shift});

  final Shift shift;

  @override
  State<_BlindCloseForm> createState() => _BlindCloseFormState();
}

class _BlindCloseFormState extends State<_BlindCloseForm> {
  int _cashRupiah = 0;
  int _edcRupiah = 0;
  int _qrisRupiah = 0;

  /// Laci WAJIB diisi; EDC dan QRIS boleh kosong.
  ///
  /// Outlet yang tidak menerima keduanya sepanjang shift memang tidak punya
  /// angka untuk dideklarasikan, dan memaksa mereka mengetik "0" hanya melatih
  /// kebiasaan mengetik nol.
  bool _cashTouched = false;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(Gap.xl),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              // Identitas shift. Waktu mulai, bukan lama berjalan — kasir
              // mencocokkannya dengan catatan serah terima, bukan menghitung.
              Container(
                padding: const EdgeInsets.all(Gap.lg),
                decoration: BoxDecoration(
                  color: t.surface,
                  borderRadius: BorderRadius.circular(Radii.lg),
                  border: Border.all(color: t.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    Text('Shift dimulai', style: PosText.sm.copyWith(color: t.fgMuted)),
                    Text(
                      _formatTime(widget.shift.clientOpenedAt.toLocal()),
                      style: PosText.base.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: Gap.xl),
              _DeclarationField(
                label: 'Uang Fisik di Laci',
                hint: 'Hitung seluruh isi laci, termasuk modal awal.',
                autofocus: true,
                onChanged: (int value) => setState(() {
                  _cashRupiah = value;
                  _cashTouched = true;
                }),
              ),

              const SizedBox(height: Gap.lg),
              _DeclarationField(
                label: 'Total Settle EDC',
                hint: 'Angka pada struk settlement mesin EDC.',
                onChanged: (int value) => setState(() => _edcRupiah = value),
              ),

              const SizedBox(height: Gap.lg),
              _DeclarationField(
                label: 'Total Settle QRIS',
                hint: 'Angka pada laporan settlement QRIS.',
                onChanged: (int value) => setState(() => _qrisRupiah = value),
              ),

              const SizedBox(height: Gap.xl),
              Container(
                padding: const EdgeInsets.all(Gap.lg),
                decoration: BoxDecoration(
                  color: t.info.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(Radii.md),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Icon(Icons.visibility_off_outlined, size: 20, color: t.info),
                    const SizedBox(width: Gap.sm),
                    Expanded(
                      child: Text(
                        'Hitung dulu, jangan mencocokkan. Aplikasi sengaja tidak '
                        'menampilkan angka sistem — isi apa adanya sesuai hasil '
                        'hitungan. Selisih ditinjau di kantor, bukan di layar ini.',
                        style: PosText.sm.copyWith(color: t.fgMuted),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: Gap.xl),
              TouchButton(
                label: 'Tutup Shift',
                icon: Icons.lock_outline,
                variant: TouchVariant.danger,
                onPressed: _cashTouched ? _submit : null,
              ),
              const SizedBox(height: Gap.md),
              Text(
                'Angka yang Anda isi tidak dapat diubah dari perangkat ini.',
                textAlign: TextAlign.center,
                style: PosText.sm.copyWith(color: t.fgMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Menutup shift **tanpa dialog selisih**.
  ///
  /// Satu konfirmasi tetap ada — penutupan tidak dapat dibatalkan — tetapi ia
  /// tidak memuat satu angka pun. Konfirmasi yang menampilkan selisih adalah
  /// kebocoran yang sama dengan menampilkannya di formulir, hanya terjadi satu
  /// ketukan lebih lambat.
  Future<void> _submit() async {
    final ShiftCubit cubit = context.read<ShiftCubit>();

    final bool? lanjut = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: const Text('Tutup shift sekarang?', style: PosText.buttonLg),
        content: const Text(
          'Setelah shift ditutup, Anda akan kembali ke layar Login dan tidak '
          'dapat mengubah angka yang sudah diisi.',
          style: PosText.base,
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Tutup Shift'),
          ),
        ],
      ),
    );
    if (lanjut != true) return;

    // ── Saga tutup shift, butir 17 ([11 §M15.4]) ────────────────────────
    //
    // Layar ini TIDAK memanggil `ShiftCubit.closeShift` langsung. Saga-lah yang
    // menjaga urutan enam langkahnya — tulis, cetak, sync bertenggat, bersihkan
    // sesi, arahkan — dan membiarkan layar memanggil repositori sendiri berarti
    // salah satu langkah itu akan terlewat pada layar berikutnya yang menyalin
    // pola ini.
    final CloseShiftOutcome outcome = await getIt<CloseShiftSaga>().run(
      shift: widget.shift,
      declaredCashMinor: _cashRupiah * 100,
      declaredEdcMinor: _edcRupiah * 100,
      declaredQrisMinor: _qrisRupiah * 100,
      cashierName: getIt<CashierAuthCubit>().session?.name ?? '-',
    );

    if (!outcome.ok) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(outcome.error ?? 'Gagal menutup shift.')),
        );
      }
      return;
    }

    // Cubit disetel ke `ShiftClosed` supaya layar menampilkan konfirmasi
    // ringkas — TANPA satu angka pun — sebelum pemanggil mengalihkan ke Login.
    cubit.markClosedAfterSaga();

    // Jeda supaya konfirmasinya sempat terbaca.
    //
    // `clearSession()` di bawah memancarkan `CashierLoggedOut`, dan `AppGate`
    // menanggapinya dengan `popUntil(isFirst)` seketika. Tanpa jeda ini, layar
    // `_Done` lahir dan mati dalam satu bingkai, dan kasir yang menutup shift
    // di outlet tanpa sinyal tidak punya cara membedakan penutupan yang
    // berhasil dari layar yang sekadar kembali sendiri.
    //
    // Ini padanan mobile dari banner "Shift ditutup" di layar Login versi web:
    // `AppGate.goTo` tidak membawa parameter, sehingga konfirmasinya harus
    // ditampilkan sebelum berpindah, bukan sesudah.
    await Future<void>.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    // ── Langkah 5 & 6 — bersihkan sesi lalu arahkan ─────────────────────
    //
    // Sesi dibersihkan DI SINI, bukan di dalam saga: saga hidup di lapisan
    // domain dan tidak boleh tahu apa pun tentang Cubit presentasi. Yang
    // dijaga saga adalah urutan langkah keuangannya.
    //
    // `popUntil(isFirst)` pada `AppGate` membuang seluruh tumpukan navigasi,
    // sehingga tombol back perangkat TIDAK dapat kembali ke layar ini —
    // butir 17 ([11 §M15.4]).
    getIt<CashierAuthCubit>().clearSession();
  }

  static String _formatTime(DateTime dt) =>
      '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
}

/// Satu isian deklarasi.
class _DeclarationField extends StatelessWidget {
  const _DeclarationField({
    required this.label,
    required this.hint,
    required this.onChanged,
    this.autofocus = false,
  });

  final String label;
  final String hint;
  final ValueChanged<int> onChanged;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: PosText.sm.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: Gap.xs),
        TextField(
          autofocus: autofocus,
          keyboardType: TextInputType.number,
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(9),
          ],
          onChanged: (String raw) {
            final String digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
            onChanged(digits.isEmpty ? 0 : int.parse(digits));
          },
          style: PosText.moneyXl,
          decoration: const InputDecoration(prefixText: 'Rp ', hintText: '0'),
        ),
        const SizedBox(height: Gap.xs),
        Text(hint, style: PosText.xs.copyWith(color: t.fgMuted)),
      ],
    );
  }
}

/// Konfirmasi setelah shift tertutup — **tanpa satu angka pun** (butir 17).
class _Done extends StatelessWidget {
  const _Done();

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.check_circle_outline, size: 56, color: t.successText),
            const SizedBox(height: Gap.lg),
            const Text('Shift ditutup', style: PosText.buttonLg),
            const SizedBox(height: Gap.sm),
            Text(
              'Data tersimpan dan akan terkirim otomatis.\n'
              'Mengalihkan ke layar Login…',
              textAlign: TextAlign.center,
              style: PosText.sm.copyWith(color: t.fgMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.error_outline, size: 56, color: t.danger),
            const SizedBox(height: Gap.lg),
            Text(message, textAlign: TextAlign.center, style: PosText.base),
          ],
        ),
      ),
    );
  }
}
