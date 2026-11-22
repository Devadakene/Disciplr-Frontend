import { matchPath } from 'react-router-dom'

export const ROUTE_TITLES = [
  { path: '/', title: 'Home' },
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/vaults', title: 'Vaults' },
  { path: '/vaults/create', title: 'Create Vault' },
  { path: '/vaults/:id/transactions', title: 'Vault Transactions' },
  { path: '/vaults/:id', title: 'Vault' },
  { path: '/transactions', title: 'Transactions' },
  { path: '/docs', title: 'Documentation' },
  { path: '/verifier', title: 'Verifier Dashboard' },
  { path: '/verifier/queue', title: 'Pending Validations' },
  { path: '/verifier/queue/:vaultId', title: 'Validation' },
  { path: '/verifier/history', title: 'Validation History' },
  { path: '/help', title: 'Help Center' },
  { path: '/help/search', title: 'Help Search' },
  { path: '/help/articles/:slug', title: 'Help Article' },
  { path: '/analytics', title: 'Analytics' },
  { path: '/notifications', title: 'Notifications' },
  { path: '/notifications/settings', title: 'Notification Settings' },
  { path: '/__visual__/crash', title: 'Visual Test Error' },
  { path: '*', title: 'Not found' },
] as const

export function getRouteTitle(pathname: string): string {
  const route = ROUTE_TITLES.find(({ path }) =>
    matchPath({ path, end: true }, pathname),
  )
  return route?.title ?? 'Not found'
}

export function formatDocumentTitle(title: string): string {
  return `${title} · Disciplr`
}