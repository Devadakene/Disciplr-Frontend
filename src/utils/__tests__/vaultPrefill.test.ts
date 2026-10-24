import { describe, expect, it } from 'vitest';
import {
  createVaultPrefillFromVault,
  getCreateVaultPrefill,
} from '../vaultPrefill';
import type { Vault } from '../../types/vault';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const BASE_VAULT: Vault = {
  id: 'vault-1',
  name: 'My Test Vault',
  status: 'active',
  amount: 500,
  currency: 'USDC',
  createdAt: '2026-01-01T00:00:00Z',
  deadline: '2026-12-31T23:59:59Z',
  creatorAddress: 'GCREATOR',
  verifierAddress: 'GVERIFIER',
  successAddress: 'GSUCCESS',
  failureAddress: 'GFAILURE',
  contractAddress: 'GCONTRACT',
  milestones: [
    {
      id: 'm1',
      title: 'Phase 1',
      description: 'First phase',
      criteria: 'Deliver MVP',
      status: 'pending',
    },
    {
      id: 'm2',
      title: 'Phase 2',
      description: 'Second phase',
      criteria: 'Pass audit',
      status: 'validated',
      validatedAt: '2026-06-01T00:00:00Z',
    },
  ],
  transactions: [],
};

// ---------------------------------------------------------------------------
// createVaultPrefillFromVault
// ---------------------------------------------------------------------------

