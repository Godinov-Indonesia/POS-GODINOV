package id.godinov.pos.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.unit.dp

/** Outlined white secondary action, 48dp tall by default (override with `Modifier.height(..)`). */
@Composable
fun PosSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    loading: Boolean = false,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isFocused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(targetValue = if (isPressed) 0.97f else 1f, label = "secondaryPressScale")

    Surface(
        onClick = onClick,
        enabled = !loading,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.medium,
        color = colorScheme.surfaceContainerLowest,
        contentColor = colorScheme.onSurface,
        border =
            BorderStroke(
                width = if (isFocused) 2.dp else 1.dp,
                color = if (isFocused) colorScheme.primary else colorScheme.surfaceContainerHigh,
            ),
        shadowElevation = 2.dp,
        modifier =
            modifier
                .height(48.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                },
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.2.dp,
                    color = colorScheme.primary,
                )
            } else if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = colorScheme.primary,
                    modifier = Modifier.size(22.dp),
                )
            }
            Text(
                text = text,
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Medium),
                maxLines = 1,
            )
        }
    }
}
