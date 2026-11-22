import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Text } from "../components/Text";
import VaultCard from "../components/VaultCard";
import { Pagination } from "../components/Pagination";
import { WalletConnectButton } from "../components/Wallet/WalletConnectButton";
import { useWallet } from "../context/WalletContext";
import { listVaults } from "../services/vaultService";
import { vaultProgressPct } from "../utils/vaultLifecycle";
import { paginate } from "../utils/paginate";
import {
  parseVaultsQuery,
  serializeVaultsQuery,
  filterVaults,
  sortVaults,
  VALID_SCOPES,
  VALID_STATUSES,
  VALID_SORTS,
  PAGE_SIZE,
  type VaultScope,
  type VaultSort,
  type VaultStatusFilter,
} from "../utils/vaultsQuery";
import type { Vault } from "../types/vault";
import { useOnRecovered } from "../hooks/useOnRecovered";
import { useT, type MessageKey } from "../i18n";

const SCOPE_LABEL_KEYS: Record<VaultScope, MessageKey> = {
  all: "vaults.scope.all",
  mine: "vaults.scope.mine",
  verifying: "vaults.scope.verifying",
};

const SORT_LABEL_KEYS: Record<VaultSort, MessageKey> = {
  "-created": "vaults.sort.newest",
  created: "vaults.sort.oldest",
  deadline: "vaults.sort.deadlineSoonest",
  "-deadline": "vaults.sort.deadlineLatest",
  "-amount": "vaults.sort.amountHighToLow",
  amount: "vaults.sort.amountLowToHigh",
};

const STATUS_LABEL_KEYS: Record<VaultStatusFilter, MessageKey> = {
  all: "vaults.status.all",
  active: "vaults.status.active",
  pending_validation: "vaults.status.pending_validation",
  completed: "vaults.status.completed",
  failed: "vaults.status.failed",
  cancelled: "vaults.status.cancelled",
};

