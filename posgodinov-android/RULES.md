# posgodinov-android: Code Structure Rules

These rules are **mandatory** for every new or modified file in `posgodinov-android`. They describe the structure already applied in `ui/activation/` and `ui/components/`. When a rule conflicts with a quick fix, the rule wins. Changing a rule means editing this file in the same commit, with the reason written down.

Keywords: **MUST** / **MUST NOT** are hard requirements. **SHOULD** means follow unless you can write a one-line reason not to.

---

## 1. Package Layout

```
app/src/main/kotlin/id/godinov/pos/
├── MainActivity.kt              # Hosts the theme and calls exactly one Route
├── data/
│   └── network/                 # I/O only: HTTP, sockets. No Compose imports.
│       ├── HealthCheck.kt
│       └── DeviceBind.kt
└── ui/
    ├── theme/                   # Color.kt, Type.kt, Theme.kt: the only place for raw tokens
    ├── icons/                   # PosIcons: hand-built Material Symbols vectors
    ├── components/              # Shared, feature-agnostic composables (prefix `Pos`)
    │   ├── PosPrimaryButton.kt
    │   ├── PosSecondaryButton.kt
    │   ├── PosBrandCard.kt
    │   ├── PosBottomSheet.kt    # PosBottomSheet + PosConfirmSheet
    │   ├── PosSnackbar.kt
    │   └── InlineError.kt
    └── <feature>/               # One package per screen or flow, e.g. activation/
        ├── <Feature>Route.kt    # Stateful entry point
        ├── <Feature>Screen.kt   # Stateless layout + previews
        ├── <Part>.kt            # Feature-only sub-composables
        └── <Domain>.kt          # Feature-only constants and pure functions
```

- **MUST NOT** create `index.kt`, barrel files, or "re-export" files. Kotlin has no re-export; the package is the module boundary and imports are per symbol.
- **MUST NOT** create catch-all files or packages (`utils/`, `helpers/`, `common/`, `Extensions.kt`). A function belongs next to the code that owns its meaning.
- **MUST** keep `data/` free of Compose and Android UI imports.

## 2. File Organization

- **MUST** group by cohesion, not "one function per file". A private helper used by one composable stays in that composable's file (example: `CapabilityBadgeItem` lives in `CapabilityRail.kt`).
- **MUST** name the file after its primary public/internal declaration (`SerialKeyInputField.kt` declares `SerialKeyInputField`).
- **SHOULD** stay under **250 lines** per file. **MUST** split above **400 lines** by extracting a cohesive sub-composable into its own file.
- **MUST NOT** duplicate logic. Validation, sanitizing, and formatting live in exactly one function (example: `sanitizeSerialKey` in `SerialKey.kt`, used by both the Route and the input field).

## 3. Feature Screen Pattern: Route + Screen

Every screen is split in two:

| | `<Feature>Route` | `<Feature>Screen` |
|---|---|---|
| Role | Stateful entry point | Stateless layout |
| Owns | State, coroutines, `Context`, `BuildConfig`, data-layer calls, dialogs/sheets triggered by state | Rendering only |
| Inputs | Navigation callbacks (`onDeviceVerified`) | Plain values + `onXxx` lambdas + `SnackbarHostState` |
| Called by | `MainActivity` / navigation | Its Route and its `@Preview`s only |

- **MUST** expose only the Route and the Screen as `public` from a feature package.
- **MUST NOT** call the data layer, read `BuildConfig`, or use `LocalContext` for side effects inside a Screen or its sub-composables.
- **MUST** name event callbacks `onXxx` (`onSubmit`, `onPasteClipboard`) and pass state down as values, never as `MutableState`.

## 4. State Rules

- **MUST** use `rememberSaveable` for user input and UI flags that should survive rotation (text fields, `showHelpDialog`).
- **MUST** use plain `remember` for in-flight flags (`isSubmitting`, `isPinging`). The coroutine that resets them dies with the composition on recreation; a saved `true` would lock the UI forever.
- **MUST** guard re-entry in handlers (`if (isSubmitting) return`).

