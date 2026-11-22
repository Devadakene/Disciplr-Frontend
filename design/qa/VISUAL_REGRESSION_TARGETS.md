# Visual Regression Targets — Disciplr Frontend

**Purpose:** Define the canonical snapshot set for automated (self-hosted Playwright) and manual visual regression testing.  
**Branch:** `design/qa-checklist-visual-regression`  
**Related:** `design/qa/DESIGN_QA_CHECKLIST.md`, `design/qa/RELEASE_GATE.md`

---

## Automated approach: self-hosted Playwright (no SaaS)

Visual regression is implemented with `@playwright/test` and Playwright's built-in `toHaveScreenshot`. No Percy/Chromatic account or token is required.

- Config: `playwright.visual.config.ts`; specs and fixtures: `e2e/visual/`; baselines: `e2e/visual/__screenshots__/` (PNG only, Linux-generated).
- Projects: `chromium-1440-light`, `chromium-1440-dark`, `chromium-390-light`, `chromium-390-dark` (390x844, `isMobile`).
- The app is built with `vite build --mode visual` (VITE_API unset, so it runs on offline fixtures) and served by `vite preview` on port 4173. The `visual` mode also enables a test-only `/__visual__/crash` route used to snapshot the ErrorBoundary fallback.
- Threshold: `maxDiffPixelRatio: 0.01`, `animations: 'disabled'`.

### Routes covered

`/`, `/dashboard`, `/vaults`, `/vaults/1`, `/vaults/create` (empty and validation errors), `/verifier/queue`, `/verifier/history`, `/analytics`, `/help`, `/notifications/settings`, a 404, and the error-boundary fallback. Protected routes use the built-in demo account.

### Determinism

Frozen clock (`2026-01-15T10:00:00Z`), theme forced via `localStorage['disciplr-theme']`, `prefers-reduced-motion: reduce`, animations/transitions disabled, web fonts blocked, and a network guard that fails any test whose page requests anything outside `http://localhost:4173`. No masks are used.

### Commands

```bash
npx playwright install --with-deps chromium
npm run test:visual          # compare against baselines
npm run test:visual:update   # regenerate baselines
```

Baselines must be generated in the pinned Linux image (fonts differ per OS). On macOS/Windows:

```bash
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.49.1-jammy \
  bash -c "corepack enable && pnpm install --frozen-lockfile && pnpm run test:visual:update"
```

Alternatively, run the **Visual Regression** workflow manually (`workflow_dispatch`, `update: true`) and download the `visual-baselines` artefact.

### CI

`.github/workflows/visual.yml` runs on PRs that touch `src/**`, `design-system/**` or `index.html` (plus the visual suite files) and uploads `test-results/visual/` and `playwright-report/` on failure. Docs-only PRs do not trigger it.

### Baseline management

1. A reviewer must inspect every changed PNG in the PR diff; never regenerate baselines to silence an unexplained failure.
2. Update baselines only after a design-approved change, using the Docker command above, and commit the PNGs with the change.

---

## Manual / legacy notes

The tables below remain useful for manual audits when automated tooling is unavailable.

---
## Manual Snapshot List

Use this list when automated tooling is not available. Capture screenshots with browser DevTools at the specified viewport. Store in `design/qa/screenshots/YYYY-MM-DD/`.

### Naming convention

```
{PageName}_{theme}_{viewport}_{state}.png
```

Example: `Vaults_light_375_default.png`

### Required snapshots (light mode — primary)

| # | Page / Surface | Viewport | State | Notes |
|---|---|---|---|---|
| 1 | Home | 375 | default | |
| 2 | Home | 768 | default | |
| 3 | Home | 1280 | default | |
| 4 | Vaults | 375 | default (3 vaults shown) | |
| 5 | Vaults | 1280 | default | |
| 6 | CreateVault | 375 | empty form | |
| 7 | CreateVault | 375 | validation errors | Submit with empty fields |
| 8 | CreateVault | 1280 | empty form | |
| 9 | Dashboard | 375 | default | |
| 10 | Dashboard | 1280 | default | |
| 11 | VaultDetail | 375 | active vault | |
| 12 | VaultDetail | 1280 | active vault | |
| 13 | VaultTransactions | 375 | default | |
| 14 | VaultTransactions | 1280 | default | |
| 15 | Notifications | 375 | unread items | |
| 16 | Notifications | 1280 | unread items | |
| 17 | NotificationSettings | 375 | default | |
| 18 | NotificationSettings | 1280 | default | |
| 19 | Modal (any) | 375 | open | |
| 20 | Modal (any) | 1280 | open | |

### Required snapshots (dark mode — note gaps)

| # | Page / Surface | Viewport | State | Notes |
|---|---|---|---|---|
| 21 | Home | 1280 | default | |
| 22 | Vaults | 1280 | default | Check muted text contrast |
| 23 | CreateVault | 1280 | empty form | Check input border contrast |
| 24 | Dashboard | 1280 | default | |
| 25 | VaultDetail | 1280 | active vault | |
| 26 | Notifications | 1280 | unread items | |
| 27 | Modal (any) | 1280 | open | |

### Focus state snapshots (light mode)

| # | Element | Notes |
|---|---|---|
| 28 | Vault card (focused) | Tab to first card, screenshot |
| 29 | Create Vault submit button (focused) | Tab to button |
| 30 | Modal close button (focused) | Open modal, Tab to × |
| 31 | Nav link (focused) | Tab to first nav item |

---

## Figma traceability

Link each snapshot target to its Figma frame:

| Snapshot target | Figma frame name | Figma node ID |
|---|---|---|
| Home — desktop | `Home / Desktop` | *(add node ID)* |
| Vaults — mobile | `Vaults / Mobile` | *(add node ID)* |
| CreateVault — form | `Create Vault / Form` | *(add node ID)* |
| Modal — open | `Modal / Default` | *(add node ID)* |
| *(add rows as frames are created)* | | |

> To get a Figma node ID: right-click a frame → "Copy link" → the `node-id` query param is the ID.
