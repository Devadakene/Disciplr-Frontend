/**
 * Thin client for the Disciplr API (https://github.com/Disciplr-Org/Disciplr-backend).
 *
 * The base URL comes from `VITE_API`. When it is unset, the app runs fully offline on the
 * bundled fixtures (see vaultService.ts).
 */
import type { Vault, VaultTransaction, Milestone, VaultStatus } from "../types/vault";
import type { VaultActivityRecord } from "./vaultService";
import { verifyCreateIntegrity } from "./createIntegrity";
import { formatDate, formatUsdc } from "../utils/format";
import { withTimeout, ConnectTimeoutError } from "../utils/withTimeout";
import { withTimeout, ConnectTimeoutError } from "../utils/withTimeout";
import { logger } from "../utils/logger";
import { useConnectivityStore } from "./connectivity";

export const getRawApiBase = (): string | null => {
  const raw = (import.meta.env?.VITE_API as string | undefined)?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
};

export const API_BASE: string | null = getRawApiBase();
export const isApiEnabled = (): boolean => getRawApiBase() !== null;


export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

const BAD_GATEWAY_STATUS = 502;

/**
 * Fallback transaction/activity type used when the API returns an unrecognized
 * `type` string. Mapping to `"create"` keeps the record renderable without
 * casting arbitrary strings into the `TxType` union.
 */
export const FALLBACK_ACTIVITY_TYPE: VaultTransaction["type"] = "create";

/**
 * Fallback activity status used when the API returns an unrecognized `status`
 * string.
 */
export const FALLBACK_ACTIVITY_STATUS: VaultActivityRecord["status"] = "pending";

const VALID_VAULT_STATUSES: ReadonlySet<string> = new Set<VaultStatus>([
  "active",
  "pending_validation",
  "completed",
  "failed",
  "cancelled",
]);

const VALID_ACTIVITY_TYPES: ReadonlySet<string> = new Set<VaultTransaction["type"]>([
  "create",
  "validate",
  "release",
  "redirect",
]);

const VALID_ACTIVITY_STATUSES: ReadonlySet<string> = new Set<VaultActivityRecord["status"]>([
  "confirmed",
  "pending",
  "failed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumericValue(value: unknown): value is string | number {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    return value.trim().length > 0 && Number.isFinite(Number(value));
  }
  return false;
}

function parseFiniteAmount(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizeActivityType(type: unknown): VaultTransaction["type"] {
  if (typeof type === "string" && VALID_ACTIVITY_TYPES.has(type)) {
    return type as VaultTransaction["type"];
  }
  return FALLBACK_ACTIVITY_TYPE;
}

export function normalizeActivityStatus(status: unknown): VaultActivityRecord["status"] {
  if (typeof status === "string" && VALID_ACTIVITY_STATUSES.has(status)) {
    return status as VaultActivityRecord["status"];
  }
  return FALLBACK_ACTIVITY_STATUS;
}

function invalidResponseError(endpoint: string, issues: string[]): ApiError {
  return new ApiError(
    `Invalid API response from ${endpoint}`,
    BAD_GATEWAY_STATUS,
    issues,
  );
}

export interface ApiMilestone { id: string; title: string; amount: string; dueDate: string; status: string }

export function parseApiMilestone(raw: unknown): ParseResult<ApiMilestone> {
  if (!isRecord(raw)) {
    return { ok: false, issues: ["Milestone must be an object."] };
  }
  const issues: string[] = [];
  if (!isNonEmptyString(raw.id)) issues.push("Milestone id must be a non-empty string.");
  if (typeof raw.title !== "string") issues.push("Milestone title must be a string.");
  if (!isFiniteNumericValue(raw.amount)) issues.push("Milestone amount must be a finite numeric value.");
  if (typeof raw.dueDate !== "string") issues.push("Milestone dueDate must be a string.");
  if (typeof raw.status !== "string") issues.push("Milestone status must be a string.");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      id: raw.id as string,
      title: raw.title as string,
      amount: String(raw.amount),
      dueDate: raw.dueDate as string,
      status: raw.status as string,
    },
  };
}

