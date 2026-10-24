import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { articles } from '../help/articles'
import { searchArticles } from '../help/search'
import { HighlightText } from '../help/components/HighlightText'

const categories = [
  { label: 'Vaults', description: 'Create, manage, and monitor vault activity.' },
  { label: 'Wallets', description: 'Understand network mismatches and wallet setup.' },
  { label: 'Verifier', description: 'Review pending validations and approvals.' },
]

const supportOptions = [
  {
    title: 'Live Chat',
    detail: 'Live chat support is currently unavailable. Please reach out via email or Discord.',
    status: 'Unavailable',
  },
  {
    title: 'Email',
    detail: 'support@disciplr.app',
    href: 'mailto:support@disciplr.app',
  },
  {
    title: 'Community Forum',
    detail: 'Join the Disciplr Discord and discuss setup or troubleshooting.',
    href: 'https://discord.gg/disciplr',
  },
]

export default function HelpCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const query = searchParams.get('q')?.trim() ?? ''
  const [draftQuery, setDraftQuery] = useState(query)

  useEffect(() => {
    setDraftQuery(query)
  }, [query])

  const searchResults = useMemo(() => {
    return searchArticles(articles, query)
  }, [query])

  const featuredArticles = articles.slice(0, 3)
  const searchResultsCount = searchResults.length

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextQuery = draftQuery.trim()

    if (location.pathname === '/help/search') {
      if (nextQuery) {
        setSearchParams({ q: nextQuery })
      } else {
        navigate('/help')
      }
    } else {
      if (nextQuery) {
        navigate(`/help/search?q=${encodeURIComponent(nextQuery)}`)
      } else {
        navigate('/help')
      }
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <div style={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontSize: '0.75rem', fontWeight: 700 }}>
              Help Center
            </div>
            <h1 style={{ margin: '0.35rem 0 0.45rem', fontSize: '1.9rem' }}>Get unstuck with fast answers</h1>
            <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '760px' }}>
              Explore guides and technical documentation for vault setup, wallet troubleshooting, verification workflows, and smart contract mechanics.
            </p>
          </div>

          <form onSubmit={submitSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search help articles"
              aria-label="Search help articles"
              style={{
                flex: '1 1 260px',
                minWidth: 0,
                padding: '0.75rem 0.9rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Categories section */}
      <section style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Browse by Category</h2>
          <Link to="/help/search?q=vault" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
            Open search results
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {categories.map((category) => (
            <Link
              key={category.label}
              to={`/help/search?q=${encodeURIComponent(category.label.toLowerCase())}`}
              style={{
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{category.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{category.description}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Articles section */}
      <section style={{ display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Featured Articles</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {featuredArticles.map((article) => (
            <article
              key={article.slug}
              style={{
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                display: 'grid',
                gap: '0.6rem',
              }}
            >
              <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.8rem' }}>{article.category}</div>
              <div style={{ fontWeight: 700 }}>{article.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{article.summary}</div>
              <Link to={`/help/articles/${article.slug}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
                Open article
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Search results or empty state when query is present */}
      {query ? (
        <section style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }} aria-live="polite">
              {searchResultsCount} result{searchResultsCount === 1 ? '' : 's'} for “{query}”
            </h2>
            <Link to="/help" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
              Back to Help Center home
            </Link>
          </div>

          {searchResultsCount === 0 ? (
            <div
              style={{
                padding: '2rem',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                display: 'grid',
                gap: '1rem',
                textAlign: 'center',
                justifyItems: 'center',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>No articles found matching “{query}”</div>
              <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '500px' }}>
                We couldn't find any articles with all your search terms. Try checking your spelling or explore one of these popular categories:
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                {categories.map((cat) => (
                  <Link
                    key={cat.label}
                    to={`/help/search?q=${encodeURIComponent(cat.label.toLowerCase())}`}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--accent)',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {searchResults.map(({ article }) => (
                <article
                  key={article.slug}
                  style={{
                    padding: '1.25rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface)',
                    display: 'grid',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.8rem' }}>{article.category}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                    <HighlightText text={article.title} query={query} />
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                    <HighlightText text={article.summary} query={query} />
                  </div>
                  <div style={{ marginTop: '0.35rem' }}>
                    <Link to={`/help/articles/${article.slug}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
                      Open article
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Support section */}
      <section style={{ display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Still need help?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {supportOptions.map((support) => (
            <div
              key={support.title}
              style={{
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface)',
                display: 'grid',
                gap: '0.3rem',
                opacity: support.status === 'Unavailable' ? 0.75 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700 }}>{support.title}</span>
                {support.status && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-sm, 4px)',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--muted)',
                    }}
                  >
                    {support.status}
                  </span>
                )}
              </div>
              {support.href ? (
                <a
                  href={support.href}
                  style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.88rem', wordBreak: 'break-all' }}
                >
                  {support.detail}
                </a>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{support.detail}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
