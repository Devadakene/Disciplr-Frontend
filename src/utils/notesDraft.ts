const NOTES_DRAFT_PREFIX = 'disciplr:validation-notes-draft:';

function draftKey(taskId: string): string {
  return `${NOTES_DRAFT_PREFIX}${taskId}`;
}

/** Public accessor for the localStorage key a given task's notes draft is stored under. */
export function getNotesDraftKey(taskId: string): string {
  return draftKey(taskId);
}

function storageAvailable(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readNotesDraft(taskId: string | undefined): string {
  if (!taskId) {
    return '';
  }

  try {
    return storageAvailable()?.getItem(draftKey(taskId)) ?? '';
  } catch {
    return '';
  }
}

export function writeNotesDraft(taskId: string | undefined, notes: string): void {
  if (!taskId) {
    return;
  }

  try {
    storageAvailable()?.setItem(draftKey(taskId), notes);
  } catch {
    // Draft persistence is best-effort; verification must keep working.
  }
}

export function clearNotesDraft(taskId: string | undefined): void {
  if (!taskId) {
    return;
  }

  try {
    storageAvailable()?.removeItem(draftKey(taskId));
  } catch {
    // Draft cleanup is best-effort.
  }
}
