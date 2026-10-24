import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
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
})
