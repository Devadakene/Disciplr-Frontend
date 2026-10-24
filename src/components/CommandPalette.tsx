import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import FocusTrap from "focus-trap-react";
import { listVaults } from "../services/vaultService";
import type { Vault } from "../types/vault";
import { scoreMatch, type MatchResult } from "../utils/commandPalette";
import { duration } from "../utils/motion";
import { usePrefersReducedMotion } from "../utils/usePrefersReducedMotion";
import { useTheme } from "../context/ThemeContext";
import { registerShortcut } from "../utils/shortcutRegistry";
import { formatUsdc } from "../utils/format";

const RECENTS_STORAGE_KEY = "disciplr:palette:recent:v1";

export type CommandGroup = "Recent" | "Navigation" | "Vaults" | "Actions";

export interface CommandItem {
  id: string;
  label: string;
  description: string;
  to?: string;
  kind?: "action" | "vault";
  group: CommandGroup;
  keywords?: string[];
  perform?: () => void | Promise<void>;
}

interface CommandPaletteProps {
  loadVaults?: () => Promise<Vault[]>;
}

const STATIC_COMMANDS: CommandItem[] = [
  {
    id: "action-dashboard",
    label: "Dashboard",
    description: "View vault summary and stats",
    to: "/dashboard",
    group: "Navigation",
    keywords: ["home", "stats", "summary"],
  },
  {
    id: "action-vaults",
    label: "Vaults",
    description: "Browse all vaults",
    to: "/vaults",
    group: "Navigation",
    keywords: ["browse", "list", "all"],
  },
  {
    id: "action-create-vault",
    label: "Create Vault",
    description: "Start a new vault",
    to: "/vaults/create",
    group: "Actions",
    keywords: ["new", "start", "cv"],
  },
  {
    id: "action-verifier-queue",
    label: "Verifier Queue",
    description: "Review pending validations",
    to: "/verifier/queue",
    group: "Navigation",
    keywords: ["validations", "pending", "review"],
  },
  {
    id: "action-verifier-history",
    label: "Verifier History",
    description: "View completed verifications",
    to: "/verifier/history",
    group: "Navigation",
    keywords: ["validations", "history", "past", "completed"],
  },
  {
    id: "action-analytics",
    label: "Analytics",
    description: "Open vault analytics",
    to: "/analytics",
    group: "Navigation",
    keywords: ["stats", "metrics", "charts"],
  },
  {
    id: "action-transactions",
    label: "Transactions",
    description: "View transaction activity",
    to: "/transactions",
    group: "Navigation",
    keywords: ["history", "activity", "txs", "tx"],
  },
  {
    id: "action-notifications",
    label: "Notifications",
    description: "View alerts and notifications",
    to: "/notifications",
    group: "Navigation",
    keywords: ["alerts", "updates"],
  },
  {
    id: "action-notification-settings",
    label: "Notification Settings",
    description: "Configure notification preferences",
    to: "/notifications/settings",
    group: "Navigation",
    keywords: ["alerts", "preferences", "config", "settings"],
  },
  {
    id: "action-help",
    label: "Help",
    description: "Open the help center",
    to: "/help",
    group: "Navigation",
    keywords: ["support", "faq", "help center"],
  },
  {
    id: "action-docs",
    label: "Docs",
    description: "View documentation",
    to: "/docs",
    group: "Navigation",
    keywords: ["documentation", "guide", "api"],
  },
];

// Session cache for vaults to prevent re-fetching on every open
let sessionVaultsCache: Vault[] | null = null;

export function _resetVaultSessionCacheForTesting(): void {
  sessionVaultsCache = null;
}

function getStoredRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === "string");
    }
  } catch {
    // ignore parsing errors
  }
  return [];
}

function saveRecentId(id: string): void {
  try {
    const recents = getStoredRecentIds().filter((rId) => rId !== id);
    recents.unshift(id);
    const trimmed = recents.slice(0, 5);
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage errors
  }
}

