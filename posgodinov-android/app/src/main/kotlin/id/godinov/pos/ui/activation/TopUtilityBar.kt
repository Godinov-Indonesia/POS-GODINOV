package id.godinov.pos.ui.activation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.godinov.pos.ui.components.PosSecondaryButton
import id.godinov.pos.ui.icons.PosIcons

/** Tablet pins both buttons to the corners; phone splits the row into two equal halves. */
@Composable
internal fun TopUtilityBar(
    isTablet: Boolean,
    isPinging: Boolean,
    onOpenHelp: () -> Unit,
    onPingTest: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isTablet) Arrangement.SpaceBetween else Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val buttonModifier = if (isTablet) Modifier else Modifier.weight(1f)
        PosSecondaryButton(
            text = "Kendala Aktivasi",
            onClick = onOpenHelp,
            icon = PosIcons.Help,
            modifier = buttonModifier,
        )
        PosSecondaryButton(
            text = if (isPinging) "Menguji..." else "Uji Koneksi",
            onClick = onPingTest,
            icon = PosIcons.Sensors,
            loading = isPinging,
            modifier = buttonModifier,
        )
    }
}
