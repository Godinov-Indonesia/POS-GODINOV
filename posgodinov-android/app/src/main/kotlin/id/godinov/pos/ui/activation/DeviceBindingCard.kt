package id.godinov.pos.ui.activation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.godinov.pos.ui.components.InlineError
import id.godinov.pos.ui.components.PosBrandCard
import id.godinov.pos.ui.components.PosPrimaryButton
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.InterFontFamily
import id.godinov.pos.ui.theme.JetBrainsMonoFontFamily
import id.godinov.pos.ui.theme.LocalGodinovColors

@Composable
internal fun DeviceBindingCard(
    serialBusiness: String,
    serialOutlet: String,
    businessPassword: String,
    isPasswordVisible: Boolean,
    validationError: String?,
    isSubmitting: Boolean,
    isTablet: Boolean,
    cardPadding: Dp,
    onSerialBusinessChange: (String) -> Unit,
    onSerialOutletChange: (String) -> Unit,
    onBusinessPasswordChange: (String) -> Unit,
    onTogglePasswordVisibility: () -> Unit,
    onBack: () -> Unit,
    onSubmit: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    val outletFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val fieldSpacing = if (isTablet) 22.dp else 18.dp

    PosBrandCard(
        title = "Tautkan Perangkat",
        icon = PosIcons.Devices,
        compact = !isTablet,
        contentPadding = cardPadding,
        onBack = if (isSubmitting) null else onBack,
        backContentDescription = "Kembali ke Serial Key",
    ) {
        BindingInputField(
            label = "Serial Business",
            value = serialBusiness,
            placeholder = "CONTOH: BIZ-XXXX-XX",
            leadingIcon = PosIcons.Domain,
            contentDescription = "Kolom input Serial Business",
            isMonospaceCode = true,
            hasError = validationError != null && serialBusiness.isBlank(),
            enabled = !isSubmitting,
            isTablet = isTablet,
            imeAction = ImeAction.Next,
            keyboardType = KeyboardType.Ascii,
            onValueChange = onSerialBusinessChange,
            onImeTrigger = { outletFocus.requestFocus() },
        )

        Spacer(modifier = Modifier.height(fieldSpacing))

        BindingInputField(
            label = "Serial Outlet",
            value = serialOutlet,
            placeholder = "CONTOH: OUT-01-LOKASI",
            leadingIcon = PosIcons.Storefront,
            contentDescription = "Kolom input Serial Outlet",
            isMonospaceCode = true,
            hasError = validationError != null && serialOutlet.isBlank(),
            enabled = !isSubmitting,
            isTablet = isTablet,
            imeAction = ImeAction.Next,
            keyboardType = KeyboardType.Ascii,
            onValueChange = onSerialOutletChange,
            onImeTrigger = { passwordFocus.requestFocus() },
            fieldModifier = Modifier.focusRequester(outletFocus),
        )

        Spacer(modifier = Modifier.height(fieldSpacing))

        BindingInputField(
            label = "Password Business",
            value = businessPassword,
            placeholder = "••••••••••••",
            leadingIcon = PosIcons.Key,
            contentDescription = "Kolom input Password Business",
            isMonospaceCode = false,
            hasError = validationError != null && businessPassword.isBlank(),
            enabled = !isSubmitting,
            isTablet = isTablet,
            imeAction = ImeAction.Done,
            keyboardType = KeyboardType.Password,
            visualTransformation =
                if (isPasswordVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
            onValueChange = onBusinessPasswordChange,
            onImeTrigger = {
                focusManager.clearFocus()
                onSubmit()
            },
            fieldModifier = Modifier.focusRequester(passwordFocus),
            trailingAction = {
                IconButton(
                    onClick = onTogglePasswordVisibility,
                    enabled = !isSubmitting,
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(
                        imageVector = if (isPasswordVisible) PosIcons.VisibilityOff else PosIcons.Visibility,
                        contentDescription = if (isPasswordVisible) "Sembunyikan sandi" else "Lihat sandi",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(22.dp),
                    )
                }
            },
        )

        AnimatedVisibility(visible = validationError != null) {
            validationError?.let { InlineError(message = it, modifier = Modifier.padding(top = 12.dp)) }
        }

        Spacer(modifier = Modifier.height(if (isTablet) 30.dp else 24.dp))

        PosPrimaryButton(
            text = if (isSubmitting) "Menautkan..." else "Tautkan",
            onClick = {
                focusManager.clearFocus()
                onSubmit()
            },
            icon = PosIcons.Link,
            loading = isSubmitting,
            textStyle =
                if (isTablet) {
                    MaterialTheme.typography.headlineSmall
                } else {
                    MaterialTheme.typography.titleLarge
                },
            modifier = Modifier.height(if (isTablet) 64.dp else 56.dp),
        )
    }
}

@Composable
private fun BindingInputField(
    label: String,
    value: String,
    placeholder: String,
    leadingIcon: ImageVector,
    contentDescription: String,
    isMonospaceCode: Boolean,
    hasError: Boolean,
    enabled: Boolean,
    isTablet: Boolean,
    imeAction: ImeAction,
    keyboardType: KeyboardType,
    onValueChange: (String) -> Unit,
    onImeTrigger: () -> Unit,
    fieldModifier: Modifier = Modifier,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    trailingAction: (@Composable () -> Unit)? = null,
) {
    val colorScheme = MaterialTheme.colorScheme
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val borderColor =
        when {
            hasError -> colorScheme.error
            isFocused -> colorScheme.primary
            else -> colorScheme.outlineVariant
        }
    val borderWidth = if (isFocused || hasError) 2.dp else 1.5.dp

    val inputTextStyle =
        TextStyle(
            fontFamily = if (isMonospaceCode) JetBrainsMonoFontFamily else InterFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = if (isTablet) 19.sp else 16.sp,
            lineHeight = if (isTablet) 26.sp else 24.sp,
            letterSpacing = if (isMonospaceCode) 0.9.sp else 0.2.sp,
            color = colorScheme.onSurface,
        )

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = if (isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                color = colorScheme.onSurface,
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = "*", style = MaterialTheme.typography.titleMedium, color = colorScheme.error)
        }

        Spacer(modifier = Modifier.height(10.dp))

        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = true,
            textStyle = inputTextStyle,
            visualTransformation = visualTransformation,
            cursorBrush = SolidColor(colorScheme.primary),
            interactionSource = interactionSource,
            keyboardOptions =
                KeyboardOptions(
                    capitalization =
                        if (isMonospaceCode) {
                            KeyboardCapitalization.Characters
                        } else {
                            KeyboardCapitalization.None
                        },
                    autoCorrectEnabled = false,
                    keyboardType = keyboardType,
                    imeAction = imeAction,
                ),
            keyboardActions =
                KeyboardActions(
                    onNext = { onImeTrigger() },
                    onDone = { onImeTrigger() },
                ),
            modifier =
                fieldModifier
                    .fillMaxWidth()
                    .onPreviewKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown &&
                            (event.key == Key.Enter || event.key == Key.NumPadEnter)
                        ) {
                            onImeTrigger()
                            true
                        } else {
                            false
                        }
                    }
                    .semantics { this.contentDescription = contentDescription },
            decorationBox = { innerTextField ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(if (isTablet) 64.dp else 56.dp)
                            .clip(MaterialTheme.shapes.large)
                            .background(colorScheme.surfaceContainerLowest)
                            .border(borderWidth, borderColor, MaterialTheme.shapes.large)
                            .padding(
                                start = if (isTablet) 20.dp else 14.dp,
                                end = if (trailingAction != null) 6.dp else 16.dp,
                            ),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = leadingIcon,
                        contentDescription = null,
                        tint =
                            when {
                                hasError -> colorScheme.error
                                isFocused -> colorScheme.primaryContainer
                                else -> colorScheme.primary
                            },
                        modifier = Modifier.size(if (isTablet) 26.dp else 22.dp),
                    )
                    Spacer(modifier = Modifier.width(if (isTablet) 14.dp else 10.dp))
                    Box(
                        modifier = Modifier.weight(1f),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        if (value.isEmpty()) {
                            Text(
                                text = placeholder,
                                style = inputTextStyle.copy(color = LocalGodinovColors.current.placeholder),
                                maxLines = 1,
                            )
                        }
                        innerTextField()
                    }
                    trailingAction?.invoke()
                }
            },
        )
    }
}
