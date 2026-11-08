package id.godinov.pos.ui.cashier

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.godinov.pos.data.network.PosStaffMember
import id.godinov.pos.ui.components.PosBottomSheet
import id.godinov.pos.ui.components.PosPrimaryButton
import id.godinov.pos.ui.components.PosSecondaryButton
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.LocalGodinovColors

@Composable
internal fun CashierPickerSheet(
    staffs: List<PosStaffMember>,
    selectedStaffId: String?,
    isSyncingMaster: Boolean,
    onSelectStaff: (String) -> Unit,
    onRefreshMasterData: () -> Unit,
    onDismiss: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme

    PosBottomSheet(onDismiss = onDismiss) { dismiss ->
        Text(
            text = "Pilih Kasir Bertugas",
            style = MaterialTheme.typography.headlineSmall,
            color = colorScheme.onSurface,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Pilih akun staf outlet Anda lalu masukkan PIN untuk membuka kasir.",
            style = MaterialTheme.typography.bodyMedium,
            color = colorScheme.onSurfaceVariant,
        )
        Spacer(modifier = Modifier.height(20.dp))

        if (staffs.isEmpty()) {
            Surface(
                shape = MaterialTheme.shapes.large,
                color = colorScheme.surfaceContainerLow,
                border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        text = "Daftar kasir belum tersedia di perangkat ini.",
                        style = MaterialTheme.typography.titleMedium,
                        color = colorScheme.onSurface,
                    )
                    Text(
                        text =
                            "Pastikan staf kasir sudah didaftarkan untuk outlet ini di backoffice, " +
                                "lalu unduh ulang data master.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colorScheme.onSurfaceVariant,
                    )
                    PosPrimaryButton(
                        text = "Unduh Data Master",
                        icon = PosIcons.Download,
                        loading = isSyncingMaster,
                        onClick = onRefreshMasterData,
                    )
                }
            }
        } else {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(max = 360.dp)
                        .verticalScroll(rememberScrollState()),
            ) {
                for (staff in staffs) {
                    CashierOptionItem(
                        staff = staff,
                        isSelected = staff.id == selectedStaffId,
                        onClick = {
                            onSelectStaff(staff.id)
                            dismiss()
                        },
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
        PosSecondaryButton(
            text = "Tutup",
            onClick = dismiss,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun CashierOptionItem(
    staff: PosStaffMember,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    val extendedColors = LocalGodinovColors.current
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        shape = MaterialTheme.shapes.large,
        color = if (isSelected) colorScheme.secondaryContainer else colorScheme.surfaceContainerLow,
        border =
            BorderStroke(
                width = if (isFocused || isSelected) 2.dp else 1.dp,
                color =
                    when {
                        isFocused -> colorScheme.primary
                        isSelected -> colorScheme.primary
                        else -> colorScheme.surfaceContainerHigh
                    },
            ),
        modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(extendedColors.primaryFixed),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = staffInitials(staff.name),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = extendedColors.onPrimaryFixed,
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = staff.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val code = staff.staffIdentifier.ifBlank { "ID Kasir" }
                Text(
                    text = "${roleDisplayLabel(staff.role)} • $code",
                    style = MaterialTheme.typography.bodySmall,
                    color = colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (isSelected) {
                Icon(
                    imageVector = PosIcons.CheckCircle,
                    contentDescription = "Kasir terpilih",
                    tint = colorScheme.primary,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
    }
}
