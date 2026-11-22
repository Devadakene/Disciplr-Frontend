export interface ShortcutEntry {
  key: string;
  description: string;
}

export const SHORTCUTS: ShortcutEntry[] = [
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Close modal or overlay' },
  { key: 'Ctrl/⌘ K', description: 'Open the command palette' },
  { key: 'g d', description: 'Go to Dashboard' },
  { key: 'g v', description: 'Go to Vaults' },
  { key: 'g q', description: 'Go to Verifier Queue' },
  { key: 'g h', description: 'Go to Help' },
  { key: 'c', description: 'Create Vault' },
];
