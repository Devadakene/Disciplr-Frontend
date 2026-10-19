import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import NavLink from './NavLink';
import { WalletConnectButton } from './Wallet/WalletConnectButton';
import { toCloseHandler, toDrawerOpen } from '../utils/drawerState';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  // Boundary validation: coerce hostile props so a non-boolean `isOpen` or a
  // missing/non-function `onClose` can never render a contradictory drawer or
  // crash on interaction. Only the literal boolean `true` opens the drawer.
  // Memoized so the identity is stable as long as `onClose` is — the Escape
  // effect below depends on it and must not re-subscribe on every render.
  const open = toDrawerOpen(isOpen);
  const handleClose = useMemo(() => toCloseHandler(onClose) ?? (() => {}), [onClose]);

  useEffect(() => {
    if (!open) {
      // Reset so the next open cycle re-captures the focus trigger.
      wasOpenRef.current = false;
      return;
    }

    // Capture the focus trigger once per open cycle. Re-running this effect
    // (e.g. because a parent re-render changed the `onClose` identity) must
    // not overwrite the trigger with whatever element currently has focus —
    // which would be inside the drawer and break focus restoration on close.
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      const trigger = triggerRef.current;
      // Recovery: only restore focus when the trigger is still connected. If
      // it was removed mid-interaction (e.g. an interrupted navigation), skip
      // the restore so focus never lands on a detached node.
      if (trigger && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;

    // Scroll lock, applied atomically with the open state. Save the previous
    // value so cleanup restores the exact prior style instead of clobbering
    // unrelated page styles with ''.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <FocusTrap
      focusTrapOptions={{
        allowOutsideClick: true,
        clickOutsideDeactivates: false,
        escapeDeactivates: false,
        fallbackFocus: () => drawerRef.current ?? document.body,
        initialFocus: () =>
          drawerRef.current?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ) ?? drawerRef.current ?? document.body,
        returnFocusOnDeactivate: false,
      }}
    >
      <div className="mobile-drawer-backdrop" onClick={handleClose}>
        <nav
          className="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-drawer-title"
          id="mobile-drawer"
          ref={drawerRef}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="mobile-drawer-title" className="mobile-drawer-title">
            Navigation
          </h2>
          <button className="mobile-drawer-close" onClick={handleClose} aria-label="Close navigation drawer">
            <X size={24} />
          </button>
          <NavLink to="/" className="mobile-drawer-link" onClick={handleClose}>
            Home
          </NavLink>
          <NavLink to="/transactions" className="mobile-drawer-link" onClick={handleClose}>
            Transactions
          </NavLink>
          <NavLink to="/dashboard" className="mobile-drawer-link" onClick={handleClose}>
            Dashboard
          </NavLink>
          <NavLink to="/vaults" className="mobile-drawer-link" onClick={handleClose}>
            Vaults
          </NavLink>
          <NavLink to="/verifier" className="mobile-drawer-link" onClick={handleClose}>
            Verifier
          </NavLink>
          <NavLink to="/analytics" className="mobile-drawer-link" onClick={handleClose}>
            Analytics
          </NavLink>
          <NavLink to="/vaults/create" className="mobile-drawer-link" onClick={handleClose}>
            Create Vault
          </NavLink>
          <WalletConnectButton />
        </nav>
      </div>
    </FocusTrap>
  );
}
