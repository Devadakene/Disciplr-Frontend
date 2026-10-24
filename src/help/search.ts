import { HelpArticle } from './types'

export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with',
])

export interface SearchResult {
  article: HelpArticle
  score: number
  matchedTokens: string[]
}

/**
 * Normalises a string:
 * - Converts to lower-case
 * - Strips diacritics / accents (e.g., créate -> create)
 * - Replaces non-alphanumeric punctuation with whitespace
 * - Trims redundant whitespace
 */
export function normalise(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Tokenises normalized text and removes stop-words.
 */
export function tokenise(text: string): string[] {
  const norm = normalise(text)
  if (!norm) return []
  return norm
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Weights per field
const WEIGHT_TITLE = 100
const WEIGHT_KEYWORDS = 50
const WEIGHT_SUMMARY = 20
const WEIGHT_BODY = 5

// Exact match vs prefix match bonus
const EXACT_MATCH_MULTIPLIER = 2.0
const PREFIX_MATCH_MULTIPLIER = 1.0

function scoreField(fieldNorm: string, fieldTokens: string[], token: string, baseWeight: number): number {
  if (!fieldNorm || !token) return 0

  let score = 0
  for (const fToken of fieldTokens) {
    if (fToken === token) {
      score = Math.max(score, baseWeight * EXACT_MATCH_MULTIPLIER)
    } else if (fToken.startsWith(token)) {
      score = Math.max(score, baseWeight * PREFIX_MATCH_MULTIPLIER)
    }
  }

  // Also check if field contains the token directly as substring (e.g. compound words or partials)
  if (score === 0 && fieldNorm.includes(token)) {
    score = baseWeight * 0.5
  }

  return score
}

/**
 * Searches a list of articles using ranked multi-term AND search.
 * - Truncates very long queries to 200 chars.
 * - Empty query returns all articles with score 0.
 * - Requires every query token to match at least one field in the article (AND semantics).
 * - Ranks by field weights: title > keywords > summary > body, with exact/prefix bonuses.
 */
export function searchArticles(articles: HelpArticle[], rawQuery: string): SearchResult[] {
  if (!rawQuery || !rawQuery.trim()) {
    return articles.map((article) => ({
      article,
      score: 0,
      matchedTokens: [],
    }))
  }

  // Truncate long queries (e.g. 200 chars) before tokenisation to keep search bounded O(n)
  const truncatedQuery = rawQuery.slice(0, 200)
  const queryTokens = tokenise(truncatedQuery)

  if (queryTokens.length === 0) {
    return articles.map((article) => ({
      article,
      score: 0,
      matchedTokens: [],
    }))
  }

  const results: SearchResult[] = []

  for (const article of articles) {
    const titleNorm = normalise(article.title)
    const titleTokens = tokenise(article.title)

    const keywordsNorm = normalise(article.keywords.join(' '))
    const keywordsTokens = tokenise(article.keywords.join(' '))

    const summaryNorm = normalise(article.summary)
    const summaryTokens = tokenise(article.summary)

    const bodyNorm = normalise(article.body)
    const bodyTokens = tokenise(article.body)

    let articleTotalScore = 0
    let matchesAllTokens = true

    for (const qToken of queryTokens) {
      const sTitle = scoreField(titleNorm, titleTokens, qToken, WEIGHT_TITLE)
      const sKeywords = scoreField(keywordsNorm, keywordsTokens, qToken, WEIGHT_KEYWORDS)
      const sSummary = scoreField(summaryNorm, summaryTokens, qToken, WEIGHT_SUMMARY)
      const sBody = scoreField(bodyNorm, bodyTokens, qToken, WEIGHT_BODY)

      const tokenScore = sTitle + sKeywords + sSummary + sBody

      if (tokenScore === 0) {
        matchesAllTokens = false
        break
      }

      articleTotalScore += tokenScore
    }

    if (matchesAllTokens) {
      results.push({
        article,
        score: articleTotalScore,
        matchedTokens: queryTokens,
      })
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score)
  return results
}
