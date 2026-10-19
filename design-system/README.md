# Disciplr Design System

A comprehensive design system for the Disciplr financial platform.

## Structure

- `tokens/` - Design tokens (colors, typography, spacing, etc.)
- `documentation/` - Design system documentation
- `src/` - Source utilities for token validation and compilation

## Getting Started

See `documentation/getting-started.md` for setup instructions.

For a -to-component map, see `documentation/token-catalog.md`.

## Testing

This package uses Jest with `ts-jest` for token and validator tests. See
[`../docs/TESTING.md`](../docs/TESTING.md#design-system-jest-patterns) for the
design-system test command, coverage threshold, and contributor conventions.

## Component Documentation

- [`MilestoneTracker`](documentation/milestone-tracker.md) - ordered vault
  milestone progress with status badges and current-step accessibility.
- [`VaultProgressBar`](documentation/vault-progress-bar.md) - shared vault
  progress primitive with clamped values and ARIA progressbar semantics.

## Token Loader

The `loadTokens` / `getAllTokens` API in `src/utils/token-loader.ts` enforces
basename-only filenames, a `.json` extension requirement, and a
within-`tokens/` path-traversal guard before any file is read.

See [`documentation/token-loader.md`](documentation/token-loader.md) for the
full contract, security guarantees, worked examples, and failure modes.

## Responsive breakpoints

Disciplr uses a five-step breakpoint scale that is shared between CSS, Tailwind v4
(via `@tailwindcss/vite`), and component code. The `sm` / `md` / `lg` triple is the
canonical set; `xl` / `2xl` are documented for completeness.

| Token   | Min width | Tailwind | Primary intent                                                         |
| ------- | --------- | -------- | ---------------------------------------------------------------------- |
| `sm`    | 640 px    | `sm:`    | Large mobile — restore generous padding, body type 14 → 16 px          |
| `md`    | 768 px    | `md:`    | Tablet — bump display/title scale, allow side-by-side cards            |
| `lg`    | 1024 px   | `lg:`    | Small laptop — show full nav labels, introduce sidebar layouts         |
| `xl`    | 1280 px   | `xl:`    | Desktop — reach `desktop.maxWidth = 1280 px` container                 |
| `2xl`   | 1536 px   | `2xl:`   | Large screens — no additional reflow                                   |

Source of truth: [`tokens/spacing.json`](tokens/spacing.json) → `spacing.breakpoint.*`
and `spacing.grid.{mobile|tablet|desktop}`.

For the full breakpoint table, container max-width audit, vault-column stacking
guidance, off-token usage catalogue, and example layouts per breakpoint, see
[`documentation/breakpoints.md`](documentation/breakpoints.md).

* 🎨 **Tokens:** Read our [Token Authoring Guide](./documentation/token-authoring.md) before adding or modifying design tokens.
* 🔒 **Token Loader:** See the [Token Loader Contract](./documentation/token-loader.md) for security guarantees and the correct consumption API.
