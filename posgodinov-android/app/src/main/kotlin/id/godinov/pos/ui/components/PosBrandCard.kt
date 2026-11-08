package id.godinov.pos.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.LocalGodinovColors

/**
 * Elevated card with the 6dp brand accent bar, icon badge, and title shared by pre-login screens
 * (activation, device binding, cashier login). [compact] switches to phone-sized title and spacing.
 */
@Composable
fun PosBrandCard(
    title: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    contentPadding: Dp = 24.dp,
    onBack: (() -> Unit)? = null,
    backContentDescription: String = "Kembali",
    content: @Composable ColumnScope.() -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme

    // Single elevated surface separates the active task from the #F7F9FB counter canvas.
    Surface(
        shape = MaterialTheme.shapes.extraLarge,
        color = colorScheme.surfaceContainerLowest,
        shadowElevation = 6.dp,
        border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh.copy(alpha = 0.7f)),
        modifier = modifier.fillMaxWidth(),
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

            Column(modifier = Modifier.padding(contentPadding)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (onBack != null) {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier.size(48.dp),
                        ) {
                            Icon(
                                imageVector = PosIcons.ArrowBack,
                                contentDescription = backContentDescription,
                                tint = colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(24.dp),
                            )
                        }
                    }

                    Box(
                        modifier =
                            Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(LocalGodinovColors.current.primaryFixed),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = colorScheme.primary,
                            modifier = Modifier.size(24.dp),
                        )
                    }

                    Text(
                        text = title,
                        style =
                            if (compact) {
                                MaterialTheme.typography.headlineSmall
                            } else {
                                MaterialTheme.typography.headlineLarge
                            },
                        color = colorScheme.onSurface,
                    )
                }

                Spacer(modifier = Modifier.height(if (compact) 18.dp else 24.dp))
                HorizontalDivider(thickness = 1.dp, color = colorScheme.surfaceContainerHigh.copy(alpha = 0.75f))
                Spacer(modifier = Modifier.height(if (compact) 22.dp else 28.dp))

                content()
            }
        }
    }
}