### When to introduce a ViewModel
**MUST** introduce `<Feature>ViewModel` + `<Feature>UiState` (in the same feature package, collected by the Route, e.g. `KeyActivationViewModel`) once a screen has any of:
- a write request that must survive configuration change or process death (activation POST, payment),
- a repository or local database (Room/DataStore),
- state shared across more than one screen.

The Route then becomes a thin adapter: collect `UiState`, forward events. The Screen does not change.

## 5. Visibility

| Location | Visibility |
|---|---|
| `ui/components/*` | `public` |
| Feature Route and Screen | `public` |
| Feature sub-composables and domain helpers | `internal` |
| Helpers used inside one file | `private` |
| `@Preview` functions | `private` |

## 6. Shared Components (`ui/components/`)

### Promotion rule
- **MUST** start every new composable inside its feature package.
- **MUST** promote it to `ui/components/` only when a **second feature** needs it, generalizing the hardcoded parts into parameters at that moment.
- **MUST NOT** create speculative generic components "for later". (`SerialKeyInputField` and `TopUtilityBar` stay in `activation/` until a second screen needs them.)

### API conventions (Compose API Guidelines)
- **MUST** prefix shared components with `Pos` (`PosPrimaryButton`), except purely semantic ones (`InlineError`).
- **MUST** order parameters: required data → required callbacks → `modifier: Modifier = Modifier` → optional parameters → trailing `content` slot.
- **MUST** have exactly one `modifier` parameter, applied first on the root element. Defaults come after it, so caller size modifiers win:
  ```kotlin
  modifier.fillMaxWidth().height(56.dp)   // caller's Modifier.height(64.dp) overrides 56.dp
  ```
- **MUST NOT** hardcode user-facing text or feature icons in shared components. Pass them as parameters.
- **SHOULD** expose a `loading` parameter instead of letting callers swap in a spinner.

### Wrap Material 3, never re-implement it
- **MUST** build on Material 3 primitives (`ModalBottomSheet`, `SnackbarHost`, `AlertDialog`, `Button`, `Surface`) and only wrap them for project styling.
- **MUST** show transient feedback via `PosSnackbarHost` + `SnackbarHostState.showPosMessage(...)`. No custom toast composables.
- **MUST** use `PosConfirmSheet` for confirmations and `PosBottomSheet` for custom bottom sheets.
- **MUST** close sheets through the provided `dismiss` lambda, never by flipping the caller's visibility state inside `onConfirm`. Flipping state directly skips the exit animation.
  ```kotlin
  if (showConfirm) {
      PosConfirmSheet(
          title = "Batalkan transaksi?",
          message = "Item di keranjang akan dihapus.",
          confirmText = "Batalkan",
          destructive = true,
          onConfirm = { cart.clear() },          // do NOT set showConfirm = false here
          onDismiss = { showConfirm = false },   // called after the slide-down animation
      )
  }
  ```

## 7. Theme, Color, Type, Icons

- **MUST NOT** write `Color(0x...)` outside `ui/theme/`. Use `MaterialTheme.colorScheme.*` or `LocalGodinovColors.current.*`.
- **MUST** use `MaterialTheme.typography.*` and `MaterialTheme.shapes.*`. Ad-hoc `TextStyle` is allowed only for a documented special case (the monospaced serial key input).
- **MUST** keep `JetBrainsMonoFontFamily` restricted to codes and keys (disambiguates `0/O`, `1/I`).
- **MUST** add icons to `PosIcons` as 24dp vectors. **MUST NOT** add `material-icons-extended` (~35 MB).
- **MUST** meet WCAG AA contrast (4.5:1 normal text, 3:1 large text and icons). Verify new token pairings before using them.
- **MUST** support both light and dark color schemes for every new token.

## 8. Data Layer (`data/`)

