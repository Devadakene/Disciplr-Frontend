import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getArticleBySlug } from '../help/articles'
import { SafeMarkdown } from '../help/components/SafeMarkdown'
import NotFound from './NotFound'

export default function HelpArticle() {
  const { slug } = useParams<{ slug: string }>()
  const article = slug ? getArticleBySlug(slug) : undefined
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null)

  if (!article) {
    return <NotFound />
  }

  const relatedArticles = article.related
    .map((rSlug) => getArticleBySlug(rSlug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))

  return (
    <div style={{ display: 'grid', gap: '2rem', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
        <Link to="/help" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
          Help Center
        </Link>
        <span style={{ color: 'var(--muted)' }}>/</span>
        <Link
          to={`/help/search?q=${encodeURIComponent(article.category.toLowerCase())}`}
          style={{ color: 'var(--muted)', textDecoration: 'none' }}
        >
          {article.category}
        </Link>
        <span style={{ color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{article.title}</span>
      </nav>

      {/* Article Header & Body */}
      <article
        style={{
          padding: '2rem',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface)',
          display: 'grid',
          gap: '1.25rem',
        }}
      >
        <header style={{ display: 'grid', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--accent)',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {article.category}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Updated {article.updatedAt}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--text)' }}>{article.title}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1.05rem', lineHeight: 1.5 }}>{article.summary}</p>
        </header>

        <div style={{ color: 'var(--text)', fontSize: '1rem' }}>
          <SafeMarkdown content={article.body} />
        </div>

        {/* Was this helpful? Section */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Was this article helpful?</span>
          {feedbackGiven ? (
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Thank you for your feedback!
            </span>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setFeedbackGiven('yes')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setFeedbackGiven('no')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                No
              </button>
            </div>
          )}
        </div>
      </article>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <section style={{ display: 'grid', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Related Articles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {relatedArticles.map((rel) => (
              <div
                key={rel.slug}
                style={{
                  padding: '1.25rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)',
                  display: 'grid',
                  gap: '0.5rem',
                }}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.75rem' }}>{rel.category}</span>
                <Link
                  to={`/help/articles/${rel.slug}`}
                  style={{
                    color: 'var(--text)',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                  }}
                >
                  {rel.title}
                </Link>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.4 }}>{rel.summary}</p>
                <Link
                  to={`/help/articles/${rel.slug}`}
                  style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem', marginTop: '0.25rem' }}
                >
                  Open article &rarr;
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Back to Help Center */}
      <div style={{ paddingBottom: '2rem' }}>
        <Link to="/help" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          &larr; Back to Help Center
        </Link>
      </div>
    </div>
  )
}
