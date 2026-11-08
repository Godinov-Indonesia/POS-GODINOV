package id.godinov.pos.ui.activation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.icons.PosIcons

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun DiagnosticCapabilityRail(isWideLayout: Boolean) {
    val colorScheme = MaterialTheme.colorScheme
    val items =
        listOf(
            Triple(PosIcons.VerifiedUser, "Koneksi HTTPS Terlindungi", colorScheme.tertiary),
            Triple(PosIcons.Devices, "Dukungan Tablet Android 10\" - 14\"", colorScheme.primary),
            Triple(PosIcons.Database, "Sinkronisasi Otomatis Cloud POS", colorScheme.secondary),
            Triple(PosIcons.CloudOff, "Dukungan Penuh Offline", colorScheme.tertiary),
        )

    if (isWideLayout) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            items.forEachIndexed { index, (icon, label, tint) ->
                CapabilityBadgeItem(icon = icon, label = label, iconTint = tint)
                if (index < items.lastIndex) {
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.CenterVertically)
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(colorScheme.outlineVariant),
                    )
                }
            }
        }
    } else {
        // Phone portrait reflows into paired rows so no separator dot is orphaned at a line end.
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items.chunked(2).forEach { rowItems ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    rowItems.forEach { (icon, label, tint) ->
                        CapabilityBadgeItem(
                            icon = icon,
                            label = label,
                            iconTint = tint,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CapabilityBadgeItem(
    icon: ImageVector,
    label: String,
    iconTint: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
