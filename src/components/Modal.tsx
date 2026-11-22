import React from 'react';
import FocusTrap from 'focus-trap-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  overlayClassName?: string;
  contentClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  ariaLabelledBy,
  ariaDescribedBy,
  overlayClassName = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/[var(--opacity-backdrop)] backdrop-blur-sm",
  contentClassName = "modal-content-default rounded-xl max-w-lg w-full overflow-hidden flex flex-col",
}: ModalProps) {
  const shouldReduceMotion = useReducedMotion();

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const contentVariants = {
    hidden: shouldReduceMotion
      ? { opacity: 0 }
      : { opacity: 0, scale: 0.95, y: 20 },
    visible: shouldReduceMotion
      ? { opacity: 1 }
      : { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <FocusTrap
          focusTrapOptions={{
            allowOutsideClick: true,
            escapeDeactivates: true,
            onDeactivate: onClose,
          }}
        >
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            className={overlayClassName}
            onClick={onClose}
          >
            <motion.div
              variants={contentVariants}
              transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
              className={contentClassName}
              role="dialog"
              aria-modal="true"
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </motion.div>
        </FocusTrap>
      )}
    </AnimatePresence>
  );
}
