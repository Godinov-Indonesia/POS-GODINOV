package id.godinov.pos.ui.cashier

import id.godinov.pos.data.local.ActiveShiftSession
import id.godinov.pos.data.network.PosStaffMember
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal const val MIN_CASHIER_PIN_LENGTH = 4
internal const val MAX_CASHIER_PIN_LENGTH = 6
internal const val MAX_PIN_ATTEMPTS = 5
internal const val PIN_LOCKOUT_SECONDS = 60
internal const val MAX_RUPAIAH_DIGITS = 10

internal val PettyCashPresets: List<Long> = listOf(0L, 200_000L, 500_000L, 1_000_000L)

data class CashierLoginUiState(
    val serialBusiness: String = "",
    val serialOutlet: String = "",
    val staffs: List<PosStaffMember> = emptyList(),
    val selectedStaffId: String? = null,
    val pin: String = "",
    val pinError: String? = null,
    val lockoutRemainingSec: Int = 0,
    val isVerifyingPin: Boolean = false,
    val isSyncingMaster: Boolean = false,
    val lastSyncedEpochMs: Long? = null,
    val categoryCount: Int = 0,
    val productCount: Int = 0,
    val isPettyCashSheetOpen: Boolean = false,
    val pettyCashStaff: PosStaffMember? = null,
    val pettyCashDigits: String = "0",
    val activeShift: ActiveShiftSession? = null,
) {
    val selectedStaff: PosStaffMember?
        get() = staffs.firstOrNull { it.id == selectedStaffId } ?: staffs.firstOrNull()

    val isLockedOut: Boolean
        get() = lockoutRemainingSec > 0

    val canSubmitPin: Boolean
        get() =
            selectedStaff != null &&
                pin.length in MIN_CASHIER_PIN_LENGTH..MAX_CASHIER_PIN_LENGTH &&
                !isVerifyingPin &&
                !isLockedOut

    val parsedPettyCashRupiah: Long
        get() = pettyCashDigits.toLongOrNull() ?: 0L
}

private val IndonesiaLocale: Locale = Locale.forLanguageTag("id-ID")

internal fun formatSyncTimestampWib(epochMs: Long?): String {
    if (epochMs == null || epochMs <= 0L) return "Belum diunduh"
    val formatter = SimpleDateFormat("dd MMM yyyy, HH:mm", IndonesiaLocale)
    formatter.timeZone = TimeZone.getTimeZone("Asia/Jakarta")
    return "${formatter.format(Date(epochMs))} WIB"
}

internal fun formatRupiah(amount: Long): String {
    val numberFormat = NumberFormat.getIntegerInstance(IndonesiaLocale)
    return "Rp ${numberFormat.format(amount.coerceAtLeast(0L))}"
}

internal fun sanitizeRupiahDigits(raw: String): String {
    val digitsOnly = raw.filter { it.isDigit() }.trimStart('0').take(MAX_RUPAIAH_DIGITS)
    return digitsOnly.ifEmpty { "0" }
}

internal fun staffInitials(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (parts.isEmpty()) return "KS"
    return if (parts.size == 1) {
        parts[0].take(2).uppercase(IndonesiaLocale)
    } else {
        "${parts[0].first()}${parts[1].first()}".uppercase(IndonesiaLocale)
    }
}

internal fun roleDisplayLabel(role: String): String =
    when (role.uppercase(Locale.ROOT)) {
        "CASHIER" -> "Kasir"
        "SUPERVISOR" -> "Supervisor"
        "MANAGER" -> "Manajer"
        "STOCK_KEEPER" -> "Staf Gudang"
        "ADMIN" -> "Administrator"
        else -> role
    }