export function isApiMilestone(raw: unknown): raw is ApiMilestone {
  return parseApiMilestone(raw).ok;
}

export interface ApiActivity { id: string; type: string; vaultId: string; amount: string; status: string; hash: string; memo: string; createdAt: string }

export function parseApiActivity(raw: unknown): ParseResult<ApiActivity> {
  if (!isRecord(raw)) {
    return { ok: false, issues: ["Activity must be an object."] };
  }
  const issues: string[] = [];
  if (!isNonEmptyString(raw.id)) issues.push("Activity id must be a non-empty string.");
  if (!isNonEmptyString(raw.type)) issues.push("Activity type must be a non-empty string.");
  if (raw.vaultId !== undefined && typeof raw.vaultId !== "string") {
    issues.push("Activity vaultId must be a string.");
  }
  if (!isFiniteNumericValue(raw.amount)) issues.push("Activity amount must be a finite numeric value.");
  if (typeof raw.status !== "string") issues.push("Activity status must be a string.");
  if (typeof raw.hash !== "string") issues.push("Activity hash must be a string.");
  if (raw.memo !== undefined && typeof raw.memo !== "string") {
    issues.push("Activity memo must be a string.");
  }
  if (typeof raw.createdAt !== "string") issues.push("Activity createdAt must be a string.");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      id: raw.id as string,
      type: raw.type as string,
      vaultId: typeof raw.vaultId === "string" ? raw.vaultId : "",
      amount: String(raw.amount),
      status: raw.status as string,
      hash: raw.hash as string,
      memo: typeof raw.memo === "string" ? raw.memo : "",
      createdAt: raw.createdAt as string,
    },
  };
}

export function isApiActivity(raw: unknown): raw is ApiActivity {
  return parseApiActivity(raw).ok;
}

export interface ApiVault {
  id: string; name?: string; creator: string; amount: string; status: string; startDate: string; endDate: string;
  verifier: string; successDestination: string; failureDestination: string; createdAt: string; updatedAt: string;
  milestones: ApiMilestone[]; activity?: ApiActivity[];
}

