# Disciplr Frontend

**Live demo: https://disciplr-frontend-alpha.vercel.app**

[![CI](https://github.com/Disciplr-Org/Disciplr-Frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/Disciplr-Org/Disciplr-Frontend/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/live-demo-7c9cff)](https://disciplr-frontend-alpha.vercel.app)
[![API](https://img.shields.io/badge/API-live-3ddc97)](https://disciplr-api.vercel.app)

Web app for **Disciplr**: commitment vaults on Stellar. Lock USDC against milestones, have a verifier confirm progress, and release funds on success or redirect them on failure.

- **Live API (used by this app):** https://disciplr-api.vercel.app ([backend repo](https://github.com/Disciplr-Org/Disciplr-backend))
- **Live demo:** https://disciplr-frontend-alpha.vercel.app

## Features

- Landing page, dashboard (totals, deadlines, at-risk vaults, activity)
- Vault list with status filters, vault detail with milestones, timeline and actions (validate milestone, cancel)
- Vault creation with review step and validation
- Transactions feed (create, validate, release, redirect)
- Verifier queue and history, analytics, help center, in-app docs at `/docs`
- Wallet: Freighter on testnet, or a built-in **Demo account** (no wallet needed)
- Light/dark theme, responsive layout

## Architecture

```
React 18 + Vite + Tailwind 4 + Zustand
  src/pages        routes (Home, Dashboard, Vaults, VaultDetail, CreateVault, Transactions, Docs, Verifier*, Analytics, ...)
  src/services     vaultService.ts (data seam), api.ts (Disciplr API client + mappers)
  src/context      Wallet (Freighter + demo), Theme, AppConfig
  src/fixtures     offline sample data used when VITE_API is unset
```

`vaultService` calls the API when `VITE_API` is set and otherwise serves bundled fixtures.

### Routes and request flow

The route definitions below reflect [`src/App.tsx`](src/App.tsx). Public routes
can be opened without a connected wallet; wallet routes are guarded by
`ProtectedRoute` and require a connected wallet. Lazy routes load their page
component on demand.

| Path | Page component | Auth | Lazy |
| --- | --- | --- | --- |
| `/` | `Home` | public | no |
| `/dashboard` | `Dashboard` | public | no |
| `/vaults` | `Vaults` | public | no |
| `/transactions` | `Transactions` | public | no |
| `/docs` | `Docs` | public | no |
| `/vaults/create` | `CreateVault` | wallet | no |
| `/vaults/:id/transactions` | `VaultTransactions` | public | yes |
| `/vaults/:id` | `VaultDetail` | public | no |
| `/verifier` | `VerifierDashboard` | public | no |
| `/verifier/queue` | `PendingValidations` | wallet | no |
| `/verifier/queue/:vaultId` | `ValidationDetail` | wallet | no |
| `/verifier/history` | `ValidationHistory` | public | no |
| `/help` | `HelpCenter` | public | no |
| `/help/search` | `HelpCenter` | public | no |
| `/help/articles/:slug` | `HelpArticle` | public | yes |
| `/analytics` | `Analytics` | public | yes |
| `/notifications` | `Notification` | public | yes |
| `/notifications/settings` | `NotificationSettings` | public | yes |
| `/__visual__/crash` | `VisualCrash` (visual mode only) | public | no |
| `*` | `NotFound` | public | no |

Unknown paths render `NotFound`. Each route's `RouteErrorBoundary` scopes a
page crash to its slot inside `<main>`, leaving the shared layout available.
Requests flow through providers in this order:
`ThemeProvider > WalletProvider > AppConfigProvider > BrowserRouter > Layout`.
`Layout` wraps the matched route in its `<main>` content. See the fuller
[architecture overview](docs/ARCHITECTURE.md) and
[wallet integration guide](docs/WALLET_INTEGRATION.md) for details.

Update this reference when routes change; changing route behavior is outside
this documentation update.

## Setup

```bash
npm install
cp .env.example .env     # VITE_API=https://disciplr-api.vercel.app/api
npm run dev              # http://localhost:5173
npm run build            # production build in dist/
npm test                 # vitest
```

## Environment variables

| Name | Description |
| --- | --- |
| `VITE_API` | Base URL of the Disciplr API including `/api`. Unset = offline fixtures |
| `VITE_API_TARGET` | Dev-server proxy target for `/api` (default `http://localhost:3000`) |
| `VITE_DEV_PORT` | Dev server port (default 5173) |

## Deployment

Configured for Vercel (`vercel.json`: Vite build, SPA rewrite). Deployed as Vercel project `disciplr-frontend` with `VITE_API` set for production. To redeploy:

```bash
vercel --prod --yes          # if the free-plan upload limit is hit: vercel build --prod && vercel deploy --prebuilt --prod --archive=tgz
```

## Demo limitations

Settlement is simulated by the API (no real funds move). In demo mode you are your own verifier so the full flow can be tried alone. Extending a deadline is not supported by the API.

Earlier detailed notes remain in `docs/` and git history.
