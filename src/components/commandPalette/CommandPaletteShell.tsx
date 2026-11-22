import { useEffect, useRef } from "react";
import FocusTrap from "focus-trap-react";
import { Search, X } from "lucide-react";
import { duration } from "../../utils/motion";
import { usePrefersReducedMotion } from "../../utils/usePrefersReducedMotion";
import type { UseCommandPaletteResult } from "../../hooks/useCommandPalette";
import PaletteResults from "./PaletteResults";

interface CommandPaletteShellProps {
  palette: UseCommandPaletteResult;
}

export default function CommandPaletteShell({ palette }: CommandPaletteShellProps) {
  const {
    isOpen,
    open,
    close,
    query,
    setQuery,
    results,
    activeIndex,
    setActiveIndex,
    isLoadingVaults,
    runItem,
    handleKeyDown,
  } = palette;
  const prefersReducedMotion = usePrefersReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open command palette"
        className="header-link"
        onClick={open}
        style={{ border: "none", background: "transparent", cursor: "pointer" }}
      >
        <Search size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <FocusTrap
          focusTrapOptions={{
            allowOutsideClick: true,
            clickOutsideDeactivates: false,
            escapeDeactivates: false,
            fallbackFocus: () => dialogRef.current ?? document.body,
            initialFocus: "#command-palette-input",
            returnFocusOnDeactivate: false,
          }}
        >
          <div
            role="presentation"
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: "var(--z-index-modal, 1000)",
              background: "var(--overlay-backdrop)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "12vh 1rem 1rem",
              transition: prefersReducedMotion
                ? "none"
                : `opacity ${duration.normal}s ease`,
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="command-palette-title"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleKeyDown}
              style={{
                width: "min(640px, 100%)",
                maxHeight: "min(70vh, 640px)",
                overflow: "hidden",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "var(--shadow-level-5)",
                transform: "translateY(0)",
                transition: prefersReducedMotion
                  ? "none"
                  : `transform ${duration.normal}s ease`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.875rem 1rem",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Search size={18} aria-hidden="true" />
                <label id="command-palette-title" htmlFor="command-palette-input">
                  Search vaults and actions
                </label>
                <button
                  type="button"
                  aria-label="Close command palette"
                  onClick={close}
                  style={{
                    marginLeft: "auto",
                    border: "none",
                    background: "transparent",
                    color: "var(--muted)",
                    cursor: "pointer",
                    minHeight: "var(--touch-target)",
                    minWidth: "var(--touch-target)",
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <input
                id="command-palette-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a vault name, id, or action"
                aria-controls="command-palette-results"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-activedescendant={
                  results[activeIndex]
                    ? `command-palette-option-${activeIndex}`
                    : undefined
                }
                style={{
                  width: "100%",
                  border: "none",
                  borderBottom: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  padding: "0.875rem 1rem",
                  font: "inherit",
                  outline: "none",
                }}
              />
              <PaletteResults
                results={results}
                activeIndex={activeIndex}
                isLoading={isLoadingVaults}
                onActiveIndexChange={setActiveIndex}
                onSelect={runItem}
              />
            </div>
          </div>
        </FocusTrap>
      )}
    </>
  );
}