export function parseApiVault(raw: unknown): ParseResult<ApiVault> {
  if (!isRecord(raw)) {
    return { ok: false, issues: ["Vault must be an object."] };
  }
  const issues: string[] = [];
  if (!isNonEmptyString(raw.id)) issues.push("Vault id must be a non-empty string.");
  if (raw.name !== undefined && typeof raw.name !== "string") {
    issues.push("Vault name must be a string when present.");
  }
  if (!isNonEmptyString(raw.creator)) issues.push("Vault creator must be a non-empty string.");
  if (!isFiniteNumericValue(raw.amount)) issues.push("Vault amount must be a finite numeric value.");
  if (typeof raw.status !== "string" || !VALID_VAULT_STATUSES.has(raw.status)) {
    issues.push("Vault status must be a known vault status.");
  }
  if (raw.startDate !== undefined && typeof raw.startDate !== "string") {
    issues.push("Vault startDate must be a string when present.");
  }
  if (!isNonEmptyString(raw.endDate)) issues.push("Vault endDate must be a non-empty string.");
  if (raw.verifier !== undefined && typeof raw.verifier !== "string") {
    issues.push("Vault verifier must be a string when present.");
  }
  if (typeof raw.successDestination !== "string") {
    issues.push("Vault successDestination must be a string.");
  }
  if (typeof raw.failureDestination !== "string") {
    issues.push("Vault failureDestination must be a string.");
  }
  if (!isNonEmptyString(raw.createdAt)) issues.push("Vault createdAt must be a non-empty string.");
  if (raw.updatedAt !== undefined && typeof raw.updatedAt !== "string") {
    issues.push("Vault updatedAt must be a string when present.");
  }

  const milestones: ApiMilestone[] = [];
  if (raw.milestones !== undefined && raw.milestones !== null) {
    if (!Array.isArray(raw.milestones)) {
      issues.push("Vault milestones must be an array when present.");
    } else {
      raw.milestones.forEach((item, index) => {
        const parsed = parseApiMilestone(item);
        if (!parsed.ok) {
          issues.push(...parsed.issues.map((issue) => `milestones[${index}]: ${issue}`));
        } else {
          milestones.push(parsed.value);
        }
      });
    }
  }

  let activity: ApiActivity[] | undefined;
  if (raw.activity !== undefined && raw.activity !== null) {
    if (!Array.isArray(raw.activity)) {
      issues.push("Vault activity must be an array when present.");
    } else {
      activity = [];
      raw.activity.forEach((item, index) => {
        const parsed = parseApiActivity(item);
        if (!parsed.ok) {
          issues.push(...parsed.issues.map((issue) => `activity[${index}]: ${issue}`));
        } else {
          activity!.push(parsed.value);
        }
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      id: raw.id as string,
      ...(typeof raw.name === "string" ? { name: raw.name } : {}),
      creator: raw.creator as string,
      amount: String(raw.amount),
      status: raw.status as string,
      startDate: typeof raw.startDate === "string" ? raw.startDate : "",
      endDate: raw.endDate as string,
      verifier: typeof raw.verifier === "string" ? raw.verifier : "",
      successDestination: raw.successDestination as string,
      failureDestination: raw.failureDestination as string,
      createdAt: raw.createdAt as string,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
      milestones,
      ...(activity !== undefined ? { activity } : {}),
    },
  };
}

export function isApiVault(raw: unknown): raw is ApiVault {
  return parseApiVault(raw).ok;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: string[] = [],
    public serverError?: string,
    public attempts: number = 1,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_BASE_BACKOFF_MS = 300;
export const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export type SleepFn = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface FetchPolicyOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  sleep?: SleepFn;
  random?: () => number;
  fetchImpl?: typeof fetch;
}

export interface FetchPolicyResult {
  response: Response;
  attempts: number;
}

function createAbortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) {
    return signal.reason;
  }
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

/**
 * Computes jittered exponential backoff in milliseconds.
 * Full-half jitter: [0.5 * base * 2^retryIndex, base * 2^retryIndex].
 */
export function computeBackoffMs(
  retryIndex: number,
  baseMs: number = DEFAULT_BASE_BACKOFF_MS,
  random: () => number = Math.random,
): number {
  const exponential = baseMs * 2 ** retryIndex;
  const jitter = 0.5 + random() * 0.5;
  return Math.round(exponential * jitter);
}

export function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError(signal));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchWithPolicy(
  url: string,
  init?: RequestInit,
  policy?: FetchPolicyOptions,
): Promise<FetchPolicyResult> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isIdempotent = method === "GET";
  const maxRetries = isIdempotent ? (policy?.maxRetries ?? DEFAULT_MAX_RETRIES) : 0;
  const timeoutMs = policy?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const baseBackoffMs = policy?.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const sleep = policy?.sleep ?? defaultSleep;
  const random = policy?.random ?? Math.random;
  const fetchFn = policy?.fetchImpl ?? fetch;
  const callerSignal = init?.signal ?? undefined;

  if (callerSignal?.aborted) {
    throw createAbortError(callerSignal);
  }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const attemptController = new AbortController();
    let timedOut = false;

    const onCallerAbort = () => {
      attemptController.abort(callerSignal?.reason);
    };

    if (callerSignal) {
      if (callerSignal.aborted) {
        throw createAbortError(callerSignal);
      }
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }

    let res: Response;
    try {
      const wrapped = withTimeout(
        fetchFn(url, { ...init, signal: attemptController.signal }),
        timeoutMs,
        () => {
          timedOut = true;
          attemptController.abort();
        },
      );
      res = await wrapped;
    } catch (err) {
      if (callerSignal?.aborted || (!timedOut && isAbortError(err))) {
        throw err;
      }
      if (timedOut || err instanceof ConnectTimeoutError) {
        throw new ApiError(
          `Request timed out after ${timeoutMs}ms.`,
          0,
          [],
          undefined,
          attempt,
        );
      }
      if (attempt <= maxRetries) {
        const delay = computeBackoffMs(attempt - 1, baseBackoffMs, random);
        await sleep(delay, callerSignal);
        continue;
      }
      throw new ApiError("Could not reach the Disciplr API.", 0, [], undefined, attempt);
    } finally {
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }

    if (RETRYABLE_STATUSES.has(res.status) && attempt <= maxRetries) {
      const delay = computeBackoffMs(attempt - 1, baseBackoffMs, random);
      await sleep(delay, callerSignal);
      continue;
    }

    return { response: res, attempts: attempt };
  }

  throw new ApiError("Could not reach the Disciplr API.", 0, [], undefined, maxRetries + 1);
}

