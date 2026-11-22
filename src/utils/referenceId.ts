/**
 * Reference ID generation for user-facing error reports.
 *
 * `crypto.randomUUID()` is only defined in secure contexts, so on a plain-HTTP
 * LAN preview (or older Safari) it is either missing or throws. A reference ID
 * is a support correlation token, never a secret, so a weaker source of
 * randomness is acceptable — failing to produce one is not: the error path
 * itself must not crash while rendering the "Something went wrong" screen.
 *
 * Fallback order:
 *   1. `crypto.randomUUID()` — 122 bits of CSPRNG entropy.
 *   2. `crypto.getRandomValues()` — 128 bits, formatted as hex.
 *   3. `Date.now()` + `Math.random()` — always available, still unique enough
 *      to correlate a support conversation.
 */
export function createReferenceId(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoApi) {
    try {
      if (typeof cryptoApi.randomUUID === 'function') {
        return cryptoApi.randomUUID();
      }
    } catch {
      // Present but unusable (non-secure context) — try the next source.
    }

    try {
      if (typeof cryptoApi.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        cryptoApi.getRandomValues(bytes);
        let hex = '';
        for (const byte of bytes) {
          hex += byte.toString(16).padStart(2, '0');
        }
        return hex;
      }
    } catch {
      // Unusable — fall through to the timestamp source.
    }
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
