# Contributing

## Test Setup

The project uses **two separate test runners** that must not be mixed.

### Configuration authority

App tests are configured exclusively in [`vitest.config.ts`](./vitest.config.ts). This is the authoritative Vitest configuration: it assigns `jsdom` to `.test.tsx` files, `node` to `.test.ts` files, loads `src/setupTests.ts`, and enforces the documented coverage thresholds. `vite.config.ts` is reserved for the development server and production build and intentionally contains no `test` block. Keep test-runner changes in `vitest.config.ts` so there is one source of truth.

### App tests — Vitest

Covers all files under `src/` (`*.test.ts` and `*.test.tsx`).

```bash
# Run once with coverage (CI mode)
npm test

# Interactive watch mode
npm run test:watch

# Run a single file
npx vitest run src/components/__tests__/NavLink.test.tsx
```

Coverage is written to `coverage/`. Open `coverage/index.html` for the HTML report.
Enforced thresholds: statements 50 %, branches 80 %, functions 65 %, lines 50 %.

**Environment**: `.test.tsx` files run in **jsdom** (DOM + RTL available). `.test.ts` files run in **node**.

**Setup file**: `src/setupTests.ts` — imports `@testing-library/jest-dom` so all RTL matchers (`toBeInTheDocument`, etc.) are available globally.

**`@` alias**: `@` resolves to `src/`. Use it in test imports the same way production code does:
```ts
import { foo } from '@/utils/foo';
```

### Design-system tests — Jest

Covers files under `design-system/src/`.

```bash
cd design-system

# Run once
npm test

# Interactive watch mode
npm run test:watch
```

## Linting

```bash
# App
npm run lint

# Design-system
cd design-system && npm run lint
```

## Branch Naming

```
type/short-slug
```

Examples: `feat/vault-filter`, `test/navlink-coverage`, `docs/contributing-guide`, `fix/pagination-reset`.

## Pull Requests

- PRs are expected to land within **96 hours** of being opened.
- Keep the diff focused — one concern per PR.
- Every new or changed line of testable code should maintain or improve coverage above the thresholds above.

## Internationalization (i18n) — Adding a Locale

All user-facing copy for migrated surfaces lives in `src/i18n/`. The English catalog (`src/i18n/en.ts`) is the source of truth for `MessageKey` — referencing a missing key fails `tsc`.

To add a new locale (for example, French `fr`):

1. **Create a catalog file** `src/i18n/fr.ts` typed as `PartialMessageCatalog` (any omitted key falls back to English and logs a dev-only warning once):
   ```ts
   import type { PartialMessageCatalog } from './types';

   export const fr: PartialMessageCatalog = {
     'home.hero.title': '...',
   };
   ```
2. **Register the locale** in `src/i18n/types.ts`:
   - Add `'fr'` to `SUPPORTED_LOCALES`.
   - Add its display name to `LOCALE_LABELS` (e.g. `fr: 'Français'`).
3. **Wire the catalog** in `src/i18n/translate.ts` by adding `fr` to `CATALOGS` and re-exporting it from `src/i18n/index.ts`.
4. **Interpolation & plurals**:
   - Use `{name}` placeholders for dynamic values: `t('dashboard.atRisk.title', { count: 3 })`.
   - Use `singular|plural` with a numeric `{count}` param for pluralized messages; `Intl.PluralRules` selects the appropriate form for the active locale.
5. **Verify**: Run `pnpm test` and `pnpm run lint` to confirm all existing tests and `src/i18n/__tests__/i18n.test.tsx` pass.
