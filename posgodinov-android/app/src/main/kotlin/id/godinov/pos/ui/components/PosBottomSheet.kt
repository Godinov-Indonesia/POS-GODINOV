package id.godinov.pos.ui.components

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.theme.LocalGodinovColors
import kotlinx.coroutines.launch

/**
 * Modal sheet that slides up from the bottom with 24dp rounded top corners, capped at 640dp wide so it
 * centers on tablets. Call the `dismiss` lambda from [content] to animate out before [onDismiss] fires;
 * hiding it by flipping the caller's state directly skips the exit animation.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PosBottomSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.(dismiss: () -> Unit) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val dismiss: () -> Unit = {
        scope.launch { sheetState.hide() }.invokeOnCompletion {
            if (!sheetState.isVisible) onDismiss()
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
        modifier = modifier,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = 24.dp, end = 24.dp, bottom = 24.dp),
        ) {
            content(dismiss)
        }
    }
}

/** Two-button confirmation built on [PosBottomSheet]. [onConfirm] runs, then the sheet animates out. */
@Composable
fun PosConfirmSheet(
    title: String,
    message: String,
    confirmText: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    icon: ImageVector? = null,
    dismissText: String = "Batal",
    destructive: Boolean = false,
) {
    val colorScheme = MaterialTheme.colorScheme

    PosBottomSheet(onDismiss = onDismiss) { dismiss ->
        if (icon != null) {
            Box(
                modifier =
                    Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(
                            if (destructive) colorScheme.errorContainer else LocalGodinovColors.current.primaryFixed,
                        ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = if (destructive) colorScheme.error else colorScheme.primary,
                    modifier = Modifier.size(28.dp),
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        Text(text = title, style = MaterialTheme.typography.headlineSmall, color = colorScheme.onSurface)
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = message, style = MaterialTheme.typography.bodyLarge, color = colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(28.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            PosSecondaryButton(
                text = dismissText,
                onClick = dismiss,
                modifier = Modifier.weight(1f).height(56.dp),
            )
            PosPrimaryButton(
                text = confirmText,
                onClick = {
                    onConfirm()
                    dismiss()
                },
                destructive = destructive,
                modifier = Modifier.weight(1f),
            )
        }
    }
}
