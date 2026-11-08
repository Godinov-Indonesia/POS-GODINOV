package id.godinov.pos.ui.cashier

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.godinov.pos.data.crypto.verifyStaffPin
import id.godinov.pos.data.local.ActiveShiftSession
import id.godinov.pos.data.local.BoundTerminal
import id.godinov.pos.data.network.MasterDataSnapshot
import id.godinov.pos.data.network.MasterDataSyncResult
import id.godinov.pos.data.network.fetchMasterData
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal sealed interface CashierEvent {
    data class PersistMasterData(
        val snapshot: MasterDataSnapshot,
    ) : CashierEvent

    data class PersistShift(
        val shift: ActiveShiftSession?,
    ) : CashierEvent

    data class ShowMessage(
        val message: String,
        val isError: Boolean = false,
    ) : CashierEvent
}

internal class CashierLoginViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(CashierLoginUiState())
    val uiState: StateFlow<CashierLoginUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<CashierEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<CashierEvent> = _events.asSharedFlow()

    private var initializedTerminalToken: String? = null
    private var failedAttempts = 0
    private var lockoutJob: Job? = null

    fun initializeSession(
        terminal: BoundTerminal,
        initialSnapshot: MasterDataSnapshot?,
        initialShift: ActiveShiftSession?,
    ) {
        if (initializedTerminalToken == terminal.deviceToken) {
            if (initialSnapshot != null && _uiState.value.lastSyncedEpochMs == null) {
                applySnapshot(initialSnapshot)
            }
            return
        }
        initializedTerminalToken = terminal.deviceToken
        failedAttempts = 0
        lockoutJob?.cancel()

        val staffs = initialSnapshot?.staffs.orEmpty()
        _uiState.value =
            CashierLoginUiState(
                serialBusiness = terminal.serialBusiness,
                serialOutlet = terminal.serialOutlet,
                staffs = staffs,
                selectedStaffId = staffs.firstOrNull()?.id,
                lastSyncedEpochMs = initialSnapshot?.syncedAtEpochMs,
                categoryCount = initialSnapshot?.categoryCount ?: 0,
                productCount = initialSnapshot?.productCount ?: 0,
                activeShift = initialShift,
            )
    }

    fun onSelectCashier(staffId: String) {
        _uiState.update {
            it.copy(
                selectedStaffId = staffId,
                pin = "",
                pinError = null,
            )
        }
    }

    fun onDigitInput(digit: Char) {
        if (!digit.isDigit()) return
        val current = _uiState.value
        if (current.isVerifyingPin || current.isLockedOut) return
        if (current.pin.length >= MAX_CASHIER_PIN_LENGTH) return
        _uiState.update {
            it.copy(
                pin = it.pin + digit,
                pinError = null,
            )
        }
    }

    fun onBackspace() {
        val current = _uiState.value
        if (current.isVerifyingPin || current.pin.isEmpty()) return
        _uiState.update {
            it.copy(
                pin = it.pin.dropLast(1),
                pinError = null,
            )
        }
    }

    fun onResetPin() {
        if (_uiState.value.isVerifyingPin) return
        _uiState.update { it.copy(pin = "", pinError = null) }
    }

    fun submitPin() {
        val current = _uiState.value
        if (current.isVerifyingPin || current.isLockedOut) return
        val staff = current.selectedStaff
        if (staff == null) {
            val msg = "Pilih kasir terlebih dahulu atau unduh ulang data master."
            _uiState.update { it.copy(pinError = msg) }
            emitMessage(msg, isError = true)
            return
        }
        if (current.pin.length !in MIN_CASHIER_PIN_LENGTH..MAX_CASHIER_PIN_LENGTH) {
            val msg = "PIN kasir terdiri dari $MIN_CASHIER_PIN_LENGTH sampai $MAX_CASHIER_PIN_LENGTH digit."
            _uiState.update { it.copy(pinError = msg) }
            return
        }

        val candidatePin = current.pin
        _uiState.update { it.copy(isVerifyingPin = true, pinError = null) }
        viewModelScope.launch {
            val verified = verifyStaffPin(pin = candidatePin, pinHash = staff.pinHash)
            if (verified) {
                failedAttempts = 0
                _uiState.update {
                    it.copy(
                        isVerifyingPin = false,
                        pin = "",
                        pinError = null,
                        isPettyCashSheetOpen = true,
                        pettyCashStaff = staff,
                        pettyCashDigits = "0",
                    )
                }
            } else {
                failedAttempts += 1
                if (failedAttempts >= MAX_PIN_ATTEMPTS) {
                    failedAttempts = 0
                    startLockoutCountdown()
                    val msg = "Terlalu banyak percobaan gagal. Terminal dikunci $PIN_LOCKOUT_SECONDS detik."
                    _uiState.update { it.copy(isVerifyingPin = false, pin = "", pinError = msg) }
                    emitMessage(msg, isError = true)
                } else {
                    val remaining = MAX_PIN_ATTEMPTS - failedAttempts
                    val msg = "PIN kasir salah. Sisa $remaining percobaan sebelum dikunci."
                    _uiState.update { it.copy(isVerifyingPin = false, pin = "", pinError = msg) }
                    emitMessage(msg, isError = true)
                }
            }
        }
    }

    fun refreshMasterData(
        baseUrl: String,
        deviceToken: String,
    ) {
        if (_uiState.value.isSyncingMaster) return
        _uiState.update { it.copy(isSyncingMaster = true) }
        viewModelScope.launch {
            when (val result = fetchMasterData(baseUrl = baseUrl, deviceToken = deviceToken)) {
                is MasterDataSyncResult.Success -> {
                    applySnapshot(result.snapshot)
                    _events.tryEmit(CashierEvent.PersistMasterData(result.snapshot))
                    emitMessage(
                        "Data master diperbarui (${result.snapshot.staffs.size} kasir, " +
                            "${result.snapshot.productCount} produk).",
                    )
                }
                is MasterDataSyncResult.Rejected -> {
                    _uiState.update { it.copy(isSyncingMaster = false) }
                    val msg =
                        result.serverMessage
                            ?: "Gagal mengunduh data master (HTTP ${result.httpCode})."
                    emitMessage(msg, isError = true)
                }
                MasterDataSyncResult.Unreachable -> {
                    _uiState.update { it.copy(isSyncingMaster = false) }
                    emitMessage("Server POS tidak terjangkau. Menggunakan data master tersimpan.", isError = true)
                }
            }
        }
    }

    fun onPettyCashDigitsChange(raw: String) {
        _uiState.update { it.copy(pettyCashDigits = sanitizeRupiahDigits(raw)) }
    }

    fun onSelectPettyCashPreset(amount: Long) {
        _uiState.update { it.copy(pettyCashDigits = amount.coerceAtLeast(0L).toString()) }
    }

    /** Records the opened shift; sheet visibility is cleared in [onPettyCashSheetDismissed] after animation. */
    fun confirmOpenShift() {
        val current = _uiState.value
        val staff = current.pettyCashStaff ?: return
        val openingCash = current.parsedPettyCashRupiah
        val shift =
            ActiveShiftSession(
                staffId = staff.id,
                staffName = staff.name,
                staffRole = staff.role,
                openingCashRupiah = openingCash,
                openedAtEpochMs = System.currentTimeMillis(),
            )
        _uiState.update { it.copy(activeShift = shift) }
        _events.tryEmit(CashierEvent.PersistShift(shift))
        emitMessage("Shift ${staff.name} dibuka dengan modal awal ${formatRupiah(openingCash)}.")
    }

    fun onPettyCashSheetDismissed() {
        _uiState.update {
            it.copy(
                isPettyCashSheetOpen = false,
                pettyCashStaff = null,
            )
        }
    }

    fun closeActiveShift() {
        val existing = _uiState.value.activeShift ?: return
        _uiState.update { it.copy(activeShift = null, pin = "", pinError = null) }
        _events.tryEmit(CashierEvent.PersistShift(null))
        emitMessage("Sesi shift ${existing.staffName} ditutup.")
    }

    private fun applySnapshot(snapshot: MasterDataSnapshot) {
        _uiState.update { current ->
            val preservedSelection =
                current.selectedStaffId?.takeIf { id -> snapshot.staffs.any { it.id == id } }
                    ?: snapshot.staffs.firstOrNull()?.id
            current.copy(
                isSyncingMaster = false,
                staffs = snapshot.staffs,
                selectedStaffId = preservedSelection,
                lastSyncedEpochMs = snapshot.syncedAtEpochMs,
                categoryCount = snapshot.categoryCount,
                productCount = snapshot.productCount,
            )
        }
    }

    private fun startLockoutCountdown() {
        lockoutJob?.cancel()
        lockoutJob =
            viewModelScope.launch {
                for (sec in PIN_LOCKOUT_SECONDS downTo 1) {
                    _uiState.update { it.copy(lockoutRemainingSec = sec) }
                    delay(1000L)
                }
                _uiState.update { it.copy(lockoutRemainingSec = 0, pinError = null) }
            }
    }

    private fun emitMessage(
        message: String,
        isError: Boolean = false,
    ) {
        _events.tryEmit(CashierEvent.ShowMessage(message = message, isError = isError))
    }
}
