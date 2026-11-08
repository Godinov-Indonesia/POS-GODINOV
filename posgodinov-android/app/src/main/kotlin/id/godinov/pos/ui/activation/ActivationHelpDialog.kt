package id.godinov.pos.ui.activation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.icons.PosIcons

@Composable
internal fun ActivationHelpDialog(
    step: ActivationStep,
    apiBaseUrl: String,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = PosIcons.Help,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
        },
        title = {
            Text(
                text =
                    when (step) {
                        ActivationStep.SERIAL_KEY -> "Bantuan Aktivasi Terminal"
                        ActivationStep.DEVICE_BINDING -> "Bantuan Penautan Perangkat"
                    },
                style = MaterialTheme.typography.titleLarge,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                when (step) {
                    ActivationStep.SERIAL_KEY -> {
                        Text(
                            text = "1. Pastikan Serial Key sesuai dengan kode lisensi perangkat pada dashboard Godinov POS.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = "2. Tekan tombol Uji Koneksi di kanan atas untuk memastikan perangkat dapat menjangkau server ($apiBaseUrl).",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = "3. Setelah Serial Key terverifikasi, Anda akan diarahkan untuk menautkan kredensial bisnis dan outlet.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    ActivationStep.DEVICE_BINDING -> {
                        Text(
                            text = "1. Masukkan Serial Business dan Serial Outlet (serial_tenant) yang tertera pada menu Outlet di dashboard bisnis.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = "2. Gunakan Password Business Owner untuk mengotorisasi pengikatan terminal ke outlet tersebut.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = "3. Pastikan Uji Koneksi ke server ($apiBaseUrl) berhasil sebelum menekan tombol Tautkan.",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.height(48.dp),
            ) {
                Text("Tutup")
            }
        },
    )
}
