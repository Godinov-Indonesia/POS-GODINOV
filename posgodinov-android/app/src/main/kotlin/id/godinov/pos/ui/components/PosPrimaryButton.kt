package id.godinov.pos.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.theme.LocalGodinovColors

/**
 * Filled primary action with a built-in loading state. Pass `Modifier.height(..)` to override the
 * 56dp default: size modifiers earlier in the chain constrain later ones.
 */
@Composable
fun PosPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    loading: Boolean = false,
    destructive: Boolean = false,
    textStyle: TextStyle = MaterialTheme.typography.titleMedium,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val isFocused by interactionSource.collectIsFocusedAsState()
    val scale by animateFloatAsState(targetValue = if (isPressed) 0.99f else 1f, label = "primaryPressScale")
    val container = if (destructive) colorScheme.error else colorScheme.primary
    val content = if (destructive) colorScheme.onError else colorScheme.onPrimary

    Button(
        onClick = onClick,
        enabled = !loading,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.large,
        border = if (isFocused) BorderStroke(2.dp, LocalGodinovColors.current.tertiaryFixed) else null,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = container,
                contentColor = content,
                disabledContainerColor = container.copy(alpha = 0.85f),
                disabledContentColor = content,
            ),
        elevation =
            ButtonDefaults.buttonElevation(
                defaultElevation = 4.dp,
                pressedElevation = 2.dp,
                disabledElevation = 0.dp,
            ),
        contentPadding = PaddingValues(horizontal = 24.dp),
        modifier =
            modifier
                .fillMaxWidth()
                .height(56.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                },
    ) {
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                icon?.let { Icon(imageVector = it, contentDescription = null, modifier = Modifier.size(24.dp)) }
                Text(text = text, style = textStyle, maxLines = 1)
            }
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.CenterEnd).size(24.dp),
                    strokeWidth = 2.5.dp,
                    color = content,
                )
            }
        }
    }
}