function vaultToCommand(vault: Vault): CommandItem {
  return {
    id: `vault-${vault.id}`,
    label: vault.name,
    description: `Vault ${vault.id} · ${formatUsdc(vault.amount)} ${vault.currency}`,
    to: `/vaults/${vault.id}`,
    group: "Vaults",
    kind: "vault",
    keywords: [vault.id, `${vault.amount}`, vault.currency],
  };
}

function HighlightedText({
  text,
  ranges,
}: {
  text: string;
  ranges?: [number, number][];
}) {
  if (!ranges || ranges.length === 0) {
    return <>{text}</>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(
      <mark
        key={i}
        style={{
          backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
          color: "inherit",
          fontWeight: 700,
          padding: "0 1px",
          borderRadius: "2px",
        }}
      >
        {text.slice(start, end)}
      </mark>,
    );
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

export default function CommandPalette({
  loadVaults = listVaults,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [vaults, setVaults] = useState<Vault[]>(sessionVaultsCache ?? []);
  const [isLoadingVaults, setIsLoadingVaults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Optional ThemeContext integration (safe fallback if outside provider in tests)
  let toggleTheme: (() => void) | undefined;
  try {
    const themeContext = useTheme();
    toggleTheme = themeContext.toggleTheme;
  } catch {
    // theme toggle not available
  }

  const close = useCallback(() => {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const open = useCallback(() => {
    triggerRef.current?.focus();
    setIsOpen(true);
  }, []);

  // Register mod+k global shortcut
  useEffect(() => {
    return registerShortcut({
      keys: "mod+k",
      description: "Open the command palette",
      handler: () => open(),
    });
  }, [open]);

  // Load vaults on open with session caching
  useEffect(() => {
    if (!isOpen) return;

    if (sessionVaultsCache !== null) {
      setVaults(sessionVaultsCache);
      return;
    }

    let cancelled = false;
    setIsLoadingVaults(true);

    loadVaults()
      .then((nextVaults) => {
        if (!cancelled) {
          sessionVaultsCache = nextVaults;
          setVaults(nextVaults);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVaults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingVaults(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, loadVaults]);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  // Dynamic actions like Toggle Theme & Keyboard Shortcuts
  const dynamicActions: CommandItem[] = useMemo(() => {
    const actions: CommandItem[] = [];

    if (toggleTheme) {
      actions.push({
        id: "action-theme-toggle",
        label: "Toggle Theme",
        description: "Switch between light, dark, and system themes",
        group: "Actions",
        keywords: ["dark", "light", "mode", "color", "theme", "appearance"],
        perform: () => {
          toggleTheme();
        },
      });
    }

    actions.push({
      id: "action-shortcuts-help",
      label: "Keyboard Shortcuts",
      description: "Show all keyboard shortcuts",
      group: "Actions",
      keywords: ["hotkeys", "shortcuts", "keybindings", "keys"],
      perform: () => {
        window.dispatchEvent(new CustomEvent("disciplr:open-shortcuts"));
      },
    });

    return actions;
  }, [toggleTheme]);

  // All available base commands
  const allBaseCommands = useMemo(() => {
    const vaultCommands = vaults.map(vaultToCommand);
    return [...STATIC_COMMANDS, ...dynamicActions, ...vaultCommands];
  }, [dynamicActions, vaults]);

  // Filtered and ranked items
  interface ScoredItem {
    item: CommandItem;
    score: number;
    labelRanges?: [number, number][];
    descRanges?: [number, number][];
  }

  const itemsWithHighlights = useMemo(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      // With an empty query: validate recents and show them first
      const recentIds = getStoredRecentIds();
      const commandsById = new Map<string, CommandItem>();
      allBaseCommands.forEach((cmd) => commandsById.set(cmd.id, cmd));

      const recentItems: ScoredItem[] = [];
      const usedIds = new Set<string>();

      for (const id of recentIds) {
        const cmd = commandsById.get(id);
        if (cmd) {
          usedIds.add(id);
          recentItems.push({
            item: { ...cmd, group: "Recent" },
            score: 0,
          });
        }
      }

      // Append remaining base commands
      const remainingItems: ScoredItem[] = [];
      for (const cmd of allBaseCommands) {
        if (!usedIds.has(cmd.id)) {
          remainingItems.push({ item: cmd, score: 0 });
        }
      }

      return [...recentItems, ...remainingItems];
    }

    // When query is non-empty, score each item
    const scored: ScoredItem[] = [];

    for (const item of allBaseCommands) {
      // 1. Label match (weight: 1.0)
      const labelMatch = scoreMatch(trimmedQuery, item.label);
      let bestScore = labelMatch ? labelMatch.score * 1.0 : -Infinity;
      const labelRanges = labelMatch?.ranges;

      // 2. Keywords match (weight: 0.8)
      if (item.keywords) {
        for (const kw of item.keywords) {
          const kwMatch = scoreMatch(trimmedQuery, kw);
          if (kwMatch) {
            const kwScore = kwMatch.score * 0.8;
            if (kwScore > bestScore) {
              bestScore = kwScore;
            }
          }
        }
      }

      // 3. Description match (weight: 0.4)
      const descMatch = scoreMatch(trimmedQuery, item.description);
      const descRanges = descMatch?.ranges;
      if (descMatch) {
        const descScore = descMatch.score * 0.4;
        if (descScore > bestScore) {
          bestScore = descScore;
        }
      }

      if (bestScore > -Infinity) {
        scored.push({
          item,
          score: bestScore,
          labelRanges,
          descRanges,
        });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [allBaseCommands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [itemsWithHighlights.length, query]);

  const runItem = useCallback(
    (item: CommandItem) => {
      saveRecentId(item.id);
      if (item.perform) {
        item.perform();
      } else if (item.to) {
        navigate(item.to);
      }
      close();
    },
    [close, navigate],
  );

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (itemsWithHighlights.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % itemsWithHighlights.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) =>
          (current - 1 + itemsWithHighlights.length) %
          itemsWithHighlights.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (itemsWithHighlights[activeIndex]) {
        runItem(itemsWithHighlights[activeIndex].item);
      }
    }
  };

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
                <label
                  id="command-palette-title"
                  htmlFor="command-palette-input"
                >
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
                  itemsWithHighlights[activeIndex]
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

              <div
                id="command-palette-results"
                role="listbox"
                aria-label="Command palette results"
                style={{
                  maxHeight: "420px",
                  overflowY: "auto",
                  padding: "0.5rem",
                }}
              >
                {isLoadingVaults && vaults.length === 0 && (
                  <div
                    role="status"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.75rem 1rem",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                  >
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Loading vaults...</span>
                  </div>
                )}

                {itemsWithHighlights.length === 0 && !isLoadingVaults ? (
                  <p
                    role="status"
                    style={{
                      margin: 0,
                      padding: "1rem",
                      color: "var(--muted)",
                    }}
                  >
                    No matching vaults or actions.
                  </p>
                ) : (
                  itemsWithHighlights.map(({ item, labelRanges, descRanges }, index) => (
                    <button
                      key={item.id}
                      id={`command-palette-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runItem(item)}
                      style={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "0.25rem",
                        border: "none",
                        borderRadius: "var(--radius)",
                        background:
                          index === activeIndex
                            ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                            : "transparent",
                        color: "var(--text)",
                        cursor: "pointer",
                        padding: "0.75rem",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>
                          <HighlightedText text={item.label} ranges={labelRanges} />
                        </span>
                        {item.group && (
                          <span
                            style={{
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "var(--muted)",
                              opacity: 0.8,
                            }}
                          >
                            {item.group}
                          </span>
                        )}
                      </div>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>
                        <HighlightedText
                          text={item.description}
                          ranges={descRanges}
                        />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </FocusTrap>
      )}
    </>
  );
}
