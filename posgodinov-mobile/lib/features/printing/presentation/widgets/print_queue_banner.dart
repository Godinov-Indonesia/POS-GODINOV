import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:posgodinov_mobile/features/printing/presentation/cubit/print_queue_cubit.dart';
import 'package:posgodinov_mobile/shared/extensions/context_ext.dart';
import 'package:posgodinov_mobile/shared/theme/app_theme.dart';
import 'package:posgodinov_mobile/shared/theme/godinov_tokens.dart';
import 'package:posgodinov_mobile/shared/theme/spacing.dart';

/// Banner persisten "N struk belum tercetak" ([11 §M14.1]).
///
/// Menghilang sendiri ketika antreannya kosong — lihat catatan pada
/// [PrintQueueCubit] soal mengapa ia tidak boleh berupa SnackBar.
///
/// ⚠️ Ditempatkan pemanggilnya tepat di bawah StatusBar untuk sementara. Rumah
/// tetapnya adalah **Bottom Bar** pada M17.1; memindahkannya sekarang berarti
/// mengerjakan fase yang belum dimulai.
class PrintQueueBanner extends StatelessWidget {
  const PrintQueueBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final GodinovTokens t = context.tokens;

    return BlocBuilder<PrintQueueCubit, PrintQueueState>(
      builder: (BuildContext context, PrintQueueState state) {
        if (!state.hasUnprinted) return const SizedBox.shrink();

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: Gap.lg,
            vertical: Gap.sm,
          ),
          color: t.warningSubtle,
          child: Row(
            children: <Widget>[
              Icon(Icons.print_disabled_outlined, color: t.warningText, size: 20),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      '${state.unprinted} struk belum tercetak',
                      style: PosText.sm.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      'Datanya tetap tersimpan. Ketuk untuk mencetak ulang.',
                      style: PosText.xs.copyWith(color: t.fgMuted),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: state.retrying
                    ? null
                    : () => context.read<PrintQueueCubit>().retryAll(),
                child: Text(state.retrying ? 'Mencetak…' : 'Cetak Ulang'),
              ),
            ],
          ),
        );
      },
    );
  }
}
