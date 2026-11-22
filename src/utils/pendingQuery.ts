import {
  type PendingSortKey,
  type SortDirection,
  isSortKey,
  isSortDirection,
} from './sortPending';

export type { PendingSortKey, SortDirection };

export interface PendingQueryState {
  q: string;
  milestone: string;
  sort: PendingSortKey;
  dir: SortDirection;
}

export const VALID_SORT_KEYS: readonly PendingSortKey[] = [
  'deadline',
  'amount',
  'vaultName',
] as const;

export const VALID_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'] as const;

export const DEFAULT_PENDING_QUERY: PendingQueryState = {
  q: '',
  milestone: '',
  sort: 'deadline',
  dir: 'asc',
};

export function parseSearch(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim();
}

export function parseMilestone(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim();
}

export function parseSortKey(value: string | null | undefined): PendingSortKey {
  if (value && isSortKey(value)) {
    return value;
  }
  return DEFAULT_PENDING_QUERY.sort;
}

export function parseSortDirection(value: string | null | undefined): SortDirection {
  if (value && isSortDirection(value)) {
    return value;
  }
  return DEFAULT_PENDING_QUERY.dir;
}

/**
 * Parses URLSearchParams into PendingQueryState.
 * Whitelists sort keys (PendingSortKey) and direction, trims q and milestone,
 * and falls back safely on invalid/unknown values to defaults.
 */
export function parsePendingQuery(
  searchParams: URLSearchParams | string,
): PendingQueryState {
  const params =
    typeof searchParams === 'string'
      ? new URLSearchParams(searchParams)
      : searchParams;

  return {
    q: parseSearch(params.get('q')),
    milestone: parseMilestone(params.get('milestone')),
    sort: parseSortKey(params.get('sort')),
    dir: parseSortDirection(params.get('dir')),
  };
}

/**
 * Serializes PendingQueryState into URLSearchParams.
 * Omits default or empty values so the URL remains clean.
 */
export function serializePendingQuery(
  state: Partial<PendingQueryState>,
): URLSearchParams {
  const params = new URLSearchParams();

  const q = state.q ? state.q.trim() : '';
  if (q.length > 0) {
    params.set('q', q);
  }

  const milestone = state.milestone ? state.milestone.trim() : '';
  if (milestone.length > 0) {
    params.set('milestone', milestone);
  }

  const sort = state.sort ?? DEFAULT_PENDING_QUERY.sort;
  if (sort !== DEFAULT_PENDING_QUERY.sort && isSortKey(sort)) {
    params.set('sort', sort);
  }

  const dir = state.dir ?? DEFAULT_PENDING_QUERY.dir;
  if (dir !== DEFAULT_PENDING_QUERY.dir && isSortDirection(dir)) {
    params.set('dir', dir);
  }

  return params;
}
