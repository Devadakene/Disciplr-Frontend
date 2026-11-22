# Token Catalog

This catalog maps token groups to their runtime CSS variables, utility files,
and component consumers. Keep it current when adding tokens or migrating
components to the design system.

| Token group | Token source | Runtime variables or utilities | Current consumers |
| --- | --- | --- | --- |
| Core color surfaces | `tokens/colors.json` | `--bg`, `--surface`, `--surface-raised`, `--border`, `--text`, `--muted`, `--hover` in `src/index.css` | `Layout`, `Dashboard`, `VaultCard`, `Field`, `ConfirmationModal`, wallet components, notification settings |
| Semantic colors | `tokens/colors.json` | `--accent`, `--accent-dim`, `--accent-transparent`, `--danger`, `--success`, `--warning`, `--info` | Primary actions, dashboard status badges, analytics filters, notification toggles, icons, focus rings |
| Chart colors | `tokens/colors.json` | Read through `src/pages/analyticsTheme.ts` and documented in `documentation/chart-palette.md` | `Analytics`, Recharts series, chart tooltips, chart screen-reader summaries |
| Typography | `tokens/typography.json` | `--font-size-*`, `--line-height-*`, `--font-weight-*`, `.text-*` classes, `src/utils/typography.ts` | `Text`, page headings, captions, body copy, dashboard metrics, financial mono text |
| Spacing | `tokens/spacing.json` | `--spacing-*`, `--container-*`, `--touch-target`; responsive breakpoints documented in `documentation/breakpoints.md` | Page sections, form spacing, cards, grids, navigation, dashboard panels |
| Borders and radius | `tokens/borders.json` | `--radius-*`, `--border-width-*`, `--border-default`, `--border-subtle`, `--border-emphasis`, `--border-interactive`, `--border-error`, `--border-success` | `Field`, `VaultCard`, `ConfirmationModal`, wallet dropdowns, pills, avatars, focus states |
| Focus ring | `tokens/borders.json` (`border.focusRing`) | `--focus-ring-width`, `--focus-ring-offset`, `--focus-ring-color` in `src/index.css`; applied via global `:focus-visible` rule | All interactive elements: buttons, links, inputs, selects, textareas, `[role="button"]` |
| Shadows | `tokens/shadows.json` | Elevation references for raised surfaces and overlays | Modals, dropdowns, raised cards, dashboard surfaces |
| Motion | `tokens/motion.json` | `src/utils/motion.ts` exports `duration`, `ease`, `transitionEnter`, `transitionExit`, and `transitionPage` | `Notification`, animated overlays, dropdowns, page transitions |
| Z-index | `tokens/z-index.json` | `--z-index-base`, `--z-index-header`, `--z-index-tooltip`, `--z-index-drawer`, `--z-index-modal`, `--z-index-toast` | `Layout`, `MobileDrawer`, `ConfirmationModal`, wallet modals, notification popovers, tooltips, `ToastViewport` |
| Toast | `tokens/toast.json` | Runtime constants in `src/Zustand/toastStore.ts` (`TOAST_DEFAULT_DURATION_MS`, `TOAST_REDUCED_MOTION_DURATION_MS`, `TOAST_MAX_VISIBLE`); z-index via `--z-index-toast`. See `documentation/toast.md` | `ToastViewport`, `useToast`, wallet/copy/validation feedback |
| Opacity | `tokens/opacity.json` | `--opacity-disabled`, `--opacity-backdrop`, `--opacity-hover`, `--opacity-muted` | `Field`, `Modal`, disabled controls, overlays |

## Component Notes

- `Text` should be the default wrapper for semantic typography roles. It maps
  roles to the responsive text classes in `src/index.css`.
- `Field` consumes border, radius, focus, spacing, and text tokens. See
  `documentation/field.md` before changing form-control styles.
- `VaultCard` consumes surface, border, radius, spacing, success/accent status,
  and typography tokens.
- `ConfirmationModal` consumes overlay, surface, radius, spacing, action, focus,
  and accessibility patterns documented in `documentation/confirmation-modal.md`.
- Analytics views should use the chart palette and `src/pages/analyticsTheme.ts`
  instead of hard-coded chart colors.

## Security: Token File Loading

`loadTokens(tokenFile)` and `getAllTokens()` in
`design-system/src/utils/token-loader.ts` confine all file reads to the
`tokens/` directory using:

- A **basename-only regex** — the argument must contain no `/` or `\` and must
  end with `.json`; anything else throws `Invalid token file name`.
- A **within-`tokens/` resolution guard** — the resolved absolute path must
  start with `path.resolve(cwd, 'tokens') + path.sep`; a mismatch throws
  `Path traversal detected`.

Pass only static, trusted names (e.g. `'colors.json'`). Never derive
`tokenFile` from user-supplied or untrusted input.

For the full loader contract, failure-mode table, worked examples, and guidance
on adding a new file to the `getAllTokens` aggregator, see
[**Token Loader Contract**](./token-loader.md).

## Validation Entry Points

> 📝 **Adding a new token?** Please refer to the [Token Authoring Guide](./token-authoring.md) for required formats, naming conventions, and validation rules.

Token shape validation lives in `design-system/src/utils/validators.ts`:

- `isValidHexColor`, `isValidRgbColor`, `isValidHslColor`, and
  `isValidColorString` validate raw color values.
- `isKebabCase` and `hasValidTokenPrefix` validate token naming conventions.
- `isValidColorToken` validates color token objects and optional accessibility
  metadata.
- `isValidChartTokens` validates chart surface, categorical, and sequential
  ramps.

## CSS Variable Generation

The `generateCssVariables` utility in `design-system/src/utils/css-variables.ts`
converts the design token tree into a flat `Record<string, string>` of CSS
custom property declarations. It is a pure function with no DOM access.

### Usage

```ts
import { generateCssVariables, generateCssVariablesString } from '@disciplr/design-system';
import colors from '../tokens/colors.json';

// Get a flat map of variable names to values (light mode by default)
const vars = generateCssVariables(colors);
// → { 'color-primary': '#1E40AF', 'color-neutral-50': '#F9FAFB', … }

// Get dark mode values
const darkVars = generateCssVariables(colors, 'dark');
// → { 'color-primary': '#3B82F6', … }

// Get a CSS :root block string
const css = generateCssVariablesString(colors, 'dark', { prefix: 'ds' });
// → ":root {\n  --ds-color-primary: #3B82F6;\n  …\n}"
```

### Features

- **Light/dark variants** — color tokens with `light`/`dark` sub-keys are
  resolved to the requested mode. Falls back to `light` when the requested
  mode is missing.
- **Reference resolution** — `{path.to.token}` references are resolved against
  already-emitted variables.
- **Deterministic ordering** — output keys are sorted alphabetically.
- **All token types** — handles `color`, `dimension`, `number`, `duration`,
  `cubicBezier`, `shadow`, and `typography` tokens.
- **Options** — `prefix` and `separator` control the output naming convention.

### Options

| Option      | Default | Description |
|-------------|---------|-------------|
| `prefix`    | `''`    | Prefix added to every variable name (e.g. `"ds"` → `--ds-color-…`) |
| `separator` | `'-'`   | Separator between nesting levels (e.g. `"__"` → `color__primary`) |

When a token group changes, update the token file, runtime CSS or utility
mapping, this catalog, and the relevant focused docs in `documentation/`.
