import { describe, expect, it } from 'vitest';
import {
  classifyEvidenceUrl,
  EVIDENCE_BADGE_COLORS,
  hostMatches,
} from '../evidenceKind';
import type { EvidenceInfo, EvidenceKind } from '../evidenceKind';

describe('evidenceKind', () => {
  describe('EVIDENCE_BADGE_COLORS', () => {
    const ALL_KINDS: EvidenceKind[] = ['github', 'figma', 'ipfs', 'other'];

    it('defines a color for every EvidenceKind', () => {
      ALL_KINDS.forEach((kind) => {
        expect(EVIDENCE_BADGE_COLORS[kind]).toBeDefined();
        expect(EVIDENCE_BADGE_COLORS[kind]).not.toBe('');
      });
    });

    it('uses the correct GitHub brand hex', () => {
      expect(EVIDENCE_BADGE_COLORS.github).toBe('#24292e');
    });

    it('uses the correct Figma brand hex', () => {
      expect(EVIDENCE_BADGE_COLORS.figma).toBe('#f24e1e');
    });

    it('uses the correct IPFS brand hex', () => {
      expect(EVIDENCE_BADGE_COLORS.ipfs).toBe('#65c3cb');
    });

    it('uses a CSS variable for other (no single brand color)', () => {
      expect(EVIDENCE_BADGE_COLORS.other).toMatch(/^var\(/);
    });
  });

  describe('hostMatches', () => {
    it('matches exact domain and proper subdomains only', () => {
      expect(hostMatches('github.com', 'github.com')).toBe(true);
      expect(hostMatches('gist.github.com', 'github.com')).toBe(true);
      expect(hostMatches('notgithub.com', 'github.com')).toBe(false);
      expect(hostMatches('github.com.evil.io', 'github.com')).toBe(false);
      expect(hostMatches('github.com.', 'github.com')).toBe(false);
      expect(hostMatches('', 'github.com')).toBe(false);
    });
  });

  describe('classifyEvidenceUrl', () => {
    const urlTable: ReadonlyArray<[string, EvidenceInfo | null]> = [
      // Exact domains
      ['https://github.com/user/repo', { kind: 'github', host: 'github.com' }],
      ['https://figma.com/file/abc123', { kind: 'figma', host: 'figma.com' }],
      ['https://ipfs.io/ipfs/QmXoyp', { kind: 'ipfs', host: 'ipfs.io' }],
      ['https://dweb.link/ipfs/QmXoyp', { kind: 'ipfs', host: 'dweb.link' }],
      ['https://example.com/proof', { kind: 'other', host: 'example.com' }],

      // Subdomains (returns real subdomain host)
      ['https://gist.github.com/user/123', { kind: 'github', host: 'gist.github.com' }],
      ['https://raw.github.com/user/repo/main/README.md', { kind: 'github', host: 'raw.github.com' }],
      ['https://www.figma.com/file/abc123', { kind: 'figma', host: 'www.figma.com' }],
      ['https://gateway.ipfs.io/ipfs/QmXoyp', { kind: 'ipfs', host: 'gateway.ipfs.io' }],
      [
        'https://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi.ipfs.dweb.link/proof.pdf',
        {
          kind: 'ipfs',
          host: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi.ipfs.dweb.link',
        },
      ],

      // Look-alike / spoofing hosts
      ['https://github.com.evil.io/x', { kind: 'other', host: 'github.com.evil.io' }],
      ['https://notgithub.com/x', { kind: 'other', host: 'notgithub.com' }],
      ['https://my-github.com/org/repo', { kind: 'other', host: 'my-github.com' }],
      ['https://figma.com.attacker.example/file/1', { kind: 'other', host: 'figma.com.attacker.example' }],
      ['https://notfigma.com/file/1', { kind: 'other', host: 'notfigma.com' }],
      ['https://myipfs-phish.net/ipfs/QmXoyp', { kind: 'other', host: 'myipfs-phish.net' }],
      ['https://ipfs.io.evil.com/ipfs/QmXoyp', { kind: 'other', host: 'ipfs.io.evil.com' }],
      ['https://dweb.link.evil.com/ipfs/QmXoyp', { kind: 'other', host: 'dweb.link.evil.com' }],

      // Uppercase hosts
      ['https://GitHub.COM/user/repo', { kind: 'github', host: 'github.com' }],
      ['https://GIST.GITHUB.COM/user/1', { kind: 'github', host: 'gist.github.com' }],
      ['https://WWW.FIGMA.COM/file/abc', { kind: 'figma', host: 'www.figma.com' }],
      ['https://IPFS.IO/ipfs/QmXoyp', { kind: 'ipfs', host: 'ipfs.io' }],

      // Trailing dots
      ['https://github.com./user/repo', { kind: 'other', host: 'github.com.' }],
      ['https://figma.com./file/abc', { kind: 'other', host: 'figma.com.' }],
      ['https://ipfs.io./ipfs/QmXoyp', { kind: 'other', host: 'ipfs.io.' }],

      // Punycode / IDN hosts
      ['https://xn--githb-xxx.com/x', { kind: 'other', host: 'xn--githb-xxx.com' }],
      ['https://xn--sb-xka.github.com/x', { kind: 'other', host: 'xn--sb-xka.github.com' }],
      ['https://xn--figm-qoa.com/x', { kind: 'other', host: 'xn--figm-qoa.com' }],

      // Ports
      ['https://github.com:443/user/repo', { kind: 'github', host: 'github.com' }],
      ['https://gist.github.com:8443/user/1', { kind: 'github', host: 'gist.github.com' }],
      ['https://ipfs.io:8080/ipfs/QmXoyp', { kind: 'ipfs', host: 'ipfs.io' }],

      // Userinfo (rejected upstream by normalizeEvidenceUrl)
      ['https://github.com@evil.com/x', null],
      ['https://user:pass@github.com/user/repo', null],
      ['https://%61:%62@figma.com/file/abc', null],

      // Non-http(s) IPFS and unsafe / invalid URLs
      ['ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco', null],
      ['javascript:alert(1)', null],
      ['not-a-valid-url', null],
      ['', null],
    ];

    it.each(urlTable)('classifies %s as %j', (url, expected) => {
      expect(classifyEvidenceUrl(url)).toEqual(expected);
    });
  });
});
