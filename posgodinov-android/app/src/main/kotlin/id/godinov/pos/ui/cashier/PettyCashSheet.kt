package id.godinov.pos.ui.cashier

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import id.godinov.pos.data.network.PosStaffMember
import id.godinov.pos.ui.components.PosBottomSheet
import id.godinov.pos.ui.components.PosPrimaryButton
import id.godinov.pos.ui.components.PosSecondaryButton
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.LocalGodinovColors

@Composable
internal fun PettyCashSheet(
    staff: PosStaffMember,
    pettyCashDigits: String,
    parsedRupiah: Long,
    onDigitsChange: (String) -> Unit,
    onSelectPreset: (Long) -> Unit,
    onConfirmShift: () -> Unit,
    onDismiss: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    val extendedColors = LocalGodinovColors.current

    PosBottomSheet(onDismiss = onDismiss) { dismiss ->
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(extendedColors.primaryFixed),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = PosIcons.Payments,
                    contentDescription = null,
                    tint = colorScheme.primary,
                    modifier = Modifier.size(26.dp),
                )
            }
            Column {
                Text(
                    text = "Modal Awal Laci (Petty Cash)",
                    style = MaterialTheme.typography.headlineSmall,
                    color = colorScheme.onSurface,
                )
                Text(
                    text = "Kasir: ${staff.name} (${roleDisplayLabel(staff.role)})",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Surface(
            shape = MaterialTheme.shapes.large,
            color = colorScheme.surfaceContainerLow,
            border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Nominal Uang Tunai Awal Laci",
                    style = MaterialTheme.typography.labelLarge,
                    color = colorScheme.secondary,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatRupiah(parsedRupiah),
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = colorScheme.onSurface,
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
            value = if (pettyCashDigits == "0") "" else pettyCashDigits,
            onValueChange = onDigitsChange,
            singleLine = true,
            label = { Text("Masukkan nominal Rupiah (angka bulat)") },
            placeholder = { Text("Contoh: 200000") },
            prefix = { Text("Rp ") },
            shape = MaterialTheme.shapes.large,
            keyboardOptions =
                KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Done,
                ),
            keyboardActions =
                KeyboardActions(
                    onDone = {
                        onConfirmShift()
                        dismiss()
                    },
                ),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .onPreviewKeyEvent { event ->
                        if (
                            event.type == KeyEventType.KeyUp &&
                            (event.key == Key.Enter || event.key == Key.NumPadEnter)
                        ) {
                            onConfirmShift()
                            dismiss()
                            true
                        } else {
                            false
                        }
                    },
        )

        Spacer(modifier = Modifier.height(14.dp))

        Text(
            text = "Pilihan Cepat",
            style = MaterialTheme.typography.labelLarge,
            color = colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(8.dp))

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for (chunk in PettyCashPresets.chunked(2)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    for (preset in chunk) {
                        PresetNominalChip(
                            amount = preset,
                            selected = parsedRupiah == preset,
                            onClick = { onSelectPreset(preset) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            PosSecondaryButton(
                text = "Batal",
                onClick = dismiss,
                modifier = Modifier.weight(1f).height(56.dp),
            )
            PosPrimaryButton(
                text = "Buka Shift",
                icon = PosIcons.CheckCircle,
                onClick = {
                    onConfirmShift()
                    dismiss()
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun PresetNominalChip(
    amount: Long,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.medium,
        color = if (selected) colorScheme.secondaryContainer else colorScheme.surfaceContainerLow,
        contentColor = if (selected) colorScheme.onSecondaryContainer else colorScheme.onSurface,
        border =
            BorderStroke(
                width = if (isFocused || selected) 2.dp else 1.dp,
                color = if (isFocused || selected) colorScheme.primary else colorScheme.surfaceContainerHigh,
            ),
        modifier = modifier.height(48.dp),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 12.dp)) {
            Text(
                text = formatRupiah(amount),
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
            )
        }
    }
}
