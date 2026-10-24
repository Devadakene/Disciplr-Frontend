import { useState, useEffect, useId, useMemo } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Modal';
import { Text } from './Text';
import { SHORTCUTS, type ShortcutEntry } from '@/utils/shortcuts';
import {
  registerShortcut,
  getRegisteredShortcuts,
  isEditableTarget,
} from '@/utils/shortcutRegistry';

export { isEditableTarget };

interface ShortcutsHelpProps {
  shortcuts?: ShortcutEntry[];
  isOpen?: boolean;
  onClose?: () => void;
}

export function ShortcutsHelp({ shortcuts, isOpen: controlledIsOpen, onClose }: ShortcutsHelpProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onClose
    ? (next: boolean | ((prev: boolean) => boolean)) => {
        if (typeof next === 'function' ? !next(isOpen) : !next) {
          onClose();
        }
      }
    : setInternalIsOpen;

  const titleId = useId();
  const descId = useId();

  // Register '?' in the shortcut registry
  useEffect(() => {
    return registerShortcut({
      keys: '?',
      description: 'Show keyboard shortcuts',
      handler: () => {
        setInternalIsOpen((prev) => !prev);
      },
    });
  }, []);

  // Listen for programmatic open requests from CommandPalette or other actions
  useEffect(() => {
    const handleOpen = () => setInternalIsOpen(true);
    window.addEventListener('disciplr:open-shortcuts', handleOpen);
    return () => window.removeEventListener('disciplr:open-shortcuts', handleOpen);
  }, []);

  const displayShortcuts = useMemo(() => {
    if (shortcuts !== undefined) return shortcuts;
    const registered = getRegisteredShortcuts();
    const seen = new Set<string>();
    const list: ShortcutEntry[] = [];
    for (const s of registered) {
      if (!seen.has(s.key)) {
        seen.add(s.key);
        list.push(s);
      }
    }
    for (const s of SHORTCUTS) {
      if (!seen.has(s.key)) {
        seen.add(s.key);
        list.push(s);
      }
    }
    return list;
  }, [shortcuts]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => (onClose ? onClose() : setInternalIsOpen(false))}
      ariaLabelledBy={titleId}
      ariaDescribedBy={descId}
      contentClassName="modal-content-default rounded-xl max-w-md w-full overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <Text role="subtitle" as="h2" id={titleId}>
          Keyboard Shortcuts
        </Text>
        <button
          type="button"
          aria-label="Close keyboard shortcuts"
          onClick={() => (onClose ? onClose() : setInternalIsOpen(false))}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md p-1 transition-colors"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="px-6 py-4" id={descId}>
        {displayShortcuts.length === 0 ? (
          <Text role="body" as="p" className="text-gray-500">
            No shortcuts registered.
          </Text>
        ) : (
          <table className="w-full" aria-label="Keyboard shortcuts">
            <tbody>
              {displayShortcuts.map(({ key, description }: ShortcutEntry) => (
                <tr
                  key={key}
                  className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <td className="py-2 pr-6 w-24">
                    <kbd className="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-mono text-sm">
                      {key}
                    </kbd>
                  </td>
                  <td className="py-2">
                    <Text role="body" as="span">
                      {description}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}
