package id.godinov.pos.ui.cashier

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.godinov.pos.data.network.PosStaffMember
import id.godinov.pos.ui.components.PosSnackbarHost
import id.godinov.pos.ui.theme.GodinovPosTheme

@Composable
fun CashierLoginScreen(
    uiState: CashierLoginUiState,
    snackbarHostState: SnackbarHostState,
    onOpenCashierPicker: () -> Unit,
    onDigitInput: (Char) -> Unit,
    onBackspace: () -> Unit,
    onResetPin: () -> Unit,
    onSubmitPin: () -> Unit,
    onDownloadMasterData: () -> Unit,
    onCloseActiveShift: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme
    val padFocusRequester = remember { FocusRequester() }

    LaunchedEffect(uiState.isPettyCashSheetOpen) {
        if (!uiState.isPettyCashSheetOpen) {
            padFocusRequester.requestFocus()
        }
    }

    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .background(colorScheme.background)
                .systemBarsPadding()
                .imePadding()
                .focusRequester(padFocusRequester)
                .focusable()
                .onPreviewKeyEvent { event ->
                    if (uiState.isPettyCashSheetOpen) {
                        false
                    } else {
                        handleHardwarePinKey(
                            event = event,
                            canSubmit = uiState.canSubmitPin,
                            onDigit = onDigitInput,
                            onBackspace = onBackspace,
                            onReset = onResetPin,
                            onSubmit = onSubmitPin,
                        )
                    }
                },
    ) {
        val isTablet = maxWidth >= 600.dp
        val isWideRow = maxWidth >= 720.dp
        val isWideTablet = maxWidth >= 900.dp
        val isShortViewport = maxHeight < 520.dp

        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(
                            horizontal = if (isTablet) 24.dp else 16.dp,
                            vertical = if (isShortViewport) 14.dp else 24.dp,
                        ),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CashierHeaderBar(
                    serialBusiness = uiState.serialBusiness,
                    serialOutlet = uiState.serialOutlet,
                    lastSyncedEpochMs = uiState.lastSyncedEpochMs,
                    staffCount = uiState.staffs.size,
                    productCount = uiState.productCount,
                    isSyncingMaster = uiState.isSyncingMaster,
                    activeShift = uiState.activeShift,
                    isWideRow = isWideRow,
                    isShortViewport = isShortViewport,
                    onDownloadMasterData = onDownloadMasterData,
                    onCloseActiveShift = onCloseActiveShift,
                )

                Spacer(modifier = Modifier.height(if (isShortViewport) 14.dp else 20.dp))

                Surface(
                    shape = MaterialTheme.shapes.extraLarge,
                    color = colorScheme.surfaceContainerLowest,
                    shadowElevation = 6.dp,
                    border = BorderStroke(1.dp, colorScheme.surfaceContainerHigh.copy(alpha = 0.7f)),
                    modifier = Modifier.widthIn(max = 1024.dp).fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(
                                                colorScheme.primary,
                                                colorScheme.primaryContainer,
                                                colorScheme.secondaryContainer,
                                            ),
                                        ),
                                    ),
                        )

                        if (isTablet) {
                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(if (isWideTablet) 36.dp else 28.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(if (isWideTablet) 40.dp else 28.dp),
                            ) {
                                CashierPinPanel(
                                    selectedStaff = uiState.selectedStaff,
                                    staffCount = uiState.staffs.size,
                                    pinLength = uiState.pin.length,
                                    pinError = uiState.pinError,
                                    lockoutRemainingSec = uiState.lockoutRemainingSec,
                                    isVerifyingPin = uiState.isVerifyingPin,
                                    isTablet = true,
                                    onOpenCashierPicker = onOpenCashierPicker,
                                    modifier = Modifier.weight(0.44f),
                                )
                                CashierPinPad(
                                    canSubmit = uiState.canSubmitPin,
                                    isVerifyingPin = uiState.isVerifyingPin,
                                    isLockedOut = uiState.isLockedOut,
                                    isTablet = true,
                                    isShortViewport = isShortViewport,
                                    onDigit = onDigitInput,
                                    onReset = onResetPin,
                                    onBackspace = onBackspace,
                                    onSubmit = onSubmitPin,
                                    modifier = Modifier.weight(0.56f),
                                )
                            }
                        } else {
                            Column(
                                modifier = Modifier.fillMaxWidth().padding(20.dp),
                                verticalArrangement = Arrangement.spacedBy(20.dp),
                            ) {
                                CashierPinPanel(
                                    selectedStaff = uiState.selectedStaff,
                                    staffCount = uiState.staffs.size,
                                    pinLength = uiState.pin.length,
                                    pinError = uiState.pinError,
                                    lockoutRemainingSec = uiState.lockoutRemainingSec,
                                    isVerifyingPin = uiState.isVerifyingPin,
                                    isTablet = false,
                                    onOpenCashierPicker = onOpenCashierPicker,
                                )
                                HorizontalDivider(color = colorScheme.surfaceContainerHigh)
                                CashierPinPad(
                                    canSubmit = uiState.canSubmitPin,
                                    isVerifyingPin = uiState.isVerifyingPin,
                                    isLockedOut = uiState.isLockedOut,
                                    isTablet = false,
                                    isShortViewport = isShortViewport,
                                    onDigit = onDigitInput,
                                    onReset = onResetPin,
                                    onBackspace = onBackspace,
                                    onSubmit = onSubmitPin,
                                )
                            }
                        }
                    }
                }
            }

            PosSnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
            )
        }
    }
}

