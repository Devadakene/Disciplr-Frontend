import { describe, expect, it } from 'vitest'
import { normalise, tokenise, searchArticles } from '../search'
import { HelpArticle } from '../types'

describe('Help search module', () => {
  const sampleArticles: HelpArticle[] = [
    {
      slug: 'creating-a-vault',
      title: 'Creating a vault in Disciplr',
      category: 'Vaults',
      summary: 'Learn how to set a target deposit amount and configure challenge duration.',
      keywords: ['create', 'vault', 'steps', 'target'],
      body: 'Detailed instructions on creating a vault, locking collateral, and verifying.',
      related: ['choosing-destinations'],
      updatedAt: '2026-03-15',
    },
    {
      slug: 'choosing-destinations',
      title: 'Choosing success and failure destinations',
      category: 'Vaults',
      summary: 'Configure where staked funds go upon completion.',
      keywords: ['destinations', 'success', 'failure'],
      body: 'When you create a milestone, you choose where funds go.',
      related: ['creating-a-vault'],
      updatedAt: '2026-03-15',
    },
    {
      slug: 'the-network-mismatch-banner',
      title: 'Resolving the network mismatch banner',
      category: 'Wallets',
      summary: 'Fix RPC and chain ID discrepancies between your wallet and Disciplr.',
      keywords: ['network', 'mismatch', 'banner', 'wallet'],
      body: 'If you see the network mismatch banner, switch your wallet network.',
      related: [],
      updatedAt: '2026-03-15',
    },
  ]

  it('normalises strings: lowercases, strips accents, removes punctuation', () => {
    expect(normalise('Créate, Vault!!')).toBe('create vault')
    expect(normalise('   Stéllar   Network...   ')).toBe('stellar network')
  })

  it('tokenises and drops stop-words', () => {
    const tokens = tokenise('create a vault and lock with the funds')
    expect(tokens).toEqual(['create', 'vault', 'lock', 'funds'])
  })

  it('handles diacritics and case-insensitivity seamlessly in search', () => {
    const res1 = searchArticles(sampleArticles, 'create vault')
    const res2 = searchArticles(sampleArticles, 'Vault Create')
    const res3 = searchArticles(sampleArticles, 'créate vault')

    expect(res1.length).toBeGreaterThan(0)
    expect(res1[0].article.slug).toBe('creating-a-vault')

    expect(res2.length).toBeGreaterThan(0)
    expect(res2[0].article.slug).toBe('creating-a-vault')

    expect(res3.length).toBeGreaterThan(0)
    expect(res3[0].article.slug).toBe('creating-a-vault')
  })

  it('enforces AND semantics (all tokens must match)', () => {
    // "mismatch" is only in network-mismatch-banner, "vault" is in creating-a-vault
    const results = searchArticles(sampleArticles, 'vault mismatch nonexistentterm')
    expect(results).toHaveLength(0)
  })

  it('ranks higher when matches are in title compared to body only', () => {
    const results = searchArticles(sampleArticles, 'destinations')
    expect(results[0].article.slug).toBe('choosing-destinations')
  })

  it('supports prefix matching', () => {
    const results = searchArticles(sampleArticles, 'destinat')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].article.slug).toBe('choosing-destinations')
  })

  it('safely handles regex-special characters in queries without crashing', () => {
    expect(() => {
      searchArticles(sampleArticles, 'vault (.*+?^${}|[]\\)')
    }).not.toThrow()
  })

  it('returns all articles when query is empty', () => {
    const results = searchArticles(sampleArticles, '')
    expect(results).toHaveLength(sampleArticles.length)
  })

  it('safely handles 500-char queries without hanging', () => {
    const longQuery = 'vault '.repeat(100)
    expect(() => {
      const results = searchArticles(sampleArticles, longQuery)
      expect(results.length).toBeGreaterThan(0)
    }).not.toThrow()
  })
})
