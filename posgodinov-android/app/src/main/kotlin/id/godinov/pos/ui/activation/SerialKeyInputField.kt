package id.godinov.pos.ui.activation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.godinov.pos.ui.icons.PosIcons
import id.godinov.pos.ui.theme.JetBrainsMonoFontFamily
import id.godinov.pos.ui.theme.LocalGodinovColors

/** Monospaced serial key input; trailing slot shows Paste when empty and Clear when populated. */
@Composable
internal fun SerialKeyInputField(
    value: String,
    hasError: Boolean,
    enabled: Boolean,
    isTablet: Boolean,
    onValueChange: (String) -> Unit,
    onClear: () -> Unit,
    onPaste: () -> Unit,
    onDone: () -> Unit,
) {
    val colorScheme = MaterialTheme.colorScheme
    val focusManager = LocalFocusManager.current
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    var textFieldValue by remember(value) {
        mutableStateOf(TextFieldValue(text = value, selection = TextRange(value.length)))
    }

    val borderColor =
        when {
            hasError -> colorScheme.error
            isFocused -> colorScheme.primary
            else -> colorScheme.outlineVariant
        }
    val borderWidth = if (isFocused || hasError) 2.dp else 1.5.dp

    val monoInputStyle =
        TextStyle(
            fontFamily = JetBrainsMonoFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = if (isTablet) 20.sp else 16.sp,
            lineHeight = if (isTablet) 28.sp else 24.sp,
            letterSpacing = 1.2.sp,
            color = colorScheme.onSurface,
        )

    BasicTextField(
        value = textFieldValue,
        onValueChange = { incoming ->
            val sanitized = sanitizeSerialKey(incoming.text)
            textFieldValue =
                incoming.copy(
                    text = sanitized,
                    selection = TextRange(sanitized.length.coerceAtMost(incoming.selection.end)),
                )
            if (sanitized != value) {
                onValueChange(sanitized)
            }
        },
        enabled = enabled,
        singleLine = true,
        textStyle = monoInputStyle,
        cursorBrush = SolidColor(colorScheme.primary),
        interactionSource = interactionSource,
        keyboardOptions =
            KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                autoCorrectEnabled = false,
                keyboardType = KeyboardType.Ascii,
                imeAction = ImeAction.Done,
            ),
        keyboardActions =
            KeyboardActions(
                onDone = {
                    focusManager.clearFocus()
                    onDone()
                },
            ),
        modifier =
            Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
                .onPreviewKeyEvent { event ->
                    if (event.type == KeyEventType.KeyDown &&
                        (event.key == Key.Enter || event.key == Key.NumPadEnter)
                    ) {
                        focusManager.clearFocus()
                        onDone()
                        true
                    } else {
                        false
                    }
                }
                .semantics { contentDescription = "Kolom input Serial Key lisensi resmi" },
        decorationBox = { innerTextField ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(if (isTablet) 64.dp else 56.dp)
                        .clip(MaterialTheme.shapes.large)
                        .background(colorScheme.surfaceContainerLowest)
                        .border(borderWidth, borderColor, MaterialTheme.shapes.large)
                        .padding(start = if (isTablet) 20.dp else 14.dp, end = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = PosIcons.Key,
                    contentDescription = null,
                    tint =
                        when {
                            hasError -> colorScheme.error
                            isFocused -> colorScheme.primaryContainer
                            else -> colorScheme.primary
                        },
                    modifier = Modifier.size(if (isTablet) 28.dp else 24.dp),
                )

                Spacer(modifier = Modifier.width(if (isTablet) 14.dp else 10.dp))

                Box(
                    modifier = Modifier.weight(1f),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (value.isEmpty()) {
                        Text(
                            text = "KEY-9920-POS-XK88",
                            style = monoInputStyle.copy(color = LocalGodinovColors.current.placeholder),
                            maxLines = 1,
                        )
                    }
                    innerTextField()
                }

                if (value.isNotEmpty()) {
                    IconButton(
                        onClick = {
                            onClear()
                            focusRequester.requestFocus()
                        },
                        enabled = enabled,
                        modifier = Modifier.size(48.dp),
                    ) {
                        Icon(
                            imageVector = PosIcons.Close,
                            contentDescription = "Hapus Serial Key",
                            tint = colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                } else {
                    IconButton(
                        onClick = onPaste,
                        enabled = enabled,
                        modifier = Modifier.size(48.dp),
                    ) {
                        Icon(
                            imageVector = PosIcons.ContentPaste,
                            contentDescription = "Tempel Serial Key dari papan klip",
                            tint = colorScheme.primary,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
        },
    )
}
