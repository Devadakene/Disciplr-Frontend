import { describe, expect, it } from 'vitest'
import { ROUTE_TITLES, formatDocumentTitle, getRouteTitle } from '../titles'

function toSamplePath(path: string): string {
  return path.replace(/:[^/]+/g, 'abc')
}

describe('ROUTE_TITLES and getRouteTitle', () => {
  const nonWildcardRoutes = ROUTE_TITLES.filter(({ path }) => path !== '*')

  it.each(nonWildcardRoutes)(
    'resolves $path to "$title"',
    ({ path, title }) => {
      expect(getRouteTitle(toSamplePath(path))).toBe(title)
    },
  )

  it('guards load-bearing route ordering for specific paths', () => {
    expect(getRouteTitle('/vaults/create')).toBe('Create Vault')
    expect(getRouteTitle('/vaults/create')).not.toBe('Vault')
    expect(getRouteTitle('/vaults/abc/transactions')).toBe('Vault Transactions')
    expect(getRouteTitle('/help/articles/demo-mode')).toBe('Help Article')
  })

  it('returns "Not found" for unknown paths and empty string', () => {
    expect(getRouteTitle('/nope')).toBe('Not found')
    expect(getRouteTitle('/unknown/nested/route')).toBe('Not found')
    expect(getRouteTitle('')).toBe('Not found')
  })
})

describe('formatDocumentTitle', () => {
  it('formats a page title with the Disciplr suffix', () => {
    expect(formatDocumentTitle('X')).toBe('X · Disciplr')
  })
})