export default function Vaults() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const { address, sessionStatus, connectDemo, isConnecting } = useWallet();

  const queryState = useMemo(() => parseVaultsQuery(searchParams), [searchParams]);
  const { scope, status, q, sort, page } = queryState;

  const [vaults, setVaults] = useState<Vault[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  // Search input with 200ms debounce
  const [searchInput, setSearchInput] = useState(q);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const updateQueryParams = useCallback(
    (updates: Partial<typeof queryState>) => {
      const nextState = { ...queryState, ...updates };
      const nextParams = serializeVaultsQuery(nextState);
      setSearchParams(nextParams);
    },
    [queryState, setSearchParams],
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateQueryParams({ q: value, page: 1 });
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const isWalletConnected = Boolean(address?.trim()) && sessionStatus === "authenticated";
  const normalizedUserAddress = isWalletConnected ? address?.trim() : null;
  const requiresWallet = scope === "mine" || scope === "verifying";

  // Data fetching
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // listVaults has no creator filter; scope ("mine"/"verifying") is applied
    // client-side by filterVaults below.
    listVaults()
      .then((loaded) => {
        if (!cancelled) {
          setVaults(loaded);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load vaults.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scope, normalizedUserAddress, reloadToken]);

  const retry = () => {
    setReloadToken((prev) => prev + 1);
  };

  // Filter and sort
  const filteredVaults = useMemo(() => {
    if (!vaults) return [];
    if (requiresWallet && !isWalletConnected) return [];
    return filterVaults(vaults, {
      scope,
      status,
      q,
      userAddress: normalizedUserAddress,
    });
  }, [vaults, requiresWallet, isWalletConnected, scope, status, q, normalizedUserAddress]);

  const sortedVaults = useMemo(() => {
    return sortVaults(filteredVaults, sort);
  }, [filteredVaults, sort]);

  // Paginate with clamping
  const paginationResult = useMemo(() => {
    return paginate(sortedVaults, page, PAGE_SIZE);
  }, [sortedVaults, page]);

  // Clamp page in URL if requested page exceeds valid page count after filtering
  useEffect(() => {
    if (sortedVaults.length > 0 && page > paginationResult.pageCount) {
      updateQueryParams({ page: paginationResult.pageCount });
    }
  }, [sortedVaults.length, page, paginationResult.pageCount, updateQueryParams]);

  // Tab navigation with keyboard (arrow keys, Home, End)
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const count = VALID_STATUSES.length;
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % count;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + count) % count;
    } else if (event.key === "Home") {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      nextIndex = count - 1;
    } else {
      return;
    }

    const nextStatus = VALID_STATUSES[nextIndex];
    updateQueryParams({ status: nextStatus, page: 1 });
    tabButtonRefs.current[nextIndex]?.focus();
  };

  // Refetch automatically when connectivity recovers.
  useOnRecovered(retry);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--spacing-4)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <Text role="title" as="h1">{t("vaults.title")}</Text>
          <Text role="body" as="p" style={{ color: "var(--muted)", margin: "4px 0 0" }}>
            {t("vaults.subtitle")}
          </Text>
        </div>
        <Link to="/vaults/create" className="header-link header-cta">{t("vaults.createCta")}</Link>
      </div>

      {/* Scope Selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {VALID_SCOPES.map((s) => {
          const isSelected = scope === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => updateQueryParams({ scope: s, page: 1 })}
              aria-pressed={isSelected}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius)",
                fontWeight: isSelected ? 600 : 500,
                fontSize: 14,
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: isSelected ? "var(--surface)" : "transparent",
                color: isSelected ? "var(--text)" : "var(--muted)",
                boxShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {t(SCOPE_LABEL_KEYS[s])}
            </button>
          );
        })}
      </div>

      {/* Search & Sort Bar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ flex: "1 1 260px" }}>
          <label htmlFor="vault-search-input" className="sr-only">{t("vaults.search.label")}</label>
          <input
            id="vault-search-input"
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("vaults.search.placeholder")}
            aria-label={t("vaults.search.ariaLabel")}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              font: "inherit",
              fontSize: 14,
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="vault-sort-select" style={{ fontSize: 14, color: "var(--muted)" }}>
            {t("vaults.sort.label")}
          </label>
          <select
            id="vault-sort-select"
            value={sort}
            onChange={(e) => updateQueryParams({ sort: e.target.value as VaultSort, page: 1 })}
            aria-label={t("vaults.sort.ariaLabel")}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              font: "inherit",
              fontSize: 14,
            }}
          >
            {VALID_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(SORT_LABEL_KEYS[s])}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div
        role="tablist"
        aria-label={t("vaults.status.tablistAria")}
        style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}
      >
        {VALID_STATUSES.map((st, idx) => {
          const isSelected = status === st;
          return (
            <button
              key={st}
              ref={(el) => {
                tabButtonRefs.current[idx] = el;
              }}
              id={`vaults-tab-${st}`}
              role="tab"
              aria-selected={isSelected}
              aria-controls="vaults-tabpanel"
              tabIndex={isSelected ? 0 : -1}
              onClick={() => updateQueryParams({ status: st, page: 1 })}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                cursor: "pointer",
                border: "1px solid var(--border, #8884)",
                font: "inherit",
                fontSize: 13,
                background: isSelected ? "var(--accent)" : "transparent",
                color: isSelected ? "#fff" : "inherit",
              }}
            >
              {t(STATUS_LABEL_KEYS[st])}
            </button>
          );
        })}
      </div>

      {/* Main Tabpanel */}
      <div
        id="vaults-tabpanel"
        role="tabpanel"
        aria-labelledby={`vaults-tab-${status}`}
      >
        {/* Error State with Retry */}
        {error && (
          <div
            role="alert"
            style={{
              padding: "2rem 1rem",
              textAlign: "center",
              background: "var(--danger-transparent, #fff5f5)",
              border: "1px solid var(--danger, #e53e3e)",
              borderRadius: "var(--radius)",
              color: "var(--danger, #e53e3e)",
              margin: "16px 0",
            }}
          >
            <p style={{ margin: "0 0 12px" }}>{error}</p>
            <button
              type="button"
              onClick={retry}
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              {t("vaults.retry")}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <p aria-live="polite" style={{ color: "var(--muted)", margin: "24px 0" }}>
            {t("vaults.loading")}
          </p>
        )}

        {/* Wallet Connect Prompt when scope requires wallet */}
        {!loading && !error && requiresWallet && !isWalletConnected && (
          <div
            role="main"
            aria-labelledby="connect-wallet-heading"
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              margin: "16px 0",
            }}
          >
            <h2 id="connect-wallet-heading" style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>
              Connect your wallet
            </h2>
            <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
              You need a connected wallet to view {scope === "mine" ? "your created vaults" : "vaults you verify"}.
            </p>
            {isConnecting && <p aria-live="polite">Connecting…</p>}
            <div style={{ display: "inline-block" }}>
              <WalletConnectButton />
            </div>
            <p style={{ marginTop: "1rem" }}>
              No Freighter wallet?{" "}
              <button
                type="button"
                onClick={connectDemo}
                style={{
                  background: "none",
                  border: 0,
                  color: "var(--accent)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                Try the demo account
              </button>
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && (!requiresWallet || isWalletConnected) && filteredVaults.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
            <p style={{ margin: "0 0 8px" }}>{t("vaults.empty.message")}</p>
            <p>
              <Link to="/vaults/create" style={{ color: "var(--accent)" }}>
                {t("vaults.empty.cta")}
              </Link>
            </p>
          </div>
        )}

        {/* Vault Grid */}
        {!loading && !error && (!requiresWallet || isWalletConnected) && filteredVaults.length > 0 && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {paginationResult.items.map((v) => (
                <VaultCard
                  key={v.id}
                  id={v.id}
                  name={v.name}
                  amount={v.amount}
                  currency={v.currency}
                  status={v.status}
                  deadline={v.deadline}
                  progressPct={vaultProgressPct(v)}
                  linkTo={`/vaults/${v.id}`}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {paginationResult.pageCount > 1 && (
              <div style={{ marginTop: 24 }}>
                <Pagination
                  pagination={paginationResult}
                  onPageChange={(newPage) => updateQueryParams({ page: newPage })}
                  ariaLabel={t("vaults.paginationAria")}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
