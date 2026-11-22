/**
 * Per-wallet draft persistence for the Create Vault form.
 *
 * Creating a vault is the most effortful form in the product (a USDC amount, a
 * deadline, two 56-character Stellar addresses, an ordered milestone list and an
 * evidence link), so losing it to an accidental refresh is a direct conversion
 * killer. Drafts are scoped to the connected wallet address and never contain
 * wallet, signing, or secret material — only public addresses and the text the
 * user typed.
 *
 * Every read validates the payload (shape, version, age, size) so a corrupted
 * or hostile localStorage value can never reach the form. Invalid entries are
 * discarded on read.
 *
 * Only one draft exists per wallet, so two tabs editing the same wallet are
 * last-write-wins: the most recent autosave is the one that gets restored.
 */

export const CREATE_VAULT_DRAFT_PREFIX = 'disciplr:create-vault-draft:v1::';
export const CREATE_VAULT_DRAFT_VERSION = 1;
/** Drafts older than this are discarded on read. */
export const CREATE_VAULT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Drafts larger than this are never written, and are discarded on read. */
export const CREATE_VAULT_DRAFT_MAX_BYTES = 50 * 1024;

export interface CreateVaultDraftMilestone {
  title: string;
  criteria: string;
}

export interface CreateVaultDraftValues {
  name?: string;
  verifierAddress?: string;
  amount: string;
  deadline: string;
  successAddress: string;
  failureAddress: string;
  milestones: CreateVaultDraftMilestone[];
  evidenceUrl?: string;
}

export interface CreateVaultDraft extends CreateVaultDraftValues {
  v: number;
  savedAt: number;
}

/**
 * localStorage key for a wallet's draft. Returns null for a missing/blank owner
 * so an unauthenticated render can never read or write a shared key.
 */
export function getCreateVaultDraftKey(
  ownerKey: string | null | undefined,
): string | null {
  if (typeof ownerKey !== 'string') return null;
  const trimmed = ownerKey.trim();
  if (!trimmed) return null;
  return `${CREATE_VAULT_DRAFT_PREFIX}${trimmed}`;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function createVaultDraft(
  values: CreateVaultDraftValues,
  now: number = Date.now(),
): CreateVaultDraft {
  return {
    v: CREATE_VAULT_DRAFT_VERSION,
    savedAt: now,
    ...(values.name ? { name: values.name } : {}),
    ...(values.verifierAddress ? { verifierAddress: values.verifierAddress } : {}),
    amount: values.amount,
    deadline: values.deadline,
    successAddress: values.successAddress,
    failureAddress: values.failureAddress,
    milestones: values.milestones.map(({ title, criteria }) => ({
      title,
      criteria,
    })),
    ...(values.evidenceUrl ? { evidenceUrl: values.evidenceUrl } : {}),
  };
}

/**
 * Validates a raw payload. Returns null when it is not a draft this version of
 * the app can safely restore (wrong shape, wrong version, too old, too large).
 */
function parseDraft(raw: string, now: number): CreateVaultDraft | null {
  if (byteLength(raw) > CREATE_VAULT_DRAFT_MAX_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.v !== CREATE_VAULT_DRAFT_VERSION) return null;

  const savedAt = parsed.savedAt;
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
  if (now - savedAt > CREATE_VAULT_DRAFT_TTL_MS) return null;

  const amount = readString(parsed.amount);
  const deadline = readString(parsed.deadline);
  const successAddress = readString(parsed.successAddress);
  const failureAddress = readString(parsed.failureAddress);
  if (
    amount === null ||
    deadline === null ||
    successAddress === null ||
    failureAddress === null
  ) {
    return null;
  }

  if (!Array.isArray(parsed.milestones)) return null;
  const milestones: CreateVaultDraftMilestone[] = [];
  for (const entry of parsed.milestones) {
    if (!isRecord(entry)) return null;
    const title = readString(entry.title);
    const criteria = readString(entry.criteria);
    if (title === null || criteria === null) return null;
    milestones.push({ title, criteria });
  }

  // Optional text fields added after v1 drafts shipped; absent is fine.
  const optionalText: { name?: string; verifierAddress?: string } = {};
  for (const field of ['name', 'verifierAddress'] as const) {
    if (parsed[field] === undefined) continue;
    const value = readString(parsed[field]);
    if (value === null) return null;
    optionalText[field] = value;
  }

  let evidenceUrl: string | undefined;
  if (parsed.evidenceUrl !== undefined) {
    const parsedEvidenceUrl = readString(parsed.evidenceUrl);
    if (parsedEvidenceUrl === null) return null;
    evidenceUrl = parsedEvidenceUrl;
  }

  return {
    v: CREATE_VAULT_DRAFT_VERSION,
    savedAt,
    ...optionalText,
    amount,
    deadline,
    successAddress,
    failureAddress,
    milestones,
    ...(evidenceUrl !== undefined ? { evidenceUrl } : {}),
  };
}

/**
 * Best-effort read of a wallet's draft. Invalid, expired, or oversized entries
 * are removed. Returns null when nothing restorable exists.
 */
export function readDraft(
  ownerKey: string | null | undefined,
  now: number = Date.now(),
): CreateVaultDraft | null {
  const key = getCreateVaultDraftKey(ownerKey);
  if (!key) return null;

  const store = storage();
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const draft = parseDraft(raw, now);
  if (draft) return draft;

  try {
    store.removeItem(key);
  } catch {
    // Discarding an invalid draft is best-effort.
  }
  return null;
}

/**
 * Best-effort write. Returns false when the draft is missing an owner, the
 * payload exceeds the size cap, or storage is unavailable/full.
 */
export function writeDraft(
  ownerKey: string | null | undefined,
  draft: CreateVaultDraft,
): boolean {
  const key = getCreateVaultDraftKey(ownerKey);
  if (!key) return false;

  const store = storage();
  if (!store) return false;

  let serialized: string;
  try {
    serialized = JSON.stringify(draft);
  } catch {
    return false;
  }
  if (byteLength(serialized) > CREATE_VAULT_DRAFT_MAX_BYTES) return false;

  try {
    store.setItem(key, serialized);
    return true;
  } catch {
    // Quota exceeded / private mode — draft persistence is best-effort.
    return false;
  }
}

export function clearDraft(ownerKey: string | null | undefined): void {
  const key = getCreateVaultDraftKey(ownerKey);
  if (!key) return;

  const store = storage();
  if (!store) return;

  try {
    store.removeItem(key);
  } catch {
    // Draft cleanup is best-effort.
  }
}
