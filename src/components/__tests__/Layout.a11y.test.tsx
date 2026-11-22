import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from '../Layout'

vi.mock('../MobileDrawer', () => ({ default: () => null }))
vi.mock('../Wallet/WalletConnectButton', () => ({ WalletConnectButton: () => null }))
vi.mock('../TrustlineBanner', () => ({ TrustlineBanner: () => null }))
vi.mock('../Notification/NotificationBell', () => ({ default: () => null }))
vi.mock('../ShortcutsHelp', () => ({ ShortcutsHelp: () => null }))
vi.mock('../ToastViewport', () => ({ ToastViewport: () => null }))
vi.mock('../ThemeToggle', () => ({ default: () => null }))
vi.mock('../CommandPalette', () => ({ default: () => null }))
vi.mock('../../utils/useBreakpoint', () => ({ useBreakpoint: () => false }))

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function SearchPage() {
  const [params, setParams] = useSearchParams()
  return (
    <label>
      Search help
      <input
        value={params.get('q') ?? ''}
        onChange={(event) => setParams({ q: event.currentTarget.value })}
      />
    </label>
  )
}

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Layout>
        <Routes>
          <Route path="/" element={<h1>Home page</h1>} />
          <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
          <Route path="/help/search" element={<SearchPage />} />
          <Route path="*" element={<h1>Not found</h1>} />
        </Routes>
      </Layout>
    </MemoryRouter>,
  )
}

describe('Layout navigation accessibility', () => {
  it('provides a first-tab skip link and moves focus to main when activated', async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.tab()
    const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skipLink).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(document.getElementById('main-content'))
  })

  it('updates title, announces pathname navigation, and focuses main without announcing initial load', async () => {
    const user = userEvent.setup()
    renderLayout()
    const liveRegion = document.querySelector('[aria-live="polite"]')

    expect(document.title).toBe('Home · Disciplr')
    expect(liveRegion).toBeEmptyDOMElement()
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))

    expect(document.title).toBe('Dashboard · Disciplr')
    expect(liveRegion).toHaveTextContent('Dashboard · Disciplr')
    expect(document.activeElement).toBe(document.getElementById('main-content'))
  })

  it('keeps focus in the search input when only the query changes', async () => {
    const user = userEvent.setup()
    renderLayout('/help/search')
    const input = screen.getByRole('textbox', { name: 'Search help' })

    await user.type(input, 'vault')

    expect(input).toHaveFocus()
    expect(input).toHaveValue('vault')
  })
})