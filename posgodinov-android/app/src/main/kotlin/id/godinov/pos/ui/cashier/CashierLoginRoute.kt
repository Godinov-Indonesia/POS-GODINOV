package id.godinov.pos.ui.cashier

import androidx.activity.compose.LocalActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import id.godinov.pos.BuildConfig
import id.godinov.pos.data.local.ActiveShiftSession
import id.godinov.pos.data.local.BoundTerminal
import id.godinov.pos.data.network.MasterDataSnapshot
import id.godinov.pos.ui.components.showPosMessage

/** Stateful entry point for cashier selection, offline 4-6 digit PIN login, and initial petty cash shift setup. */
@Composable
fun CashierLoginRoute(
    terminal: BoundTerminal,
    initialMasterData: MasterDataSnapshot?,
    initialShift: ActiveShiftSession?,
    initialFeedbackMessage: String?,
    onFeedbackConsumed: () -> Unit,
    onPersistMasterData: suspend (MasterDataSnapshot) -> Unit,
    onPersistShift: suspend (ActiveShiftSession?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val owner = requireNotNull(LocalActivity.current as? ViewModelStoreOwner)
    val viewModel = remember(owner) { ViewModelProvider(owner)[CashierLoginViewModel::class.java] }
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showCashierPicker by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(terminal, initialMasterData) {
        viewModel.initializeSession(
            terminal = terminal,
            initialSnapshot = initialMasterData,
            initialShift = initialShift,
        )
    }

    LaunchedEffect(initialFeedbackMessage) {
        if (!initialFeedbackMessage.isNullOrBlank()) {
            snackbarHostState.showPosMessage(initialFeedbackMessage)
            onFeedbackConsumed()
        }
    }

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is CashierEvent.PersistMasterData -> onPersistMasterData(event.snapshot)
                is CashierEvent.PersistShift -> onPersistShift(event.shift)
                is CashierEvent.ShowMessage -> snackbarHostState.showPosMessage(event.message, event.isError)
            }
        }
    }

    CashierLoginScreen(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        onOpenCashierPicker = { showCashierPicker = true },
        onDigitInput = viewModel::onDigitInput,
        onBackspace = viewModel::onBackspace,
        onResetPin = viewModel::onResetPin,
        onSubmitPin = viewModel::submitPin,
        onDownloadMasterData = {
            viewModel.refreshMasterData(BuildConfig.API_BASE_URL, terminal.deviceToken)
        },
        onCloseActiveShift = viewModel::closeActiveShift,
        modifier = modifier,
    )

    if (showCashierPicker) {
        CashierPickerSheet(
            staffs = uiState.staffs,
            selectedStaffId = uiState.selectedStaff?.id,
            isSyncingMaster = uiState.isSyncingMaster,
            onSelectStaff = viewModel::onSelectCashier,
            onRefreshMasterData = {
                viewModel.refreshMasterData(BuildConfig.API_BASE_URL, terminal.deviceToken)
            },
            onDismiss = { showCashierPicker = false },
        )
    }

    val pettyCashStaff = uiState.pettyCashStaff
    if (uiState.isPettyCashSheetOpen && pettyCashStaff != null) {
        PettyCashSheet(
            staff = pettyCashStaff,
            pettyCashDigits = uiState.pettyCashDigits,
            parsedRupiah = uiState.parsedPettyCashRupiah,
            onDigitsChange = viewModel::onPettyCashDigitsChange,
            onSelectPreset = viewModel::onSelectPettyCashPreset,
            onConfirmShift = viewModel::confirmOpenShift,
            onDismiss = viewModel::onPettyCashSheetDismissed,
        )
    }
}
