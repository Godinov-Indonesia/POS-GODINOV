package id.godinov.pos.ui.cashier

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.godinov.pos.data.network.PosStaffMember
import id.godinov.pos.ui.components.InlineError
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.LocalGodinovColors

@Composable
internal fun CashierPinPanel(
    selectedStaff: PosStaffMember?,
    staffCount: Int,
    pinLength: Int,
    pinError: String?,
    lockoutRemainingSec: Int,
    isVerifyingPin: Boolean,
    isTablet: Boolean,
    onOpenCashierPicker: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CashierSelectorCard(
            selectedStaff = selectedStaff,
            staffCount = staffCount,
            onClick = onOpenCashierPicker,
        )

        Spacer(modifier = Modifier.height(if (isTablet) 28.dp else 20.dp))

        Text(
            text = "Masukkan 4-6 Digit PIN",
            style =
                if (isTablet) {
                    MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
                } else {
                    MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold)
                },
            color = colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(20.dp))

        PinIndicatorDotsRow(
            pinLength = pinLength,
            hasError = pinError != null || lockoutRemainingSec > 0,
        )

        Spacer(modifier = Modifier.height(16.dp))

        PinStatusFeedback(
            pinLength = pinLength,
            hasSelectedStaff = selectedStaff != null,
            pinError = pinError,
            lockoutRemainingSec = lockoutRemainingSec,
            isVerifyingPin = isVerifyingPin,
        )
    }
}

@Composable
private fun CashierSelectorCard(
    selectedStaff: PosStaffMember?,
    staffCount: Int,
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
        color = colorScheme.surfaceContainerLow,
        border =
            BorderStroke(
                width = if (isFocused) 2.dp else 1.dp,
                color = if (isFocused) colorScheme.primary else colorScheme.outlineVariant,
            ),
        modifier = Modifier.fillMaxWidth().heightIn(min = 68.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(extendedColors.primaryFixed),
                contentAlignment = Alignment.Center,
            ) {
                if (selectedStaff != null) {
                    Text(
                        text = staffInitials(selectedStaff.name),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = extendedColors.onPrimaryFixed,
                    )
                } else {
                    Icon(
                        imageVector = PosIcons.Person,
                        contentDescription = null,
                        tint = extendedColors.onPrimaryFixed,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = selectedStaff?.name ?: "Belum ada kasir dipilih",
                    style = MaterialTheme.typography.titleMedium,
                    color = colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val subtitle =
                    if (selectedStaff != null) {
                        val code = selectedStaff.staffIdentifier.ifBlank { "ID Kasir" }
                        "${roleDisplayLabel(selectedStaff.role)} • $code"
                    } else if (staffCount == 0) {
                        "Daftar kasir kosong. Ketuk untuk unduh data master."
                    } else {
                        "Ketuk untuk memilih dari $staffCount kasir outlet"
                    }
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = colorScheme.secondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = if (selectedStaff != null) "Ganti" else "Pilih",
                    style = MaterialTheme.typography.labelLarge,
                    color = colorScheme.primary,
                )
                Icon(
                    imageVector = PosIcons.UnfoldMore,
                    contentDescription = null,
                    tint = colorScheme.primary,
                    modifier = Modifier.size(20.dp),
                )
            }
        }
    }
}

@Composable
private fun PinIndicatorDotsRow(
    pinLength: Int,
    hasError: Boolean,
) {
    val colorScheme = MaterialTheme.colorScheme

    Row(
        horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
    ) {
        for (index in 0 until MAX_CASHIER_PIN_LENGTH) {
            val isFilled = index < pinLength
            val scale by animateFloatAsState(
                targetValue = if (isFilled) 1.12f else 1f,
                label = "pinDotScale_$index",
            )
            val fillColor =
                when {
                    hasError && isFilled -> colorScheme.error
                    isFilled -> colorScheme.primary
                    else -> colorScheme.surfaceContainerHighest
                }
            Box(
                modifier =
                    Modifier
                        .size(20.dp)
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                        }
                        .clip(CircleShape)
                        .background(fillColor)
                        .then(
                            if (!isFilled) {
                                Modifier.border(1.dp, colorScheme.outlineVariant, CircleShape)
                            } else {
                                Modifier
                            },
                        ),
            )
        }
    }
}

@Composable
private fun PinStatusFeedback(
    pinLength: Int,
    hasSelectedStaff: Boolean,
    pinError: String?,
    lockoutRemainingSec: Int,
    isVerifyingPin: Boolean,
) {
    val colorScheme = MaterialTheme.colorScheme

    when {
        lockoutRemainingSec > 0 -> {
            InlineError(
                message = "Terminal dikunci sementara. Coba lagi dalam $lockoutRemainingSec detik.",
            )
        }
        pinError != null -> {
            InlineError(message = pinError)
        }
        isVerifyingPin -> {
            Text(
                text = "Memverifikasi kredensial kasir...",
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = colorScheme.primary,
                textAlign = TextAlign.Center,
            )
        }
        !hasSelectedStaff -> {
            Text(
                text = "Pilih kasir di atas sebelum memasukkan PIN.",
                style = MaterialTheme.typography.bodyMedium,
                color = colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        pinLength in MIN_CASHIER_PIN_LENGTH..MAX_CASHIER_PIN_LENGTH -> {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            ) {
                Icon(
                    imageVector = PosIcons.CheckCircle,
                    contentDescription = null,
                    tint = colorScheme.tertiary,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    text = "$pinLength digit terisi. Tekan Masuk untuk membuka kasir.",
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = colorScheme.tertiary,
                )
            }
        }
        pinLength > 0 -> {
            Text(
                text = "Terisi $pinLength digit (minimal $MIN_CASHIER_PIN_LENGTH digit).",
                style = MaterialTheme.typography.bodyMedium,
                color = colorScheme.secondary,
                textAlign = TextAlign.Center,
            )
        }
        else -> {
            Text(
                text = "Ketik 4 sampai 6 digit PIN menggunakan tombol angka atau papan ketik.",
                style = MaterialTheme.typography.bodyMedium,
                color = colorScheme.secondary,
                textAlign = TextAlign.Center,
            )
        }
    }
}
