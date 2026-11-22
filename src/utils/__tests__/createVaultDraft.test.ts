// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CREATE_VAULT_DRAFT_MAX_BYTES,
  CREATE_VAULT_DRAFT_PREFIX,
  CREATE_VAULT_DRAFT_TTL_MS,
  CREATE_VAULT_DRAFT_VERSION,
  clearDraft,
  createVaultDraft,
  getCreateVaultDraftKey,
  readDraft,
  writeDraft,
  type CreateVaultDraftValues,
} from '../createVaultDraft';

const OWNER = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const OTHER = 'GABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEJXA';
const NOW = 1_700_000_000_000;

const values = (): CreateVaultDraftValues => ({
  amount: '100',
  deadline: '2030-01-01T12:00',
  successAddress: 'GACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAJJHP',
  failureAddress: 'GABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQHGPC',
  milestones: [
    { title: 'Design approved', criteria: 'Signed approval' },
    { title: 'Code shipped', criteria: 'Merged PR' },
  ],
  evidenceUrl: 'https://example.com/proof',
});

const rawKey = (owner: string): string => {
  const key = getCreateVaultDraftKey(owner);
  if (!key) throw new Error('expected a key');
  return key;
};

describe('createVaultDraft storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a draft per wallet address', () => {
    writeDraft(OWNER, createVaultDraft(values(), NOW));

    expect(readDraft(OWNER, NOW)).toEqual({
      v: CREATE_VAULT_DRAFT_VERSION,
      savedAt: NOW,
      ...values(),
    });
  });

  it('namespaces the storage key with the draft prefix and wallet address', () => {
    expect(getCreateVaultDraftKey(OWNER)).toBe(`${CREATE_VAULT_DRAFT_PREFIX}${OWNER}`);

    writeDraft(OWNER, createVaultDraft(values(), NOW));
    expect(window.localStorage.key(0)).toBe(`${CREATE_VAULT_DRAFT_PREFIX}${OWNER}`);
  });

  it("never exposes one wallet's draft to another", () => {
    writeDraft(OWNER, createVaultDraft(values(), NOW));

    expect(readDraft(OTHER, NOW)).toBeNull();
    expect(readDraft(OWNER, NOW)).not.toBeNull();
  });

  it('ignores a missing owner key instead of using a shared key', () => {
    expect(getCreateVaultDraftKey(undefined)).toBeNull();
    expect(getCreateVaultDraftKey('   ')).toBeNull();
    expect(writeDraft(undefined, createVaultDraft(values(), NOW))).toBe(false);
    expect(readDraft(null, NOW)).toBeNull();
    clearDraft(undefined);

    expect(window.localStorage.length).toBe(0);
  });

  it('discards a draft written by a different payload version', () => {
    const key = rawKey(OWNER);
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...createVaultDraft(values(), NOW), v: 2 }),
    );

    expect(readDraft(OWNER, NOW)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('keeps a fresh draft and discards one past its TTL', () => {
    writeDraft(OWNER, createVaultDraft(values(), NOW));
    expect(readDraft(OWNER, NOW + CREATE_VAULT_DRAFT_TTL_MS - 1)).not.toBeNull();

    writeDraft(OWNER, createVaultDraft(values(), NOW));
    expect(readDraft(OWNER, NOW + CREATE_VAULT_DRAFT_TTL_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(rawKey(OWNER))).toBeNull();
  });

  it('discards malformed JSON and malformed shapes', () => {
    const key = rawKey(OWNER);

    window.localStorage.setItem(key, '{not json');
    expect(readDraft(OWNER, NOW)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...createVaultDraft(values(), NOW), milestones: 'nope' }),
    );
    expect(readDraft(OWNER, NOW)).toBeNull();

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...createVaultDraft(values(), NOW), amount: 42 }),
    );
    expect(readDraft(OWNER, NOW)).toBeNull();

    window.localStorage.setItem(key, JSON.stringify(['not', 'a', 'draft']));
    expect(readDraft(OWNER, NOW)).toBeNull();
  });

  it('rejects oversized payloads on write and on read', () => {
    const huge = values();
    huge.milestones = [{ title: 'a'.repeat(60_000), criteria: 'b' }];

    expect(writeDraft(OWNER, createVaultDraft(huge, NOW))).toBe(false);
    expect(window.localStorage.length).toBe(0);

    const key = rawKey(OWNER);
    window.localStorage.setItem(key, JSON.stringify(createVaultDraft(huge, NOW)));
    expect(
      window.localStorage.getItem(key)!.length,
    ).toBeGreaterThan(CREATE_VAULT_DRAFT_MAX_BYTES);
    expect(readDraft(OWNER, NOW)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('clears a wallet draft', () => {
    writeDraft(OWNER, createVaultDraft(values(), NOW));
    clearDraft(OWNER);

    expect(readDraft(OWNER, NOW)).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it('falls back safely when storage throws (quota / private mode)', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readDraft(OWNER, NOW)).toBeNull();
    expect(writeDraft(OWNER, createVaultDraft(values(), NOW))).toBe(false);
    expect(() => clearDraft(OWNER)).not.toThrow();
  });
});
