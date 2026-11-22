import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { X, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { Text } from './Text';
import { SafeLink } from './SafeLink';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (decision: 'approve' | 'reject', notes: string) => void;
  initialDecision?: 'approve' | 'reject';
  initialNotes?: string;
  evidenceUrl?: string;
  /** When set, the modal confirms a batch action affecting this many tasks. */
  affectedCount?: number;

  /** Simple confirmation mode — shows a generic title/message with Confirm/Cancel. */
  simpleConfirm?: {
    title: string;
    message: string;
    confirmLabel?: string;
  };

  /** When true, the action is already in flight — the modal locks its
   *  controls so the confirmation can never fire twice. Belt-and-braces
   *  alongside the single-flight guard in the vault service. */
  isSubmitting?: boolean;
}

/**
 * ConfirmationModal component for validation approval/rejection.
 * 
 * Features:
 * - Focus trapping for accessibility
 * - Escape key support
 * - Accessible labels and roles (aria-modal)
 * - Captures verifier notes
 * - States irreversible on-chain consequence
 * - Shows evidence link if present
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  initialDecision,
  initialNotes = '',
  evidenceUrl,
  affectedCount,
  simpleConfirm,
  isSubmitting = false,
}: ConfirmationModalProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(initialDecision || null);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (isOpen) {
      setDecision(initialDecision || null);
      setNotes(initialNotes);
    }
  }, [isOpen, initialDecision, initialNotes]);

  const handleConfirm = () => {
    if (decision) {
      onConfirm(decision, notes);
    }
  };

  const isConfirmDisabled = !decision || (decision === 'reject' && !notes.trim());

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        ariaLabelledBy="modal-title"
        overlayClassName="fixed inset-0 z-[var(--z-index-modal)] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        contentClassName="modal-content-default rounded-xl max-w-lg w-full overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <Text role="title" as="h2" id="modal-title" className="text-gray-900 dark:text-white">
            {simpleConfirm ? simpleConfirm.title : 'Confirm Validation'}
          </Text>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          {simpleConfirm ? (
            <Text role="body" as="p" className="text-gray-700 dark:text-gray-300">
              {simpleConfirm.message}
            </Text>
          ) : (
            <>
              {typeof affectedCount === 'number' && affectedCount > 0 && (
                <div
                  data-testid="batch-affected-count"
                  className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
                >
                  <Text role="body" as="p" className="text-gray-700 dark:text-gray-300">
                    This action will affect <span className="font-bold">{affectedCount}</span>{' '}
                    {affectedCount === 1 ? 'validation' : 'validations'}.
                  </Text>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Text role="body" as="span" className="font-semibold text-gray-700 dark:text-gray-300">
                  Final Decision
                </Text>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setDecision('approve')}
                    disabled={isSubmitting}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      decision === 'approve'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800'
                    }`}
                  >
                    <CheckCircle size={18} />
                    <span className="font-medium">Approve</span>
                  </button>
                  <button
                    onClick={() => setDecision('reject')}
                    disabled={isSubmitting}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      decision === 'reject'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        : 'border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800'
                    }`}
                  >
                    <XCircle size={18} />
                    <span className="font-medium">Reject</span>
                  </button>
                </div>
              </div>

              {decision && (
                <div
                  className={`p-4 rounded-lg flex gap-3 ${
                    decision === 'approve'
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <AlertTriangle className="flex-shrink-0" size={20} />
                  <div>
                    <Text role="caption" as="p" className="font-bold mb-1">
                      {decision === 'approve' ? 'Irreversible Action' : 'Action Notification'}
                    </Text>
                    <Text role="caption" as="p">
                      {decision === 'approve'
                        ? 'Approval will trigger an on-chain transaction to release vault funds. This action cannot be undone.'
                        : 'Rejection will notify the vault owner to revise and resubmit. Funds will remain locked in the vault.'}
                    </Text>
                  </div>
                </div>
              )}

              {evidenceUrl && (
                <div className="flex flex-col gap-2">
                  <Text role="body" as="span" className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                    Review Evidence
                  </Text>
                  <SafeLink
                    href={evidenceUrl}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline w-fit"
                  >
                    <ExternalLink size={14} />
                    View submitted proof
                  </SafeLink>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="modal-notes">
                  <Text role="body" as="span" className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                    Verification Notes {decision === 'reject' && <span className="text-red-500">*</span>}
                  </Text>
                </label>
                <textarea
                  id="modal-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  placeholder={
                    decision === 'reject' ? 'Reason for rejection is required...' : 'Add optional comments for the owner...'
                  }
                  className="w-full min-h-[100px] p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
                {decision === 'reject' && !notes.trim() && (
                  <Text role="caption" as="span" className="text-red-500">
                    Notes are required for rejection.
                  </Text>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={simpleConfirm ? () => onConfirm('approve', '') : handleConfirm}
            disabled={simpleConfirm ? isSubmitting : isConfirmDisabled || isSubmitting}
            className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${
              simpleConfirm
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none'
                : decision === 'approve'
                ? 'bg-green-600 hover:bg-green-700 shadow-green-200 dark:shadow-none'
                : decision === 'reject'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting
              ? 'Submitting…'
              : simpleConfirm
              ? (simpleConfirm.confirmLabel || 'Confirm')
              : `Confirm ${decision ? (decision.charAt(0).toUpperCase() + decision.slice(1)) : ''}`}
          </button>
        </div>
      </Modal>
    );
}
