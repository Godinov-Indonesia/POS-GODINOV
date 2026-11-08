package id.godinov.pos.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarVisuals
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.LocalGodinovColors

class PosSnackbarVisuals(
    override val message: String,
    val isError: Boolean,
) : SnackbarVisuals {
    override val actionLabel: String? = null
    override val withDismissAction: Boolean = false
    override val duration: SnackbarDuration = SnackbarDuration.Short
}

/** Replaces the visible message instead of queueing, so rapid taps never show stale feedback. */
suspend fun SnackbarHostState.showPosMessage(
    message: String,
    isError: Boolean = false,
) {
    currentSnackbarData?.dismiss()
    showSnackbar(PosSnackbarVisuals(message, isError))
}

@Composable
fun PosSnackbarHost(
    hostState: SnackbarHostState,
    modifier: Modifier = Modifier,
) {
    SnackbarHost(hostState = hostState, modifier = modifier) { data ->
        val colorScheme = MaterialTheme.colorScheme
        val isError = (data.visuals as? PosSnackbarVisuals)?.isError == true

        Snackbar(
            modifier = Modifier.widthIn(max = 560.dp),
            shape = MaterialTheme.shapes.large,
            containerColor = colorScheme.inverseSurface,
            contentColor = colorScheme.inverseOnSurface,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(
                    imageVector = if (isError) PosIcons.Warning else PosIcons.CheckCircle,
                    contentDescription = null,
                    tint = if (isError) colorScheme.errorContainer else LocalGodinovColors.current.tertiaryFixed,
                    modifier = Modifier.size(22.dp),
                )
                Text(text = data.visuals.message, style = MaterialTheme.typography.titleSmall)
            }
        }
    }
}