private fun handleHardwarePinKey(
    event: KeyEvent,
    canSubmit: Boolean,
    onDigit: (Char) -> Unit,
    onBackspace: () -> Unit,
    onReset: () -> Unit,
    onSubmit: () -> Unit,
): Boolean {
    if (event.type != KeyEventType.KeyDown) return false
    val mappedDigit =
        when (event.key) {
            Key.Zero, Key.NumPad0 -> '0'
            Key.One, Key.NumPad1 -> '1'
            Key.Two, Key.NumPad2 -> '2'
            Key.Three, Key.NumPad3 -> '3'
            Key.Four, Key.NumPad4 -> '4'
            Key.Five, Key.NumPad5 -> '5'
            Key.Six, Key.NumPad6 -> '6'
            Key.Seven, Key.NumPad7 -> '7'
            Key.Eight, Key.NumPad8 -> '8'
            Key.Nine, Key.NumPad9 -> '9'
            else -> null
        }
    if (mappedDigit != null) {
        onDigit(mappedDigit)
        return true
    }
    return when (event.key) {
        Key.Backspace -> {
            onBackspace()
            true
        }
        Key.Delete, Key.Escape -> {
            onReset()
            true
        }
        Key.Enter, Key.NumPadEnter -> {
            if (canSubmit) onSubmit()
            canSubmit
        }
        else -> false
    }
}

private val PreviewSampleStaffs =
    listOf(
        PosStaffMember(
            id = "stf-1",
            staffIdentifier = "STF-001",
            name = "Budi Santoso",
            pinHash = "",
            role = "CASHIER",
            permissions = emptyList(),
        ),
        PosStaffMember(
            id = "stf-2",
            staffIdentifier = "STF-002",
            name = "Rina Wijaya",
            pinHash = "",
            role = "SUPERVISOR",
            permissions = listOf("VOID_APPROVE"),
        ),
    )

@Composable
private fun PreviewCashierScreen(uiState: CashierLoginUiState) {
    GodinovPosTheme {
        CashierLoginScreen(
            uiState = uiState,
            snackbarHostState = remember { SnackbarHostState() },
            onOpenCashierPicker = {},
            onDigitInput = {},
            onBackspace = {},
            onResetPin = {},
            onSubmitPin = {},
            onDownloadMasterData = {},
            onCloseActiveShift = {},
        )
    }
}

@Preview(widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
private fun CashierTabletPreview() {
    PreviewCashierScreen(
        CashierLoginUiState(
            serialBusiness = "BIZ-GODINOV-01",
            serialOutlet = "OUT-SUDIRMAN-01",
            staffs = PreviewSampleStaffs,
            selectedStaffId = "stf-1",
            pin = "1234",
            lastSyncedEpochMs = 1794106800000L,
            categoryCount = 6,
            productCount = 48,
        ),
    )
}

@Preview(widthDp = 390, heightDp = 844, showBackground = true)
@Composable
private fun CashierPhonePreview() {
    PreviewCashierScreen(
        CashierLoginUiState(
            serialBusiness = "BIZ-GODINOV-01",
            serialOutlet = "OUT-SUDIRMAN-01",
            staffs = PreviewSampleStaffs,
            selectedStaffId = "stf-1",
            lastSyncedEpochMs = 1794106800000L,
            categoryCount = 6,
            productCount = 48,
        ),
    )
}

@Preview(widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
private fun CashierErrorPreview() {
    PreviewCashierScreen(
        CashierLoginUiState(
            serialBusiness = "BIZ-GODINOV-01",
            serialOutlet = "OUT-SUDIRMAN-01",
            staffs = PreviewSampleStaffs,
            selectedStaffId = "stf-1",
            pinError = "PIN kasir salah. Sisa 3 percobaan sebelum dikunci.",
            lastSyncedEpochMs = 1794106800000L,
            categoryCount = 6,
            productCount = 48,
        ),
    )
}
