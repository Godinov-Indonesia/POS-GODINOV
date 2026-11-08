package id.godinov.pos.ui.activation

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.godinov.pos.R
import id.godinov.pos.ui.components.PosSnackbarHost
import id.godinov.pos.ui.theme.GodinovPosTheme

/**
 * Stateless adaptive onboarding stage:
 * Keeps utility actions, brand emblem, and capability rail anchored while sliding the active card
 * left/right between [ActivationStep.SERIAL_KEY] and [ActivationStep.DEVICE_BINDING].
 */
@Composable
fun KeyActivationScreen(
    uiState: KeyActivationUiState,
    snackbarHostState: SnackbarHostState,
    onSerialKeyChange: (String) -> Unit,
    onClearSerialKey: () -> Unit,
    onPasteClipboard: () -> Unit,
    onSubmitSerialKey: () -> Unit,
    onSerialBusinessChange: (String) -> Unit,
    onSerialOutletChange: (String) -> Unit,
    onBusinessPasswordChange: (String) -> Unit,
    onTogglePasswordVisibility: () -> Unit,
    onBackToSerialKey: () -> Unit,
    onSubmitDeviceBinding: () -> Unit,
    onOpenHelp: () -> Unit,
    onPingTest: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorScheme = MaterialTheme.colorScheme
    val scrollState = rememberScrollState()

    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxSize()
                .background(colorScheme.surface)
                .systemBarsPadding()
                .imePadding(),
    ) {
        val isTablet = maxWidth >= 600.dp
        val isRailWide = maxWidth >= 720.dp
        val isWideTablet = maxWidth >= 900.dp
        val isShortViewport = maxHeight < 520.dp
        val cardPadding =
            when {
                isWideTablet -> 48.dp
                isTablet -> 36.dp
                else -> 24.dp
            }

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(
                        horizontal =
                            when {
                                isWideTablet -> 48.dp
                                isTablet -> 32.dp
                                else -> 20.dp
                            },
                        vertical = if (isTablet && !isShortViewport) 28.dp else 16.dp,
                    ),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = if (isTablet && !isShortViewport) Arrangement.SpaceBetween else Arrangement.Top,
        ) {
            TopUtilityBar(
                isTablet = isTablet,
                isPinging = uiState.isPinging,
                onOpenHelp = onOpenHelp,
                onPingTest = onPingTest,
            )

            if (!isTablet || isShortViewport) {
                Spacer(modifier = Modifier.height(if (isShortViewport) 16.dp else 24.dp))
            }

            Column(
                modifier = Modifier.widthIn(max = 760.dp).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Image(
                    painter = painterResource(id = R.drawable.godinov_pos_logo),
                    contentDescription = "Logo Godinov POS",
                    contentScale = ContentScale.Fit,
                    modifier =
                        Modifier.height(
                            when {
                                isShortViewport -> 48.dp
                                isWideTablet -> 84.dp
                                isTablet -> 72.dp
                                else -> 54.dp
                            },
                        ),
                )

                Spacer(modifier = Modifier.height(if (isTablet && !isShortViewport) 24.dp else 18.dp))

                // Unclipped SizeTransform preserves the 6dp card shadow while sliding horizontally.
                AnimatedContent(
                    targetState = uiState.step,
                    transitionSpec = {
                        val forward = targetState.ordinal > initialState.ordinal
                        val enterOffset: (Int) -> Int = { width -> if (forward) width else -width }
                        val exitOffset: (Int) -> Int = { width -> if (forward) -width else width }
                        (
                            slideInHorizontally(
                                animationSpec = tween(durationMillis = 320, easing = FastOutSlowInEasing),
                                initialOffsetX = enterOffset,
                            ) + fadeIn(animationSpec = tween(durationMillis = 220))
                        ).togetherWith(
                            slideOutHorizontally(
                                animationSpec = tween(durationMillis = 320, easing = FastOutSlowInEasing),
                                targetOffsetX = exitOffset,
                            ) + fadeOut(animationSpec = tween(durationMillis = 180)),
                        ).using(SizeTransform(clip = false))
                    },
                    label = "activationStepCardSlide",
                    modifier = Modifier.fillMaxWidth(),
                ) { step ->
                    when (step) {
                        ActivationStep.SERIAL_KEY -> {
                            KeyActivationCard(
                                serialKey = uiState.serialKey,
                                validationError = uiState.serialKeyError,
                                isSubmitting = uiState.isVerifyingKey,
                                isTablet = isTablet,
                                cardPadding = cardPadding,
                                onSerialKeyChange = onSerialKeyChange,
                                onClearSerialKey = onClearSerialKey,
                                onPasteClipboard = onPasteClipboard,
                                onSubmit = onSubmitSerialKey,
                            )
                        }
                        ActivationStep.DEVICE_BINDING -> {
                            DeviceBindingCard(
                                serialBusiness = uiState.serialBusiness,
                                serialOutlet = uiState.serialOutlet,
                                businessPassword = uiState.businessPassword,
                                isPasswordVisible = uiState.isPasswordVisible,
                                validationError = uiState.bindingError,
                                isSubmitting = uiState.isBindingDevice,
                                isTablet = isTablet,
                                cardPadding = cardPadding,
                                onSerialBusinessChange = onSerialBusinessChange,
                                onSerialOutletChange = onSerialOutletChange,
                                onBusinessPasswordChange = onBusinessPasswordChange,
                                onTogglePasswordVisibility = onTogglePasswordVisibility,
                                onBack = onBackToSerialKey,
                                onSubmit = onSubmitDeviceBinding,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(if (isTablet) 24.dp else 18.dp))

                DiagnosticCapabilityRail(isWideLayout = isRailWide)
            }

            // Counterweight spacer keeps the card visually centered against TopUtilityBar on tall tablets.
            Spacer(modifier = Modifier.height(if (isTablet && !isShortViewport) 12.dp else 24.dp))
        }

        PosSnackbarHost(
            hostState = snackbarHostState,
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 20.dp, vertical = 24.dp),
        )
    }
}

