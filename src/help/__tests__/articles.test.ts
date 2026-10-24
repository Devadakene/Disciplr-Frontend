import { describe, expect, it } from 'vitest'
import { articles, articleMap } from '../articles'

describe('Help articles content integrity', () => {
  it('contains at least 8 real articles', () => {
    expect(articles.length).toBeGreaterThanOrEqual(8)
  })

  it('every article has a unique slug', () => {
    const slugs = articles.map((a) => a.slug)
    const uniqueSlugs = new Set(slugs)
    expect(slugs.length).toBe(uniqueSlugs.size)
  })

  it('every article has non-empty fields (title, summary, body, category, updatedAt)', () => {
    for (const article of articles) {
      expect(article.slug).toBeTruthy()
      expect(article.title.trim().length).toBeGreaterThan(0)
      expect(article.category.trim().length).toBeGreaterThan(0)
      expect(article.summary.trim().length).toBeGreaterThan(0)
      expect(article.body.trim().length).toBeGreaterThan(20)
      expect(article.updatedAt.trim().length).toBeGreaterThan(0)
    }
  })

  it('every related slug corresponds to an existing article', () => {
    for (const article of articles) {
      for (const relSlug of article.related) {
        expect(articleMap[relSlug], `Related article ${relSlug} in ${article.slug} must exist`).toBeDefined()
      }
    }
  })
})
