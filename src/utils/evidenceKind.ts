import { normalizeEvidenceUrl } from './url';

export type EvidenceKind = 'github' | 'figma' | 'ipfs' | 'other';

/**
 * Brand colors for evidence-source badge UI.
 * Each value is the hex color for the source's brand mark.
 * The `other` entry uses a CSS variable because there is no single brand color.
 *
 * Usage:
 *   background: `color-mix(in srgb, ${EVIDENCE_BADGE_COLORS[kind]} 10%, transparent)`
 *   color:       EVIDENCE_BADGE_COLORS[kind]
 */
export const EVIDENCE_BADGE_COLORS: Record<EvidenceKind, string> = {
  github: '#24292e',
  figma: '#f24e1e',
  ipfs: '#65c3cb',
  other: 'var(--muted)',
};

export interface EvidenceInfo {
  kind: EvidenceKind;
  host: string;
}

const IPFS_GATEWAY_HOSTS = ['ipfs.io', 'dweb.link'] as const;

export function hostMatches(host: string, domain: string): boolean {
  const normalizedHost = host.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  if (!normalizedHost || !normalizedDomain) {
    return false;
  }
  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  );
}

function hasPunycodeLabel(host: string): boolean {
  return host.split('.').some((label) => label.startsWith('xn--'));
}

export function classifyEvidenceUrl(url: string): EvidenceInfo | null {
  const normalized = normalizeEvidenceUrl(url);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!host) {
      return null;
    }

    if (hasPunycodeLabel(host)) {
      return { kind: 'other', host };
    }

    if (hostMatches(host, 'github.com')) {
      return { kind: 'github', host };
    }

    if (hostMatches(host, 'figma.com')) {
      return { kind: 'figma', host };
    }

    if (IPFS_GATEWAY_HOSTS.some((gateway) => hostMatches(host, gateway))) {
      return { kind: 'ipfs', host };
    }

    return { kind: 'other', host };
  } catch {
    return null;
  }
}

