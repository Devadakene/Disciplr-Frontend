/**
 * Validates if a URL is safe to render as a link.
 * Only allows http and https schemes.
 * Rejects javascript:, data:, and other potentially dangerous schemes.
 */
export function normalizeEvidenceUrl(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  // Reject raw control characters (including newlines/tabs) that some
  // renderers mishandle. Allow percent-encoded control bytes (e.g. %0A).
  // Matching raw control bytes is intentional here, hence the rule override.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    // Reject userinfo-bearing URLs (e.g. https://trusted.com@evil.com or
    // https://user:pass@host). This includes credentials provided percent-
    // encoded; the URL parser exposes them on `username`/`password`.
    if (parsed.username || parsed.password) {
      return null
    }
    return trimmed
  } catch {
    return null
  }
}

export function isSafeEvidenceUrl(value: string): boolean {
  return normalizeEvidenceUrl(value) !== null
}
