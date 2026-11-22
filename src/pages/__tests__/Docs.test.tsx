import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const FALLBACK_API = 'https://disciplr-api.vercel.app'

async function renderDocs(apiBase?: string) {
  vi.resetModules()
  vi.stubEnv('VITE_API', apiBase)
  const { default: Docs } = await import('../Docs')

  render(
    <MemoryRouter>
      <Docs />
    </MemoryRouter>,
  )
}

function expectSafeExternalLinks() {
  const externalLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('target') === '_blank')
  expect(externalLinks.length).toBeGreaterThan(0)
  externalLinks.forEach((link) => {
    const rel = link.getAttribute('rel')?.split(/\s+/) ?? []
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('Docs page API URLs and links', () => {
  it('uses the fallback API host in links and curl examples when VITE_API is unset', async () => {
    await renderDocs()

    expect(screen.getByRole('link', { name: FALLBACK_API })).toHaveAttribute('href', FALLBACK_API)
    expect(screen.getByRole('link', { name: 'OpenAPI spec' })).toHaveAttribute(
      'href',
      `${FALLBACK_API}/api/openapi.json`,
    )
    expect(screen.getByText(new RegExp(`curl ${FALLBACK_API}/api/vaults`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`VITE_API=${FALLBACK_API}/api npm run dev`))).toBeInTheDocument()

    expectSafeExternalLinks()
  })

  it('strips a trailing /api from VITE_API and keeps links safe', async () => {
    const apiBase = 'https://x.test'
    await renderDocs(`${apiBase}/api/`)

    expect(screen.getByRole('link', { name: apiBase })).toHaveAttribute('href', apiBase)
    expect(screen.getByRole('link', { name: 'OpenAPI spec' })).toHaveAttribute(
      'href',
      `${apiBase}/api/openapi.json`,
    )
    expect(screen.getByText(new RegExp(`curl ${apiBase}/api/vaults`))).toBeInTheDocument()
    expectSafeExternalLinks()
  })

  it('keeps internal navigation targets correct', async () => {
    await renderDocs()

    const links = screen.getAllByRole('link')
    const internalHrefs = links
      .map((link) => link.getAttribute('href'))
      .filter((href) => href?.startsWith('/'))

    expect(internalHrefs).toEqual(
      expect.arrayContaining(['/vaults/create', '/dashboard', '/vaults']),
    )
  })
})
