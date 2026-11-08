package id.godinov.pos.ui.activation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.components.InlineError
import id.godinov.pos.ui.components.PosBrandCard
import id.godinov.pos.ui.components.PosPrimaryButton
import id.godinov.pos.ui.icons.PosIcons

@Composable
internal fun KeyActivationCard(
    serialKey: String,
    validationError: String?,
    isSubmitting: Boolean,
    isTablet: Boolean,
    cardPadding: Dp,
    onSerialKeyChange: (String) -> Unit,
    onClearSerialKey: () -> Unit,
    onPasteClipboard: () -> Unit,
    onSubmit: () -> Unit,
) {
    PosBrandCard(
        title = "Key App",
        icon = PosIcons.VpnKey,
        compact = !isTablet,
        contentPadding = cardPadding,
    ) {
        SerialKeyLabelRow(length = serialKey.length, isTablet = isTablet)
        Spacer(modifier = Modifier.height(12.dp))
        SerialKeyInputField(
            value = serialKey,
            hasError = validationError != null,
            enabled = !isSubmitting,
            isTablet = isTablet,
            onValueChange = onSerialKeyChange,
            onClear = onClearSerialKey,
            onPaste = onPasteClipboard,
            onDone = onSubmit,
        )
        AnimatedVisibility(visible = validationError != null) {
            validationError?.let { InlineError(message = it, modifier = Modifier.padding(top = 10.dp)) }
        }
        Spacer(modifier = Modifier.height(if (isTablet) 32.dp else 24.dp))
        PosPrimaryButton(
            text = if (isSubmitting) "Memverifikasi..." else "Verifikasi",
            onClick = onSubmit,
            icon = PosIcons.Link,
            loading = isSubmitting,
            textStyle =
                if (isTablet) {
                    MaterialTheme.typography.headlineSmall
                } else {
                    MaterialTheme.typography.titleLarge
                },
            modifier = Modifier.height(if (isTablet) 64.dp else 56.dp),
        )
    }
}

@Composable
private fun SerialKeyLabelRow(
    length: Int,
    isTablet: Boolean,
) {
    val colorScheme = MaterialTheme.colorScheme
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Serial Key",
                style = if (isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                color = colorScheme.onSurface,
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = "*", style = MaterialTheme.typography.titleMedium, color = colorScheme.error)
        }
        Text(
            text = "LISENSI RESMI · $length/$MAX_SERIAL_KEY_LENGTH",
            style = MaterialTheme.typography.labelMedium,
            color = colorScheme.secondary,
        )
    }
}
