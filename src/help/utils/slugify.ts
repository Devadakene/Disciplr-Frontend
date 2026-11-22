/**
 * Convert a heading string to a deterministic, URL-safe slug.
 *
 * Rules:
 * - Lowercase everything.
 * - Replace any run of non-alphanumeric characters with a single hyphen.
 * - Trim leading/trailing hyphens.
 *
 * Duplicate tracking is handled by the caller via `slugify.withContext()`.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Returns a stateful slugifier that appends -2, -3, … to duplicates.
 * Create one context per document render; never share across documents.
 *
 * @example
 * const slug = makeSlugContext()
 * slug('Intro')   // 'intro'
 * slug('Intro')   // 'intro-2'
 * slug('Intro')   // 'intro-3'
 */
export function makeSlugContext(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text: string): string => {
    const base = slugify(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  }
}
