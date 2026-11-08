package id.godinov.pos.ui.welcome

import androidx.activity.compose.LocalActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import id.godinov.pos.BuildConfig
import id.godinov.pos.data.local.BoundTerminal
import id.godinov.pos.data.network.MasterDataSnapshot
import id.godinov.pos.ui.components.showPosMessage

/** Stateful entry point for post-binding interactive welcome and initial master data download. */
@Composable
fun WelcomeSyncRoute(
    terminal: BoundTerminal,
    initialFeedbackMessage: String?,
    onFeedbackConsumed: () -> Unit,
    onMasterDataSaved: suspend (MasterDataSnapshot) -> Unit,
    onUnlockToCashier: (MasterDataSnapshot?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val owner = requireNotNull(LocalActivity.current as? ViewModelStoreOwner)
    val viewModel = remember(owner) { ViewModelProvider(owner)[WelcomeSyncViewModel::class.java] }
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(terminal) {
        viewModel.startForTerminal(BuildConfig.API_BASE_URL, terminal)
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
                is WelcomeEvent.PersistSnapshot -> onMasterDataSaved(event.snapshot)
                is WelcomeEvent.ShowMessage -> snackbarHostState.showPosMessage(event.message, event.isError)
            }
        }
    }

    WelcomeSyncScreen(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        onAdvanceGreeting = viewModel::advanceGreeting,
        onRetrySync = { viewModel.retrySync(BuildConfig.API_BASE_URL, terminal.deviceToken) },
        onUnlockToCashier = { onUnlockToCashier(viewModel.latestSnapshot) },
        modifier = modifier,
    )
}
