package id.godinov.pos.ui.cashier

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import id.godinov.pos.R
import id.godinov.pos.data.local.ActiveShiftSession
import id.godinov.pos.ui.components.PosSecondaryButton
import id.godinov.pos.ui.icons.PosIcons

@Composable
internal fun CashierHeaderBar(
    serialBusiness: String,
    serialOutlet: String,
    lastSyncedEpochMs: Long?,
    staffCount: Int,
    productCount: Int,
    isSyncingMaster: Boolean,
    activeShift: ActiveShiftSession?,
    isWideRow: Boolean,
    isShortViewport: Boolean,
    onDownloadMasterData: () -> Unit,
    onCloseActiveShift: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme

    Column(
        modifier = modifier.widthIn(max = 1024.dp).fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(
            painter = painterResource(id = R.drawable.godinov_pos_logo),
            contentDescription = "Godinov POS",
            contentScale = ContentScale.Fit,
            modifier = Modifier.height(if (isShortViewport) 72.dp else 108.dp),
        )

        Spacer(modifier = Modifier.height(10.dp))

        Surface(
            shape = CircleShape,
            color = colorScheme.surfaceContainerLow,
            border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh),
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    imageVector = PosIcons.Storefront,
                    contentDescription = null,
                    tint = colorScheme.primary,
                    modifier = Modifier.size(20.dp),
                )
                Text(
                    text = serialBusiness.ifBlank { "Bisnis Terdaftar" },
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = colorScheme.onSurface,
                )
                Text(
                    text = "•",
                    style = MaterialTheme.typography.titleMedium,
                    color = colorScheme.onSurfaceVariant,
                )
                Icon(
                    imageVector = PosIcons.LocationOn,
                    contentDescription = null,
                    tint = colorScheme.tertiary,
                    modifier = Modifier.size(20.dp),
                )
                Text(
                    text = serialOutlet.ifBlank { "Outlet Aktif" },
                    style = MaterialTheme.typography.titleMedium,
                    color = colorScheme.secondary,
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        MasterSyncStatusBar(
            lastSyncedEpochMs = lastSyncedEpochMs,
            staffCount = staffCount,
            productCount = productCount,
            isSyncingMaster = isSyncingMaster,
            isWideRow = isWideRow,
            onDownloadMasterData = onDownloadMasterData,
        )

        if (activeShift != null) {
            Spacer(modifier = Modifier.height(12.dp))
            ActiveShiftStatusStrip(
                shift = activeShift,
                isWideRow = isWideRow,
                onCloseActiveShift = onCloseActiveShift,
            )
        }
    }
}

@Composable
private fun MasterSyncStatusBar(
    lastSyncedEpochMs: Long?,
    staffCount: Int,
    productCount: Int,
    isSyncingMaster: Boolean,
    isWideRow: Boolean,
    onDownloadMasterData: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    val syncLabel =
        buildAnnotatedString {
            append("Terakhir diunduh: ")
            withStyle(SpanStyle(color = colorScheme.onSurface, fontWeight = FontWeight.SemiBold)) {
                append(formatSyncTimestampWib(lastSyncedEpochMs))
            }
            if (lastSyncedEpochMs != null) {
                append(" ($staffCount kasir, $productCount produk)")
            }
        }

    Surface(
        shape = MaterialTheme.shapes.large,
        color = colorScheme.surfaceContainerLowest,
        border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh),
        shadowElevation = 1.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        if (isWideRow) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        imageVector = PosIcons.CloudDone,
                        contentDescription = null,
                        tint = colorScheme.tertiary,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text = syncLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colorScheme.secondary,
                    )
                }
                DownloadMasterButton(
                    loading = isSyncingMaster,
                    onClick = onDownloadMasterData,
                )
            }
        } else {
            Column(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Icon(
                        imageVector = PosIcons.CloudDone,
                        contentDescription = null,
                        tint = colorScheme.tertiary,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text = syncLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colorScheme.secondary,
                    )
                }
                DownloadMasterButton(
                    loading = isSyncingMaster,
                    onClick = onDownloadMasterData,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun DownloadMasterButton(
    loading: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = onClick,
        enabled = !loading,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.medium,
        color = colorScheme.surfaceContainerLow,
        contentColor = colorScheme.primary,
        border =
            BorderStroke(
                width = if (isFocused) 2.dp else 1.dp,
                color = if (isFocused) colorScheme.primary else colorScheme.surfaceContainerHigh,
            ),
        modifier = modifier.height(48.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = colorScheme.primary,
                )
            } else {
                Icon(
                    imageVector = PosIcons.Download,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
            }
            Text(
                text = if (loading) "Mengunduh..." else "Unduh Data Master",
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun ActiveShiftStatusStrip(
    shift: ActiveShiftSession,
    isWideRow: Boolean,
    onCloseActiveShift: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    Surface(
        shape = MaterialTheme.shapes.large,
        color = colorScheme.secondaryContainer,
        border = BorderStroke(1.dp, colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        if (isWideRow) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        imageVector = PosIcons.CheckCircle,
                        contentDescription = null,
                        tint = colorScheme.tertiary,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text =
                            "Shift aktif: ${shift.staffName} (${roleDisplayLabel(shift.staffRole)}) • " +
                                "Modal awal ${formatRupiah(shift.openingCashRupiah)}",
                        style = MaterialTheme.typography.titleSmall,
                        color = colorScheme.onSecondaryContainer,
                    )
                }
                PosSecondaryButton(
                    text = "Tutup Shift",
                    onClick = onCloseActiveShift,
                )
            }
        } else {
            Column(
                modifier = Modifier.fillMaxWidth().padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    text =
                        "Shift aktif: ${shift.staffName} (${roleDisplayLabel(shift.staffRole)}) • " +
                            "Modal awal ${formatRupiah(shift.openingCashRupiah)}",
                    style = MaterialTheme.typography.titleSmall,
                    color = colorScheme.onSecondaryContainer,
                )
                PosSecondaryButton(
                    text = "Tutup Shift",
                    onClick = onCloseActiveShift,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
