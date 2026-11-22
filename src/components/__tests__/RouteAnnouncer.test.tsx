import { act, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOCUMENT_TITLE_EVENT } from '../../hooks/useDocumentTitle'
import { formatDocumentTitle, getRouteTitle } from '../../routes/titles'
import RouteAnnouncer from '../RouteAnnouncer'

function NavButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)}>
      {label}
    </button>
  )
}

function renderAnnouncer(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RouteAnnouncer />
      <Link to="/vaults">Go to Vaults</Link>
      <NavButton to="/dashboard" label="Navigate to Dashboard" />
      <NavButton to="/vaults/42" label="Navigate to Vault Detail" />
    </MemoryRouter>,
  )
}

afterEach(() => {
  document.title = ''
  vi.restoreAllMocks()
})

describe('RouteAnnouncer', () => {
  it('renders a polite, atomic live region', () => {
    const { container } = renderAnnouncer('/')
    const liveRegion = container.querySelector('[aria-live]')

    expect(liveRegion).not.toBeNull()
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    expect(liveRegion).toHaveClass('visually-hidden')
  })

  it('sets document.title on first render while keeping the live region empty', () => {
    const { container } = renderAnnouncer('/')
    const liveRegion = container.querySelector('[aria-live]')

    expect(document.title).toBe(formatDocumentTitle(getRouteTitle('/')))
    expect(liveRegion).toHaveTextContent('')
  })

  it('announces the formatted route title after navigating via link or useNavigate', () => {
    const { container } = renderAnnouncer('/')
    const liveRegion = container.querySelector('[aria-live]')

    expect(liveRegion).toHaveTextContent('')

    act(() => {
      fireEvent.click(screen.getByRole('link', { name: 'Go to Vaults' }))
    })

    const vaultsTitle = formatDocumentTitle(getRouteTitle('/vaults'))
    expect(document.title).toBe(vaultsTitle)
    expect(liveRegion).toContainElement(screen.getByText(vaultsTitle))
    expect(liveRegion).toHaveTextContent(vaultsTitle)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Navigate to Dashboard' }))
    })

    const dashboardTitle = formatDocumentTitle(getRouteTitle('/dashboard'))
    expect(document.title).toBe(dashboardTitle)
    expect(liveRegion).toHaveTextContent(dashboardTitle)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Navigate to Vault Detail' }))
    })

    const vaultDetailTitle = formatDocumentTitle(getRouteTitle('/vaults/42'))
    expect(document.title).toBe(vaultDetailTitle)
    expect(liveRegion).toHaveTextContent(vaultDetailTitle)
  })

  it('re-announces document.title when DOCUMENT_TITLE_EVENT is dispatched', () => {
    const { container } = renderAnnouncer('/')
    const liveRegion = container.querySelector('[aria-live]')

    expect(liveRegion).toHaveTextContent('')

    act(() => {
      document.title = 'Custom Vault · Disciplr'
      window.dispatchEvent(new Event(DOCUMENT_TITLE_EVENT))
    })

    expect(liveRegion).toHaveTextContent('Custom Vault · Disciplr')
  })

  it('cleans up the window DOCUMENT_TITLE_EVENT listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderAnnouncer('/')

    const addedCall = addSpy.mock.calls.find(([event]) => event === DOCUMENT_TITLE_EVENT)
    expect(addedCall).toBeDefined()
    const handler = addedCall?.[1]

    unmount()

    expect(removeSpy).toHaveBeenCalledWith(DOCUMENT_TITLE_EVENT, handler)
  })
})
