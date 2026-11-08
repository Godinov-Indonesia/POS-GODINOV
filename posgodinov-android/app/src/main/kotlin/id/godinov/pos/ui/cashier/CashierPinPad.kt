package id.godinov.pos.ui.cashier

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.components.PosPrimaryButton
import id.godinov.pos.ui.icons.PosIcons

private val DigitRows =
    listOf(
        listOf('1', '2', '3'),
        listOf('4', '5', '6'),
        listOf('7', '8', '9'),
    )

@Composable
internal fun CashierPinPad(
    canSubmit: Boolean,
    isVerifyingPin: Boolean,
    isLockedOut: Boolean,
    isTablet: Boolean,
    isShortViewport: Boolean,
    onDigit: (Char) -> Unit,
    onReset: () -> Unit,
    onBackspace: () -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val keyHeight = if (isTablet && !isShortViewport) 64.dp else 56.dp
    val keysEnabled = !isVerifyingPin && !isLockedOut

    Column(
        modifier = modifier.widthIn(max = 448.dp).fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            for (row in DigitRows) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    for (digit in row) {
                        DigitPadKey(
                            digit = digit,
                            enabled = keysEnabled,
                            keyHeight = keyHeight,
                            onClick = { onDigit(digit) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                ActionPadKey(
                    label = "RESET",
                    icon = PosIcons.RestartAlt,
                    contentDescription = "Reset PIN",
                    enabled = keysEnabled,
                    keyHeight = keyHeight,
                    onClick = onReset,
                    modifier = Modifier.weight(1f),
                )
                DigitPadKey(
                    digit = '0',
                    enabled = keysEnabled,
                    keyHeight = keyHeight,
                    onClick = { onDigit('0') },
                    modifier = Modifier.weight(1f),
                )
                ActionPadKey(
                    label = "HAPUS",
                    icon = PosIcons.Backspace,
                    contentDescription = "Hapus satu digit PIN",
                    enabled = keysEnabled,
                    keyHeight = keyHeight,
                    onClick = onBackspace,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        PosPrimaryButton(
            text = "Masuk",
            onClick = onSubmit,
            enabled = canSubmit,
            icon = PosIcons.Login,
            loading = isVerifyingPin,
            modifier = Modifier.height(if (isTablet) 60.dp else 56.dp),
        )
    }
}

@Composable
private fun DigitPadKey(
    digit: Char,
    enabled: Boolean,
    keyHeight: Dp,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isFocused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(targetValue = if (isPressed) 0.96f else 1f, label = "digitKey_$digit")

    Surface(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.large,
        color = if (isPressed) colorScheme.secondaryContainer else colorScheme.surfaceContainerLow,
        contentColor = colorScheme.onSurface,
        border =
            BorderStroke(
                width = if (isFocused) 2.dp else 1.dp,
                color = if (isFocused) colorScheme.primary else colorScheme.surfaceContainerHigh,
            ),
        shadowElevation = 1.dp,
        modifier =
            modifier
                .height(keyHeight)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = digit.toString(),
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            )
        }
    }
}

@Composable
private fun ActionPadKey(
    label: String,
    icon: ImageVector,
    contentDescription: String,
    enabled: Boolean,
    keyHeight: Dp,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isFocused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(targetValue = if (isPressed) 0.96f else 1f, label = "actionKey_$label")

    Surface(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.large,
        color = if (isPressed) colorScheme.secondaryContainer else colorScheme.surfaceContainerHigh,
        contentColor = colorScheme.onSurfaceVariant,
        border =
            if (isFocused) {
                BorderStroke(2.dp, colorScheme.primary)
            } else {
                BorderStroke(1.dp, colorScheme.outlineVariant)
            },
        shadowElevation = 1.dp,
        modifier =
            modifier
                .height(keyHeight)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                modifier = Modifier.size(22.dp),
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}
