import type { ValidationTask } from '../Zustand/Store';

export type AnalyticsRow = {
  name: string;
  success: number;
  failed: number;
  capital: number;
  milestones: number;
};

const TASK_HEADERS: string[] = ['ID', 'Status', 'Vault Name', 'Owner', 'Amount', 'Deadline', 'Milestone', 'Notes'];
const TX_HEADERS: string[] = ['ID', 'Type', 'Vault', 'Amount (XLM)', 'Fee (XLM)', 'Status', 'Timestamp', 'Hash', 'Block', 'From', 'To', 'Memo'];
const ANALYTICS_HEADERS: string[] = ['Period', 'Success %', 'Failed %', 'Capital (USDC)', 'Milestones'];

/** Safe placeholder for amount/fee cells that are not finite numbers after normalization. */
export const NON_FINITE_NUMERIC_PLACEHOLDER = '';

/**
 * Normalizes a numeric CSV cell to a canonical dot-decimal, ungrouped string.
 * Non-finite values (NaN, ±Infinity) and unparseable input resolve to
 * {@link NON_FINITE_NUMERIC_PLACEHOLDER}. Call this before {@link escapeCell}.
 */
export function normalizeNumericCell(value: number | string): string {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    const stripped = value.replace(/,/g, '').trim();
    if (stripped.length === 0) return NON_FINITE_NUMERIC_PLACEHOLDER;
    n = Number(stripped);
  } else {
    return NON_FINITE_NUMERIC_PLACEHOLDER;
  }

  if (!Number.isFinite(n)) {
    return NON_FINITE_NUMERIC_PLACEHOLDER;
  }

  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumSignificantDigits: 21,
  }).format(n);
}

function escapeCell(value: string): string {
  if (value.length > 0 && /^[=+\-@\t\r]/.test(value)) {
    value = `'${value}`;
  }
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function taskToRow(task: ValidationTask): string {
  const cells = [
    task.id,
    task.status,
    task.vaultName,
    task.owner,
    task.amount,
    task.deadline,
    task.milestone,
    task.notes ?? '',
  ];
  return cells.map(escapeCell).join(',');
}

function analyticsRowToRow(row: AnalyticsRow): string {
  const cells = [
    row.name,
    String(row.success),
    String(row.failed),
    String(row.capital),
    String(row.milestones),
  ];
  return cells.map(escapeCell).join(',');
}

function txToRow(tx: Transaction): string {
  const cells = [
    tx.id,
    tx.type,
    tx.vault,
    normalizeNumericCell(tx.amount),
    normalizeNumericCell(tx.fee),
    tx.status,
    tx.timestamp instanceof Date ? tx.timestamp.toISOString() : String(tx.timestamp),
    tx.hash,
    String(tx.block),
    tx.from,
    tx.to,
    tx.memo,
  ];
  return cells.map(escapeCell).join(',');
}

export function toCsv(tasks: ValidationTask[]): string;
export function toCsv(txs: Transaction[], type: 'transactions'): string;
export function toCsv(rows: AnalyticsRow[], type: 'analytics'): string;
export function toCsv(data: Array<ValidationTask | Transaction | AnalyticsRow>, type?: 'transactions' | 'analytics'): string {
  if (type === 'analytics') {
    const headerRow = ANALYTICS_HEADERS.join(',');
    if (data.length === 0) return headerRow;
    const rows = (data as AnalyticsRow[]).map(analyticsRowToRow);
    return [headerRow, ...rows].join('\r\n');
  } else if (type === 'transactions') {
    const headerRow = TX_HEADERS.join(',');
    if (data.length === 0) return headerRow;
    const rows = (data as Transaction[]).map(txToRow);
    return [headerRow, ...rows].join('\r\n');
  } else {
    const headerRow = TASK_HEADERS.join(',');
    if (data.length === 0) return headerRow;
    const rows = (data as ValidationTask[]).map(taskToRow);
    return [headerRow, ...rows].join('\r\n');
  }
}

export function downloadCsv(csv: string, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

