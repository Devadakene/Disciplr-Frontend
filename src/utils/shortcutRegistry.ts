export interface ShortcutRegistration {
  keys: string;
  description: string;
  handler: (event: KeyboardEvent) => void;
  when?: () => boolean;
}

export interface ShortcutEntry {
  key: string;
  description: string;
}

export function isEditableTarget(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  const ce = element.getAttribute("contenteditable");
  return ce !== null && ce !== "false";
}

export function isModalOrDrawerOpen(): boolean {
  if (typeof document === "undefined" || !document.body) return false;
  try {
    const elements = document.body.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (
        el.getAttribute("role") === "dialog" ||
        el.getAttribute("aria-modal") === "true"
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function normalizeKeyCombo(keys: string): string {
  const trimmed = keys.trim().toLowerCase();
  if (trimmed === "ctrl/⌘ k" || trimmed === "ctrl+k" || trimmed === "cmd+k") {
    return "mod+k";
  }
  return trimmed;
}

export function formatKeyForDisplay(keys: string): string {
  const norm = normalizeKeyCombo(keys);
  if (norm === "mod+k") {
    return "Ctrl/⌘ K";
  }
  if (norm === "esc" || norm === "escape") {
    return "Esc";
  }
  return keys;
}

interface InternalShortcut extends ShortcutRegistration {
  id: number;
  normalizedKeys: string;
}

let nextId = 1;
const shortcuts: InternalShortcut[] = [];

let isListenerInstalled = false;
let pendingFirstKey: string | null = null;
let sequenceTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearSequence() {
  pendingFirstKey = null;
  if (sequenceTimeoutId !== null) {
    clearTimeout(sequenceTimeoutId);
    sequenceTimeoutId = null;
  }
}

function handleGlobalKeyDown(event: KeyboardEvent) {
  // 1. Ignore editable targets
  const target = event.target instanceof Element ? event.target : null;
  if (isEditableTarget(target) || isEditableTarget(document.activeElement)) {
    clearSequence();
    return;
  }

  // 2. Mod+K shortcut (command palette)
  const isModK =
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "k";

  if (isModK) {
    const shortcut = shortcuts.find((s) => s.normalizedKeys === "mod+k");
    if (shortcut) {
      if (shortcut.when && !shortcut.when()) {
        return;
      }
      event.preventDefault();
      clearSequence();
      shortcut.handler(event);
      return;
    }
  }

  // Ignore other modifier key presses for navigation shortcuts
  if (event.metaKey || event.ctrlKey || event.altKey) {
    clearSequence();
    return;
  }

  const keyChar = event.key.toLowerCase();

  // 3. If a 2-key sequence is in progress
  if (pendingFirstKey !== null) {
    const fullSeq = `${pendingFirstKey} ${keyChar}`;
    clearSequence();

    const shortcut = shortcuts.find((s) => s.normalizedKeys === fullSeq);
    if (shortcut) {
      if (isModalOrDrawerOpen() && (!shortcut.when || !shortcut.when())) {
        return;
      }
      if (shortcut.when && !shortcut.when()) {
        return;
      }
      event.preventDefault();
      shortcut.handler(event);
      return;
    }
    // Unknown sequence - nothing fired
    return;
  }

  // 4. Check if key starts a two-key sequence (e.g. 'g')
  const startsSequence = shortcuts.some((s) =>
    s.normalizedKeys.startsWith(`${keyChar} `),
  );

  if (startsSequence) {
    if (isModalOrDrawerOpen()) {
      // Sequences cannot start while modal/drawer is open
      return;
    }
    event.preventDefault();
    pendingFirstKey = keyChar;
    sequenceTimeoutId = setTimeout(() => {
      clearSequence();
    }, 1000);
    return;
  }

  // 5. Single key shortcuts (e.g. '?' or 'c')
  const singleShortcut = shortcuts.find(
    (s) =>
      s.normalizedKeys === event.key ||
      s.normalizedKeys === keyChar,
  );

  if (singleShortcut) {
    // Sequences/single navigation keys must not fire when modal is open unless explicitly allowed
    if (
      singleShortcut.normalizedKeys !== "?" &&
      isModalOrDrawerOpen() &&
      (!singleShortcut.when || !singleShortcut.when())
    ) {
      return;
    }

    if (singleShortcut.when && !singleShortcut.when()) {
      return;
    }

    event.preventDefault();
    singleShortcut.handler(event);
  }
}

function ensureListener() {
  if (typeof document === "undefined" || isListenerInstalled) return;
  document.addEventListener("keydown", handleGlobalKeyDown);
  isListenerInstalled = true;
}

/**
 * Registers a global shortcut.
 * Returns an unregister function.
 */
export function registerShortcut(registration: ShortcutRegistration): () => void {
  ensureListener();

  const normalizedKeys = normalizeKeyCombo(registration.keys);

  // Duplicate warning
  const existing = shortcuts.find((s) => s.normalizedKeys === normalizedKeys);
  if (existing) {
    // Developer-facing warning; tests assert on console.warn.
    // eslint-disable-next-line no-console
    console.warn(`Duplicate shortcut registration for keys: "${registration.keys}"`);
  }

  const id = nextId++;
  const entry: InternalShortcut = {
    ...registration,
    id,
    normalizedKeys,
  };

  shortcuts.push(entry);

  return () => {
    const idx = shortcuts.findIndex((s) => s.id === id);
    if (idx !== -1) {
      shortcuts.splice(idx, 1);
    }
  };
}

/**
 * Returns all currently registered shortcuts formatted for display.
 */
export function getRegisteredShortcuts(): ShortcutEntry[] {
  return shortcuts.map((s) => ({
    key: formatKeyForDisplay(s.keys),
    description: s.description,
  }));
}

/**
 * Testing helper to reset the registry.
 */
export function _resetRegistryForTesting(): void {
  shortcuts.length = 0;
  clearSequence();
  if (typeof document !== "undefined" && isListenerInstalled) {
    document.removeEventListener("keydown", handleGlobalKeyDown);
    isListenerInstalled = false;
  }
}
