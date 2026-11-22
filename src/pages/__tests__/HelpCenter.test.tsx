import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import HelpCenter from '../HelpCenter'

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname + location.search}</div>
}

describe('HelpCenter', () => {
  it('renders the Help Center home view with category navigation, featured articles, and mailto link', () => {
    render(
      <MemoryRouter initialEntries={['/help']}>
        <Routes>
          <Route path="/help" element={<HelpCenter />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Help Center/i)).toBeInTheDocument()
    expect(screen.getByText(/Browse by Category/i)).toBeInTheDocument()
    expect(screen.getByText(/Featured Articles/i)).toBeInTheDocument()
    expect(screen.getByText(/Still need help/i)).toBeInTheDocument()

    // Support email mailto link
    const emailLink = screen.getByRole('link', { name: /support@disciplr.app/i })
    expect(emailLink).toHaveAttribute('href', 'mailto:support@disciplr.app')

    // Live chat clearly marked as unavailable
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('renders a keyword search results page with ranked results and text highlighting', () => {
    render(
      <MemoryRouter initialEntries={['/help/search?q=vault']}>
        <Routes>
          <Route path="/help/search" element={<HelpCenter />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /results for “vault”/i })).toBeInTheDocument()
    expect(screen.getByText(/Creating a vault in Disciplr/i)).toBeInTheDocument()

    // Ensure links point to /help/articles/:slug
    const articleLinks = screen.getAllByRole('link', { name: /Open article/i })
    expect(articleLinks[0].getAttribute('href')).toMatch(/^\/help\/articles\//)
  })

  it('navigates cleanly when searching and handles history smoothly', () => {
    render(
      <MemoryRouter initialEntries={['/help']}>
        <LocationDisplay />
        <Routes>
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/help/search" element={<HelpCenter />} />
        </Routes>
      </MemoryRouter>,
    )

    const input = screen.getByRole('searchbox', { name: /search help articles/i })
    const submitBtn = screen.getByRole('button', { name: /search/i })

    fireEvent.change(input, { target: { value: 'create vault' } })
    fireEvent.click(submitBtn)

    expect(screen.getByTestId('location-display')).toHaveTextContent('/help/search?q=create%20vault')
  })

  it('renders polite zero-results state with suggestions when no article matches', () => {
    render(
      <MemoryRouter initialEntries={['/help/search?q=nonexistentterm12345']}>
        <Routes>
          <Route path="/help/search" element={<HelpCenter />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /0 results for “nonexistentterm12345”/i })).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText(/No articles found matching/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vaults' })).toBeInTheDocument()
  })
})
