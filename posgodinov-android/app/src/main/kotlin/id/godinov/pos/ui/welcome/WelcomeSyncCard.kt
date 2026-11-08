package id.godinov.pos.ui.welcome

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.components.InlineError
import id.godinov.pos.ui.components.PosPrimaryButton
import id.godinov.pos.ui.icons.PosIcons

@Composable
internal fun WelcomeSyncCard(
    uiState: WelcomeSyncUiState,
    isTablet: Boolean,
    onRetrySync: () -> Unit,
    onTriggerUnlock: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme

    Surface(
        shape = MaterialTheme.shapes.extraLarge,
        color = colorScheme.surfaceContainerLowest,
        shadowElevation = 6.dp,
        border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh.copy(alpha = 0.7f)),
        modifier = modifier.widthIn(max = 560.dp).fillMaxWidth(),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .background(
                            Brush.horizontalGradient(
                                listOf(
                                    colorScheme.primary,
                                    colorScheme.primaryContainer,
                                    colorScheme.secondaryContainer,
                                ),
                            ),
                        ),
            )

            Column(
                modifier = Modifier.padding(if (isTablet) 28.dp else 20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                when (uiState.phase) {
                    WelcomePhase.SYNCING -> {
                        Text(
                            text = "Mengunduh Data Master Outlet",
                            style = MaterialTheme.typography.titleMedium,
                            color = colorScheme.onSurface,
                        )
                        LinearProgressIndicator(
                            color = colorScheme.primary,
                            trackColor = colorScheme.surfaceContainerHighest,
                            modifier = Modifier.fillMaxWidth().height(8.dp),
                        )
                        Text(
                            text = "Menyinkronkan daftar kasir, kategori, produk, dan kebijakan kasir...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = colorScheme.onSurfaceVariant,
                        )
                    }

                    WelcomePhase.FAILED -> {
                        Text(
                            text = "Sinkronisasi Data Master Tertunda",
                            style = MaterialTheme.typography.titleMedium,
                            color = colorScheme.onSurface,
                        )
                        InlineError(
                            message =
                                uiState.errorMessage
                                    ?: "Gagal mengunduh data master dari server POS.",
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        PosPrimaryButton(
                            text = "Unduh Ulang Data Master",
                            icon = PosIcons.Download,
                            onClick = onRetrySync,
                            modifier = Modifier.height(if (isTablet) 60.dp else 56.dp),
                        )
                    }

                    WelcomePhase.READY -> {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Icon(
                                imageVector = PosIcons.CloudDone,
                                contentDescription = null,
                                tint = colorScheme.tertiary,
                                modifier = Modifier.size(22.dp),
                            )
                            Text(
                                text =
                                    "Data master siap: ${uiState.staffCount} kasir • " +
                                        "${uiState.categoryCount} kategori • ${uiState.productCount} produk",
                                style = MaterialTheme.typography.titleSmall,
                                color = colorScheme.onSurface,
                            )
                        }

                        SwipeUpPromptBar(
                            isTablet = isTablet,
                            onTriggerUnlock = onTriggerUnlock,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SwipeUpPromptBar(
    isTablet: Boolean,
    onTriggerUnlock: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val infinite = rememberInfiniteTransition(label = "swipeHint")
    // Subtle 5dp upward nudge guides the physical swipe-up gesture without decorative clutter.
    val nudgeY by infinite.animateFloat(
        initialValue = 2f,
        targetValue = -4f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "chevronNudge",
    )

    Surface(
        onClick = onTriggerUnlock,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.large,
        color = colorScheme.primary,
        contentColor = colorScheme.onPrimary,
        border =
            if (isFocused) {
                BorderStroke(2.dp, colorScheme.tertiaryContainer)
            } else {
                null
            },
        shadowElevation = 3.dp,
        modifier =
            Modifier
                .fillMaxWidth()
                .height(if (isTablet) 64.dp else 56.dp)
                .onPreviewKeyEvent { event ->
                    if (
                        event.type == KeyEventType.KeyUp &&
                        (event.key == Key.Enter || event.key == Key.NumPadEnter)
                    ) {
                        onTriggerUnlock()
                        true
                    } else {
                        false
                    }
                },
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = PosIcons.KeyboardArrowUp,
                contentDescription = null,
                modifier =
                    Modifier
                        .size(24.dp)
                        .graphicsLayer { translationY = nudgeY },
            )
            Text(
                text = "Geser ke atas untuk mulai",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                maxLines = 1,
            )
        }
    }
}