export function classifyCreateError(err: unknown): "rejected" | "unknown" {
  if (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 408 &&
    err.status !== 429
  ) {
    return "rejected";
  }
  return "unknown";
}

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const baseUrl = getRawApiBase();
  if (!baseUrl) throw new ApiError("API not configured", 0);
  const { timeoutMs, ...fetchInit } = init ?? {};
  let res: Response;
  let attempts: number;
  try {
    const result = await fetchWithPolicy(
      `${baseUrl}${path}`,
      {
        ...fetchInit,
        headers: { "content-type": "application/json", ...(fetchInit.headers ?? {}) },
      },
      timeoutMs !== undefined ? { timeoutMs } : undefined,
    );
    res = result.response;
    attempts = result.attempts;
  } catch (err) {
    if (isAbortError(err, fetchInit.signal ?? undefined)) {
      throw err;
    }
    useConnectivityStore.getState().reportApiFailure(0);
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError("Could not reach the Disciplr API.", 0);
  }
  const rawBody: unknown = await res.json().catch(() => ({}));
  const body = isRecord(rawBody)
    ? (rawBody as { error?: unknown; details?: unknown; data?: T })
    : {};
  if (!res.ok) {
    if (res.status >= 500) {
      useConnectivityStore.getState().reportApiFailure(res.status);
    }
    const serverError = typeof body.error === "string" ? body.error : undefined;
    const details = Array.isArray(body.details)
      ? body.details.filter((detail): detail is string => typeof detail === "string")
      : [];
    throw new ApiError(
      [serverError, ...details].filter(Boolean).join(": ") || `HTTP ${res.status}`,
      res.status,
      details,
      serverError,
      attempts,
    );
  }
  return body.data as T;
}

const toTx = (a: ApiActivity): VaultTransaction => ({
  id: a.id,
  type: normalizeActivityType(a.type),
  hash: a.hash,
  timestamp: a.createdAt,
  amount: parseFiniteAmount(a.amount, 0),
});

export function toVault(v: ApiVault): Vault {
  const rawMilestones = Array.isArray(v.milestones) ? v.milestones : [];
  const milestones: Milestone[] = rawMilestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: `${formatUsdc(m.amount)} USDC, due ${formatDate(m.dueDate)}`,
    criteria: m.title,
    status: m.status === "completed" ? "validated" : m.status === "failed" ? "failed" : "pending",
    dueDate: m.dueDate,
    ...(m.status === "completed" ? { validatedAt: v.updatedAt || v.createdAt } : {}),
  }));
  const status: VaultStatus = VALID_VAULT_STATUSES.has(v.status)
    ? (v.status as VaultStatus)
    : "active";
  return {
    id: v.id,
    name: v.name || `Vault ${v.id}`,
    status,
    amount: parseFiniteAmount(v.amount, 0),
    currency: "USDC",
    createdAt: v.createdAt,
    deadline: v.endDate,
    creatorAddress: v.creator,
    verifierAddress: v.verifier,
    successAddress: v.successDestination,
    failureAddress: v.failureDestination,
    contractAddress: v.creator, // settlement is simulated by the API; no per-vault contract yet
    milestones,
    transactions: (Array.isArray(v.activity) ? v.activity : []).map(toTx),
  };
}