@Composable
private fun PreviewScreen(uiState: KeyActivationUiState = KeyActivationUiState()) {
    GodinovPosTheme {
        KeyActivationScreen(
            uiState = uiState,
            snackbarHostState = remember { SnackbarHostState() },
            onSerialKeyChange = {},
            onClearSerialKey = {},
            onPasteClipboard = {},
            onSubmitSerialKey = {},
            onSerialBusinessChange = {},
            onSerialOutletChange = {},
            onBusinessPasswordChange = {},
            onTogglePasswordVisibility = {},
            onBackToSerialKey = {},
            onSubmitDeviceBinding = {},
            onOpenHelp = {},
            onPingTest = {},
        )
    }
}

@Preview(name = "1. Key App Tablet Landscape", widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
private fun KeyActivationTabletLandscapePreview() = PreviewScreen()

@Preview(name = "2. Bind Device Tablet Landscape", widthDp = 1280, heightDp = 800, showBackground = true)
@Composable
private fun DeviceBindingTabletLandscapePreview() =
    PreviewScreen(
        KeyActivationUiState(
            step = ActivationStep.DEVICE_BINDING,
            serialBusiness = "KOPBU100826",
            serialOutlet = "KOPBU100826001",
        ),
    )

@Preview(name = "3. Bind Device Phone Portrait", widthDp = 390, heightDp = 844, showBackground = true)
@Composable
private fun DeviceBindingPhonePortraitPreview() =
    PreviewScreen(KeyActivationUiState(step = ActivationStep.DEVICE_BINDING))

@Preview(name = "4. Validation Error State", widthDp = 1024, heightDp = 768, showBackground = true)
@Composable
private fun DeviceBindingErrorStatePreview() =
    PreviewScreen(
        KeyActivationUiState(
            step = ActivationStep.DEVICE_BINDING,
            serialBusiness = "KOPBU100826",
            bindingError = "Serial Business, Serial Outlet, dan Password Business wajib diisi.",
        ),
    )
