import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import HelpArticle from '../HelpArticle'

describe('HelpArticle Page', () => {
  it('renders full article content, breadcrumbs, and feedback widget for valid slug', () => {
    render(
      <MemoryRouter initialEntries={['/help/articles/creating-a-vault']}>
        <Routes>
          <Route path="/help/articles/:slug" element={<HelpArticle />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /Creating a vault in Disciplr/i })).toBeInTheDocument()
    expect(screen.getByText(/Connect Your Stellar Wallet/i)).toBeInTheDocument()
    expect(screen.getByText(/Was this article helpful\?/i)).toBeInTheDocument()
    expect(screen.getByText(/Related Articles/i)).toBeInTheDocument()
  })

  it('renders NotFound component for unknown slug', () => {
    render(
      <MemoryRouter initialEntries={['/help/articles/non-existent-article-slug']}>
        <Routes>
          <Route path="/help/articles/:slug" element={<HelpArticle />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /404/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Page Not Found/i })).toBeInTheDocument()
  })

  it('shows TOC when article has two or more ## headings', () => {
    render(
      <MemoryRouter initialEntries={['/help/articles/how-verification-works']}>
        <Routes>
          <Route path="/help/articles/:slug" element={<HelpArticle />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('navigation', { name: /on this page/i })).toBeInTheDocument()
  })

  it('does not show TOC for articles with fewer than two ## headings', () => {
    render(
      <MemoryRouter initialEntries={['/help/articles/usdc-trustlines']}>
        <Routes>
          <Route path="/help/articles/:slug" element={<HelpArticle />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('navigation', { name: /on this page/i })).toBeNull()
  })

  it('TOC links move focus to the target heading on click', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/help/articles/how-verification-works']}>
        <Routes>
          <Route path="/help/articles/:slug" element={<HelpArticle />} />
        </Routes>
      </MemoryRouter>,
    )

    const toc = screen.getByRole('navigation', { name: /on this page/i })
    const firstLink = toc.querySelector('a')
    expect(firstLink).not.toBeNull()

    // Spy on the heading's focus method.
    const headingId = firstLink!.getAttribute('href')!.slice(1)
    const heading = document.getElementById(headingId)
    expect(heading).not.toBeNull()
    const focusSpy = vi.spyOn(heading!, 'focus')

    await user.click(firstLink!)
    expect(focusSpy).toHaveBeenCalled()
  })
})