export interface VaultFilter { creator?: string; status?: string }

/** Builds `?creator=..&status=..` with every value URI-encoded; empty when no filter is set. */
export function buildVaultQuery(filter?: VaultFilter): string {
  const parts: string[] = [];
  if (filter?.creator) parts.push(`creator=${encodeURIComponent(filter.creator)}`);
  if (filter?.status) parts.push(`status=${encodeURIComponent(filter.status)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const apiListVaults = async (
  filter?: VaultFilter,
  signal?: AbortSignal,
): Promise<Vault[]> => {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  const endpoint = `/vaults${buildVaultQuery(filter)}`;
  const raw = await request<unknown>(endpoint, signal ? { signal } : undefined);
  if (!Array.isArray(raw)) {
    throw invalidResponseError(endpoint, ["Expected an array of vaults."]);
  }
  const vaults: Vault[] = [];
  raw.forEach((item, index) => {
    const parsed = parseApiVault(item);
    if (!parsed.ok) {
      logger.warn("Dropping invalid vault from API response", {
        endpoint,
        index,
        issues: parsed.issues,
      });
      return;
    }
    vaults.push(toVault(parsed.value));
  });
  return vaults;
};

/** Raw `/transactions` feed (all vaults); callers filter to the vaults they own. */
export const apiListTransactions = (): Promise<ApiActivity[]> => {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  return request<ApiActivity[]>("/transactions");
};

export async function apiGetVault(id: string): Promise<Vault | undefined> {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  const endpoint = `/vaults/${encodeURIComponent(id)}`;
  try {
    const raw = await request<unknown>(endpoint);
    const parsed = parseApiVault(raw);
    if (!parsed.ok) {
      throw invalidResponseError(endpoint, parsed.issues);
    }
    return toVault(parsed.value);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export async function apiCreateVault(input: {
  name: string; amount: number; deadline: string; creator: string; verifier: string;
  successAddress: string; failureAddress: string; milestones: { title: string }[];
}): Promise<Vault> {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  const per = input.amount / Math.max(1, input.milestones.length);
  const start = Date.now();
  const end = new Date(input.deadline).getTime();
  const step = (end - start) / Math.max(1, input.milestones.length);
  const v = await request<ApiVault>("/vaults", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      creator: input.creator,
      verifier: input.verifier,
      amount: input.amount,
      endDate: new Date(end).toISOString(),
      successDestination: input.successAddress,
      failureDestination: input.failureAddress,
      milestones: input.milestones.map((m, i) => ({
        title: m.title,
        amount: Number(per.toFixed(7)),
        dueDate: new Date(start + step * (i + 1)).toISOString(),
      })),
    }),
  });
  const vault = toVault(v);
  verifyCreateIntegrity(
    {
      creator: input.creator,
      verifier: input.verifier,
      amount: input.amount,
      successAddress: input.successAddress,
      failureAddress: input.failureAddress,
    },
    v,
    vault,
  );
  return vault;
}


export async function apiValidateNextMilestone(vault: Vault, actor: string): Promise<void> {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  const next = vault.milestones.find((m) => m.status === "pending");
  if (!next) throw new Error("No pending milestone to validate.");
  await request(`/vaults/${encodeURIComponent(vault.id)}/milestones/${encodeURIComponent(next.id)}/validate`, {
    method: "POST",
    body: JSON.stringify({ verifier: actor }),
  });
}

export async function apiFailVault(vault: Vault, actor: string): Promise<void> {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  await request(`/vaults/${encodeURIComponent(vault.id)}/fail`, {
    method: "POST",
    body: JSON.stringify({ verifier: actor }),
  });
}

export interface ListActivityOptions {
  vaultId?: string;
}

export async function apiListActivity(options: ListActivityOptions = {}): Promise<VaultActivityRecord[]> {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  const query = options.vaultId ? `?vaultId=${encodeURIComponent(options.vaultId)}` : "";
  const txEndpoint = `/transactions${query}`;
  const [rawActs, rawVaults] = await Promise.all([
    request<unknown>(txEndpoint),
    request<unknown>("/vaults"),
  ]);
  if (!Array.isArray(rawActs)) {
    throw invalidResponseError(txEndpoint, ["Expected an array of activities."]);
  }
  if (!Array.isArray(rawVaults)) {
    throw invalidResponseError("/vaults", ["Expected an array of vaults."]);
  }

  const vaults: ApiVault[] = [];
  rawVaults.forEach((item, index) => {
    const parsed = parseApiVault(item);
    if (!parsed.ok) {
      logger.warn("Dropping invalid vault from /vaults response in apiListActivity", {
        index,
        issues: parsed.issues,
      });
      return;
    }
    vaults.push(parsed.value);
  });

  const acts: ApiActivity[] = [];
  rawActs.forEach((item, index) => {
    const parsed = parseApiActivity(item);
    if (!parsed.ok) {
      logger.warn("Dropping invalid activity from API response", {
        endpoint: txEndpoint,
        index,
        issues: parsed.issues,
      });
      return;
    }
    acts.push(parsed.value);
  });

  const names = new Map(vaults.map((v) => [v.id, v] as const));
  return acts.map((a) => {
    const v = names.get(a.vaultId);
    const ts = new Date(a.createdAt);
    const normalizedType = normalizeActivityType(a.type);
    return {
      id: a.id,
      type: normalizedType,
      vaultId: a.vaultId,
      vault: v ? v.name || a.vaultId : a.vaultId,
      amount: parseFiniteAmount(a.amount, 0),
      fee: 0,
      block: 0,
      hash: a.hash,
      status: normalizeActivityStatus(a.status),
      from: v?.creator ?? "",
      to: normalizedType === "redirect" ? (v ? v.failureDestination ?? "" : "") : (v ? v.successDestination ?? "" : ""),
      timestamp: ts,
      memo: a.memo,
    };
  });
}

export interface ApiStats {
  totalVaults: number; active: number; completed: number; failed: number;
  totalLocked: number; totalReleased: number; totalRedirected: number; successRate: number | null;
}

export function parseApiStats(raw: unknown): ParseResult<ApiStats> {
  if (!isRecord(raw)) {
    return { ok: false, issues: ["Stats must be an object."] };
  }
  const issues: string[] = [];
  const numericFields = [
    "totalVaults",
    "active",
    "completed",
    "failed",
    "totalLocked",
    "totalReleased",
    "totalRedirected",
  ] as const;

  for (const field of numericFields) {
    if (typeof raw[field] !== "number" || !Number.isFinite(raw[field])) {
      issues.push(`Stats ${field} must be a finite number.`);
    }
  }

  if (
    raw.successRate !== null &&
    (typeof raw.successRate !== "number" || !Number.isFinite(raw.successRate))
  ) {
    issues.push("Stats successRate must be a finite number or null.");
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      totalVaults: raw.totalVaults as number,
      active: raw.active as number,
      completed: raw.completed as number,
      failed: raw.failed as number,
      totalLocked: raw.totalLocked as number,
      totalReleased: raw.totalReleased as number,
      totalRedirected: raw.totalRedirected as number,
      successRate: raw.successRate as number | null,
    },
  };
}

export function isApiStats(raw: unknown): raw is ApiStats {
  return parseApiStats(raw).ok;
}

export async function apiStats(creator?: string): Promise<ApiStats> {
  if (!isApiEnabled()) throw new ApiError("API not configured", 0);
  const endpoint = `/stats${buildVaultQuery({ creator })}`;
  const raw = await request<unknown>(endpoint);
  const parsed = parseApiStats(raw);
  if (!parsed.ok) {
    throw invalidResponseError(endpoint, parsed.issues);
  }
  return parsed.value;
}
