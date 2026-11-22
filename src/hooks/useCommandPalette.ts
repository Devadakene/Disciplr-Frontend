import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useOptionalWallet } from "../context/WalletContext";
import { listVaults } from "../services/vaultService";
import type { Vault } from "../types/vault";
import { rankPaletteItems, type PaletteItem, type RankedPaletteItem } from "../utils/commandPalette";
import { getActionCommands, getNavigationCommands, getVaultCommands } from "../utils/commandPaletteProviders";
import { clearRecentCommands, getRecentCommandIds, rememberRecentCommand } from "../utils/commandPaletteRecents";
import { registerShortcut } from "../utils/shortcutRegistry";

export interface UseCommandPaletteOptions {
  loadVaults?: () => Promise<Vault[]>;
  toggleTheme?: () => void;
}

export interface UseCommandPaletteResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  query: string;
  setQuery: (query: string) => void;
  results: RankedPaletteItem[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  isLoadingVaults: boolean;
  runItem: (item: PaletteItem) => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}

let sessionVaultsCache: Vault[] | null = null;

export function _resetVaultSessionCacheForTesting(): void {
  sessionVaultsCache = null;
}

export function useCommandPalette({
  loadVaults = listVaults,
  toggleTheme,
}: UseCommandPaletteOptions = {}): UseCommandPaletteResult {
  const navigate = useNavigate();
  const wallet = useOptionalWallet();
  const walletAddress = wallet?.address ?? null;
  const previousWalletAddress = useRef(walletAddress);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [vaults, setVaults] = useState<Vault[]>(sessionVaultsCache ?? []);
  const [isLoadingVaults, setIsLoadingVaults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentCommandIds());

  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);

  useEffect(() => {
    return registerShortcut({
      keys: "mod+k",
      description: "Open the command palette",
      handler: open,
    });
  }, [open]);

  useEffect(() => {
    if (previousWalletAddress.current !== null && walletAddress === null) {
      clearRecentCommands();
      setRecentIds([]);
    }
    previousWalletAddress.current = walletAddress;
  }, [walletAddress]);

  useEffect(() => {
    if (!isOpen) return;
    setRecentIds(getRecentCommandIds());

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
        if (!cancelled) setVaults([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVaults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, loadVaults]);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const allItems = useMemo(
    () => [
      ...getNavigationCommands(),
      ...getActionCommands(toggleTheme),
      ...getVaultCommands(vaults),
    ],
    [toggleTheme, vaults],
  );
  const results = useMemo(
    () => rankPaletteItems(allItems, query, recentIds),
    [allItems, query, recentIds],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results]);

  const runItem = useCallback(
    (item: PaletteItem) => {
      setRecentIds(rememberRecentCommand(item.id));
      if (item.perform) {
        item.perform();
      } else if (item.to) {
        navigate(item.to);
      }
      close();
    },
    [close, navigate],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (results.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % results.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + results.length) % results.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const activeItem = results[activeIndex]?.item;
        if (activeItem) runItem(activeItem);
      }
    },
    [activeIndex, close, results, runItem],
  );

  return {
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
  };
}
