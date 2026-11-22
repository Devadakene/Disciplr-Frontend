import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from '../Layout'

// Exercise the real focus trap, not the lightweight focus-trap-react mock in
// setupTests.ts. We want to detect keyboard focus escaping the open dialog.
vi.unmock('focus-trap-react')

vi.mock('../Wallet/WalletConnectButton', () => ({ WalletConnectButton: () => null }))
vi.mock('../TrustlineBanner', () => ({ TrustlineBanner: () => null }))
vi.mock('../Notification/NotificationBell', () => ({ default: () => null }))
vi.mock('../ShortcutsHelp', () => ({ ShortcutsHelp: () => null }))
vi.mock('../ToastViewport', () => ({ ToastViewport: () => null }))
vi.mock('../ThemeToggle', () => ({ default: () => null }))
vi.mock('../CommandPalette', () => ({ default: () => null }))
vi.mock('../../utils/useBreakpoint', () => ({ useBreakpoint: () => false }))

const initialOverflow = document.body.style.overflow

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  document.body.style.overflow = 'auto'
})

afterEach(() => {
  document.body.style.overflow = initialOverflow
  vi.restoreAllMocks()
})

function renderMobileLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Layout>
        <Routes>
          <Route path="/" element={<h1>Home page</h1>} />
          <Route path="/vaults" element={<h1>Vaults page</h1>} />
        </Routes>
      </Layout>
    </MemoryRouter>,
  )
}

function menuTrigger() {
  return screen.getByRole('button', { name: 'Open navigation menu' })
}

describe('MobileDrawer keyboard and focus interactions', () => {
  it('moves focus into the modal drawer, expands the trigger, and locks background scrolling', async () => {
    const user = userEvent.setup()
    renderMobileLayout()
    const trigger = menuTrigger()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()

    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls', 'mobile-drawer')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('id', 'mobile-drawer')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(document.body).toHaveStyle({ overflow: 'hidden' })

    // Layout makes the application background inert while modal navigation is open.
    expect(document.getElementById('main-content')).toHaveAttribute('inert')
    expect(document.getElementById('main-content')).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps focus inside the drawer when tabbing forward and backward', async () => {
    const user = userEvent.setup()
    renderMobileLayout()
    await user.click(menuTrigger())
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('Escape closes the drawer, clears aria-modal, restores scrolling, and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    renderMobileLayout()
    const trigger = menuTrigger()
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument())
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(document.body).toHaveStyle({ overflow: 'auto' })
    expect(document.getElementById('main-content')).not.toHaveAttribute('inert')
    expect(document.getElementById('main-content')).not.toHaveAttribute('aria-hidden')
  })

  it('selecting Vaults navigates and closes the drawer', async () => {
    const user = userEvent.setup()
    renderMobileLayout()
    const trigger = menuTrigger()
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    await user.click(within(dialog).getByRole('link', { name: 'Vaults' }))

    expect(await screen.findByRole('heading', { name: 'Vaults page' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.body).toHaveStyle({ overflow: 'auto' })
  })
})
