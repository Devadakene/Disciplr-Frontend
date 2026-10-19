import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext'
import { AppConfigProvider } from './context/AppConfigContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import RequireWallet from './components/RequireWallet'
import Skeleton from './components/Skeleton'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import CreateVault from './pages/CreateVault'
import VaultDetail from './pages/VaultDetail'
import VerifierDashboard from './pages/VerifierDashboard'
import PendingValidations from './pages/PendingValidations'
import ValidationDetail from './pages/ValidationDetail'
import ValidationHistory from './pages/ValidationHistory'
import HelpCenter from './pages/HelpCenter'
import NotFound from './pages/NotFound'
import Vaults from './pages/Vaults'
import Transactions from './pages/Transactions'
import Docs from './pages/Docs'

const Analytics = lazy(() => import('./pages/Analytics'))
const Notification = lazy(() => import('./pages/Notification'))
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'))

// Test-only: throws during render so the visual suite can snapshot the ErrorBoundary.
function VisualCrash(): never {
  throw new Error('Visual regression test crash')
}

const PageFallback = <Skeleton className="w-full h-screen" />

/**
 * Route authorization invariant:
 * - Routes that mutate or expose wallet-scoped state MUST be wrapped in
 *   <RequireWallet /> so unauthenticated users cannot reach them.
 * - Routes that are read-only/public MUST NOT be wrapped, so they remain
 *   reachable without a connected wallet.
 * - Every protected route must render a deterministic fallback (never a
 *   blank screen) while authorization is being resolved.
 *
 * The helper below centralizes that contract so new routes cannot silently
 * bypass the guard by forgetting the wrapper.
 */
type ProtectedRouteProps = {
  children: ReactNode
  routeKey?: string
}

function ProtectedRoute({ children, routeKey }: ProtectedRouteProps) {
  return <RequireWallet key={routeKey}>{children}</RequireWallet>
}

/**
 * Lazy routes must be wrapped in Suspense with a deterministic fallback so
 * that a slow/failed chunk load cannot leave the app in an inconsistent
 * state (blank screen, stale route, or unhandled rejection).
 */
function LazyRoute({ children }: ProtectedRouteProps) {
  return <Suspense fallback={PageFallback}>{children}</Suspense>
}

/**
 * Route table invariants (regression coverage in src/App.test.tsx):
 * 1. Protected paths: /vaults/create, /vaults/:id, /verifier/queue,
 *    /verifier/queue/:vaultId. These require a connected wallet.
 * 2. Public paths: /, /dashboard, /vaults, /vaults/:id/transactions,
 *    /transactions, /verifier, /verifier/history, /help, /help/search.
 * 3. Lazy paths: /analytics, /notifications, /notifications/settings.
 * 4. Unknown paths fall through to NotFound (deterministic 404).
 * 5. Route order matters: more specific paths must be declared before
 *    wildcard/param routes that could shadow them.
 */
const PROTECTED_PATHS = [
  '/vaults/create',
  '/vaults/:id',
  '/verifier/queue',
  '/verifier/queue/:vaultId',
] as const

// Wrap a route's page element in a per-route ErrorBoundary so that an
// unhandled render error is scoped to that page's slot in <main>. The header,
// nav, and mobile drawer (rendered by Layout outside of <main>) remain mounted
// and navigable when a single page crashes. Layout also provides a secondary
// ErrorBoundary around its <main> content as a backstop.
function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export default function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <AppConfigProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<RouteErrorBoundary><Home /></RouteErrorBoundary>} />
                <Route path="/dashboard" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
                <Route path="/vaults" element={<RouteErrorBoundary><Vaults /></RouteErrorBoundary>} />
                <Route path="/transactions" element={<RouteErrorBoundary><Transactions /></RouteErrorBoundary>} />
                <Route path="/docs" element={<RouteErrorBoundary><Docs /></RouteErrorBoundary>} />
                <Route path="/vaults/create" element={<RouteErrorBoundary><ProtectedRoute routeKey="/vaults/create"><CreateVault /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/vaults/:id" element={<RouteErrorBoundary><ProtectedRoute routeKey="/vaults/:id"><VaultDetail /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/verifier" element={<RouteErrorBoundary><VerifierDashboard /></RouteErrorBoundary>} />
                <Route path="/verifier/queue" element={<RouteErrorBoundary><ProtectedRoute routeKey="/verifier/queue"><PendingValidations /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/verifier/queue/:vaultId" element={<RouteErrorBoundary><ProtectedRoute routeKey="/verifier/queue/:vaultId"><ValidationDetail /></ProtectedRoute></RouteErrorBoundary>} />
                <Route path="/verifier/history" element={<RouteErrorBoundary><ValidationHistory /></RouteErrorBoundary>} />
                <Route path="/help" element={<RouteErrorBoundary><HelpCenter /></RouteErrorBoundary>} />
                <Route path="/help/search" element={<RouteErrorBoundary><HelpCenter /></RouteErrorBoundary>} />
                <Route
                  path="/analytics"
                  element={
                    <RouteErrorBoundary>
                      <LazyRoute>
                        <Analytics />
                      </LazyRoute>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <RouteErrorBoundary>
                      <LazyRoute>
                        <Notification />
                      </LazyRoute>
                    </RouteErrorBoundary>
                  }
                />
                <Route
                  path="/notifications/settings"
                  element={
                    <RouteErrorBoundary>
                      <LazyRoute>
                        <NotificationSettings />
                      </LazyRoute>
                    </RouteErrorBoundary>
                  }
                />
                {import.meta.env.MODE === 'visual' && (
                  <Route path="/__visual__/crash" element={<RouteErrorBoundary><VisualCrash /></RouteErrorBoundary>} />
                )}
                <Route path="*" element={<RouteErrorBoundary><NotFound /></RouteErrorBoundary>} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </AppConfigProvider>
      </WalletProvider>
    </ThemeProvider>
  )
}

export { PROTECTED_PATHS }
export type { ProtectedRouteProps }
