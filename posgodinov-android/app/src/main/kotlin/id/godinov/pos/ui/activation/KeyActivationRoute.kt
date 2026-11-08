package id.godinov.pos.ui.activation

import android.content.ClipboardManager
import android.content.Context
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
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import id.godinov.pos.BuildConfig
import id.godinov.pos.ui.components.showPosMessage

/** Stateful entry point for one-time terminal activation and permanent business device binding. */
@Composable
fun KeyActivationRoute(
    isKeyAlreadyActivated: Boolean,
    onKeyActivated: suspend () -> Unit,
    onDeviceBound: suspend (
        deviceToken: String,
        serialBusiness: String,
        serialOutlet: String,
        feedbackMessage: String,
    ) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val owner = requireNotNull(LocalActivity.current as? ViewModelStoreOwner)
    val viewModel = remember(owner) { ViewModelProvider(owner)[KeyActivationViewModel::class.java] }
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showHelpDialog by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(isKeyAlreadyActivated) {
        viewModel.syncPersistedKeyActivation(isKeyAlreadyActivated)
    }

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is ActivationEvent.ShowMessage -> snackbarHostState.showPosMessage(event.message, event.isError)
                ActivationEvent.KeyActivated -> onKeyActivated()
                is ActivationEvent.DeviceBound ->
                    onDeviceBound(
                        event.deviceToken,
                        event.serialBusiness,
                        event.serialOutlet,
                        event.feedbackMessage,
                    )
            }
        }
    }

    fun handlePasteClipboard() {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
        val raw =
            clipboard?.primaryClip
                ?.takeIf { it.itemCount > 0 }
                ?.getItemAt(0)
                ?.coerceToText(context)
                ?.toString()
        viewModel.onPasteSerialKey(raw)
    }

    KeyActivationScreen(
        uiState = uiState,
        snackbarHostState = snackbarHostState,
        onSerialKeyChange = viewModel::onSerialKeyChange,
        onClearSerialKey = viewModel::onClearSerialKey,
        onPasteClipboard = ::handlePasteClipboard,
        onSubmitSerialKey = { viewModel.submitSerialKey(BuildConfig.API_BASE_URL) },
        onSerialBusinessChange = viewModel::onSerialBusinessChange,
        onSerialOutletChange = viewModel::onSerialOutletChange,
        onBusinessPasswordChange = viewModel::onBusinessPasswordChange,
        onTogglePasswordVisibility = viewModel::onTogglePasswordVisibility,
        onSubmitDeviceBinding = { viewModel.submitDeviceBinding(BuildConfig.API_BASE_URL) },
        onOpenHelp = { showHelpDialog = true },
        onPingTest = { viewModel.pingServer(BuildConfig.API_BASE_URL) },
        modifier = modifier,
    )

    if (showHelpDialog) {
        ActivationHelpDialog(
            step = uiState.step,
            apiBaseUrl = BuildConfig.API_BASE_URL,
            onDismiss = { showHelpDialog = false },
        )
    }
}
