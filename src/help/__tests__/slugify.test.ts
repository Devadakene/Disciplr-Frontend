import { describe, it, expect } from 'vitest'
import { slugify, makeSlugContext } from '../utils/slugify'

describe('slugify', () => {
  it('lowercases the text', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('What happens on failure?')).toBe('what-happens-on-failure')
  })

  it('collapses multiple non-alphanumeric chars into one hyphen', () => {
    expect(slugify('A  --  B')).toBe('a-b')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello')
  })

  it('handles numbers', () => {
    expect(slugify('Step 1: Connect')).toBe('step-1-connect')
  })

  it('handles already-slugged strings idempotently', () => {
    expect(slugify('already-slugged')).toBe('already-slugged')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('handles special characters', () => {
    expect(slugify('USDC & XLM: What\'s the difference?')).toBe('usdc-xlm-what-s-the-difference')
  })
})

describe('makeSlugContext', () => {
  it('returns the base slug for the first occurrence', () => {
    const slug = makeSlugContext()
    expect(slug('Introduction')).toBe('introduction')
  })

  it('appends -2 for the second identical heading', () => {
    const slug = makeSlugContext()
    slug('Introduction')
    expect(slug('Introduction')).toBe('introduction-2')
  })

  it('appends -3 for the third identical heading', () => {
    const slug = makeSlugContext()
    slug('Introduction')
    slug('Introduction')
    expect(slug('Introduction')).toBe('introduction-3')
  })

  it('tracks duplicates independently per context', () => {
    const slugA = makeSlugContext()
    const slugB = makeSlugContext()
    slugA('Intro')
    expect(slugA('Intro')).toBe('intro-2')
    // A fresh context has no memory of the first context's duplicates.
    expect(slugB('Intro')).toBe('intro')
  })

  it('does not confuse distinct headings', () => {
    const slug = makeSlugContext()
    expect(slug('Overview')).toBe('overview')
    expect(slug('Details')).toBe('details')
    expect(slug('Overview')).toBe('overview-2')
    expect(slug('Details')).toBe('details-2')
  })
})
