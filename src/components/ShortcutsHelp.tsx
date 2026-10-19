import { useState, useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Modal';
import { Text } from './Text';
import { SHORTCUTS, type ShortcutEntry } from '@/utils/shortcuts';

function isEditableTarget(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  // Fallback: check the raw attribute for environments where isContentEditable
  // doesn't reflect React-set values (e.g. jsdom).
  const ce = element.getAttribute('contenteditable');
  return ce !== null && ce !== 'false';
}

interface ShortcutsHelpProps {
  shortcuts?: ShortcutEntry[];
}

export function ShortcutsHelp({ shortcuts = SHORTCUTS }: ShortcutsHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const target = e.target instanceof Element ? e.target : null;
      if (isEditableTarget(target) || isEditableTarget(document.activeElement)) return;
      e.preventDefault();
      setIsOpen(prev => !prev);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
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
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md p-1 transition-colors"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="px-6 py-4" id={descId}>
        {shortcuts.length === 0 ? (
          <Text role="body" as="p" className="text-gray-500">
            No shortcuts registered.
          </Text>
        ) : (
          <table className="w-full" aria-label="Keyboard shortcuts">
            <tbody>
              {shortcuts.map(({ key, description }: ShortcutEntry) => (
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