- **MUST** make I/O functions `suspend` and switch with `withContext(Dispatchers.IO)`.
- **MUST** return data types (`HealthCheckResult`), never UI strings or UI types. The Route maps results to user-facing messages.
- **MUST** catch specific exceptions (`IOException`). **MUST NOT** catch `Exception` or `Throwable`: it swallows `CancellationException` and breaks coroutine cancellation.
- **MUST** read endpoints from `BuildConfig.API_BASE_URL` at the Route level and pass the base URL in. Never hardcode hosts.

## 9. Adaptive Layout

- **MUST** derive layout from `BoxWithConstraints`, using these breakpoints:

  | Breakpoint | Meaning |
  |---|---|
  | `maxWidth >= 600.dp` | Tablet layout (primary target, 10" to 14" landscape) |
  | `maxWidth >= 720.dp` | Wide rows allowed (single-line rails) |
  | `maxWidth >= 900.dp` | Wide tablet spacing |
  | `maxHeight < 520.dp` | Short viewport: compress vertical spacing |

- **MUST** keep touch targets at least **48dp**. Primary inputs and CTAs: **64dp** on tablet, **56dp** on phone.
- **MUST** make full screens scrollable (`verticalScroll`) and apply `systemBarsPadding()` + `imePadding()` (the app runs edge-to-edge).
- **MUST NOT** allow horizontal overflow on a 360dp-wide phone.

## 10. Accessibility and Input

- **MUST** give icon-only buttons a `contentDescription`. Decorative icons next to text use `contentDescription = null`.
- **MUST** show a visible focus state (2dp border) on custom clickable surfaces.
- **MUST** submit single-line forms on hardware `Enter` / `NumPadEnter` (POS terminals often have keyboards or scanners).

## 11. Previews

- **MUST** provide, for every `<Feature>Screen`: tablet landscape (`widthDp = 1280, heightDp = 800`), phone portrait (`widthDp = 390, heightDp = 844`), and an error state.
- **SHOULD** route previews through one `private` `PreviewScreen(...)` helper with defaults, instead of repeating the full parameter list.
- Composables rendered in a separate window (`ModalBottomSheet`, `AlertDialog`) are exempt from static previews.

## 12. Copy and Comments

- User-facing copy is **Indonesian**, specific to the action ("Verifikasi", "Uji Koneksi"), and **MUST NOT** contain the em dash character.
- Strings are currently inline in Kotlin. **MUST** move them to `res/values/strings.xml` when a second locale is required. Do not mix both styles within a feature.
- Comments explain **why**, in at most two lines. **MUST NOT** add banner separators, step narration (`// 1. ...`), or comments that restate the code.
- KDoc only on public APIs whose behavior is not obvious from the signature (for example the `dismiss` contract on `PosBottomSheet`).

## 13. Build Gate

Before every commit:

1. `./gradlew assembleDebug assembleRelease` **MUST** pass with **zero** Kotlin warnings and a green `lintVitalRelease`.
2. **MUST NOT** add `.java` source files. Java sources trigger AGP's `JdkImageTransform`, which fails on OpenJDK 24+ hosts (see README, section on `BuildConfig`).
3. **MUST NOT** add a dependency when the platform, Material 3, or an existing library already covers it. New dependencies go into `gradle/libs.versions.toml`.
4. Run `graphify update .` from the repository root to refresh the code graph.

## 14. New Screen Checklist

- [ ] `ui/<feature>/` package with `<Feature>Route.kt` (stateful) and `<Feature>Screen.kt` (stateless)
- [ ] Only Route and Screen are `public`; everything else `internal` or `private`
- [ ] No data-layer, `BuildConfig`, or `Context` side effects inside the Screen
- [ ] Shared pieces reused from `ui/components/`; nothing promoted without a second user
- [ ] Colors, type, shapes, icons from theme and `PosIcons` only
- [ ] Feedback via `PosSnackbarHost`, confirmations via `PosConfirmSheet`
- [ ] Tablet, phone, and error previews
- [ ] No file above 400 lines
- [ ] Build gate passes with zero warnings