describe('createVaultPrefillFromVault', () => {
  it('builds a location state with the expected createVaultPrefill shape', () => {
    const state = createVaultPrefillFromVault(BASE_VAULT);

    expect(state).toEqual({
      createVaultPrefill: {
        sourceVaultId: 'vault-1',
        sourceVaultName: 'My Test Vault',
        name: 'My Test Vault (copy)',
        amount: '500',
        successAddress: 'GSUCCESS',
        failureAddress: 'GFAILURE',
        verifierAddress: 'GVERIFIER',
        milestones: [
          { title: 'Phase 1', criteria: 'Deliver MVP' },
          { title: 'Phase 2', criteria: 'Pass audit' },
        ],
      },
    });
  });

  it('converts amount to a string', () => {
    const state = createVaultPrefillFromVault({ ...BASE_VAULT, amount: 1234.56 });
    expect(state.createVaultPrefill?.amount).toBe('1234.56');
  });

  it('strips milestone fields other than title and criteria', () => {
    const state = createVaultPrefillFromVault(BASE_VAULT);
    const milestones = state.createVaultPrefill?.milestones ?? [];

    milestones.forEach((m) => {
      expect(Object.keys(m)).toEqual(['title', 'criteria']);
    });
  });

  it('produces an empty milestones array when vault has no milestones', () => {
    const state = createVaultPrefillFromVault({ ...BASE_VAULT, milestones: [] });
    expect(state.createVaultPrefill?.milestones).toEqual([]);
  });

  it('handles a vault where milestones is undefined (nullish coalesce)', () => {
    // milestones is required on Vault, but guard the nullish path anyway
    const vaultWithoutMilestones = {
      ...BASE_VAULT,
      milestones: undefined as unknown as Vault['milestones'],
    };
    const state = createVaultPrefillFromVault(vaultWithoutMilestones);
    expect(state.createVaultPrefill?.milestones).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getCreateVaultPrefill
// ---------------------------------------------------------------------------

describe('getCreateVaultPrefill', () => {
  // --- full round-trip ---

  it('round-trips: vault -> prefill state -> parsed-back prefill', () => {
    const locationState = createVaultPrefillFromVault(BASE_VAULT);
    const parsed = getCreateVaultPrefill(locationState);

    expect(parsed).toEqual({
      sourceVaultId: 'vault-1',
      sourceVaultName: 'My Test Vault',
      name: 'My Test Vault (copy)',
      amount: '500',
      successAddress: 'GSUCCESS',
      failureAddress: 'GFAILURE',
      verifierAddress: 'GVERIFIER',
      milestones: [
        { title: 'Phase 1', criteria: 'Deliver MVP' },
        { title: 'Phase 2', criteria: 'Pass audit' },
      ],
    });
  });

  // --- missing / undefined state ---

  it('returns undefined when state is undefined', () => {
    expect(getCreateVaultPrefill(undefined)).toBeUndefined();
  });

  it('returns undefined when state is null', () => {
    expect(getCreateVaultPrefill(null)).toBeUndefined();
  });

  it('returns undefined when state is a primitive (string)', () => {
    expect(getCreateVaultPrefill('not an object')).toBeUndefined();
  });

  it('returns undefined when state is a primitive (number)', () => {
    expect(getCreateVaultPrefill(42)).toBeUndefined();
  });

  // --- state object without createVaultPrefill key ---

  it('returns undefined when state has no createVaultPrefill key', () => {
    expect(getCreateVaultPrefill({})).toBeUndefined();
  });

  it('returns undefined when createVaultPrefill is null', () => {
    expect(getCreateVaultPrefill({ createVaultPrefill: null })).toBeUndefined();
  });

  it('returns undefined when createVaultPrefill is a string', () => {
    expect(
      getCreateVaultPrefill({ createVaultPrefill: 'oops' }),
    ).toBeUndefined();
  });

  it('returns undefined when createVaultPrefill is a number', () => {
    expect(
      getCreateVaultPrefill({ createVaultPrefill: 123 }),
    ).toBeUndefined();
  });

  // --- milestones with non-object entries filtered by isRecord ---

  it('filters out non-object entries from milestones', () => {
    const state = {
      createVaultPrefill: {
        sourceVaultId: 'v-1',
        milestones: [
          { title: 'Valid', criteria: 'Do thing' }, // kept
          'a string entry',                          // filtered
          42,                                        // filtered
          null,                                      // filtered
          true,                                      // filtered
          { title: 'Also valid', criteria: 'Check' }, // kept
        ],
      },
    };

    const parsed = getCreateVaultPrefill(state);
    expect(parsed?.milestones).toEqual([
      { title: 'Valid', criteria: 'Do thing' },
      { title: 'Also valid', criteria: 'Check' },
    ]);
  });

  it('returns an empty milestones array when every entry is non-object', () => {
    const state = {
      createVaultPrefill: {
        milestones: ['string', 0, null, false],
      },
    };

    const parsed = getCreateVaultPrefill(state);
    expect(parsed?.milestones).toEqual([]);
  });

  it('returns undefined milestones when the milestones field is not an array', () => {
    const state = {
      createVaultPrefill: {
        milestones: 'not-an-array',
      },
    };

    const parsed = getCreateVaultPrefill(state);
    expect(parsed?.milestones).toBeUndefined();
  });

  // --- optionalString guard: non-string fields become undefined ---

  it('returns undefined for string fields that are not strings', () => {
    const state = {
      createVaultPrefill: {
        sourceVaultId: 99,
        sourceVaultName: true,
        name: true,
        amount: { nested: 'object' },
        successAddress: null,
        failureAddress: [],
        verifierAddress: 42,
      },
    };

    const parsed = getCreateVaultPrefill(state);
    expect(parsed).toEqual({
      sourceVaultId: undefined,
      sourceVaultName: undefined,
      name: undefined,
      amount: undefined,
      successAddress: undefined,
      failureAddress: undefined,
      verifierAddress: undefined,
      milestones: undefined,
    });
  });

  // --- milestone optionalString fallback to empty string ---

  it('falls back to empty string for milestone title/criteria when they are non-strings', () => {
    const state = {
      createVaultPrefill: {
        milestones: [
          { title: 42, criteria: null },           // both non-string -> ""
          { title: 'OK', criteria: undefined },    // criteria non-string -> ""
          { title: undefined, criteria: 'Set' },   // title non-string -> ""
        ],
      },
    };

    const parsed = getCreateVaultPrefill(state);
    expect(parsed?.milestones).toEqual([
      { title: '', criteria: '' },
      { title: 'OK', criteria: '' },
      { title: '', criteria: 'Set' },
    ]);
  });
});
