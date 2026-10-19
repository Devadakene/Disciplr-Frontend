import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Text } from "../components/Text";
import VaultCard from "../components/VaultCard";
import { listVaults } from "../services/vaultService";
import { timelineProgress } from "../utils/vaultLifecycle";
import type { Vault, VaultStatus } from "../types/vault";

const FILTERS: Array<"all" | VaultStatus> = ["all", "active", "completed", "failed"];

/** All vaults, filterable by status. Data comes from the API when VITE_API is set. */
export default function Vaults() {
  const [vaults, setVaults] = useState<Vault[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | VaultStatus>("all");

  useEffect(() => {
    let cancelled = false;
    listVaults()
      .then((v) => !cancelled && setVaults(v))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load vaults."));
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(
    () => (vaults ?? []).filter((v) => filter === "all" || v.status === filter),
    [vaults, filter],
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--spacing-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Text role="title" as="h1">Vaults</Text>
        <Link to="/vaults/create" className="header-link header-cta">Create Vault</Link>
      </div>
      <div role="tablist" aria-label="Filter by status" style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 999, cursor: "pointer", textTransform: "capitalize",
              border: "1px solid var(--border, #8884)", font: "inherit",
              background: filter === f ? "var(--accent)" : "transparent",
              color: filter === f ? "#fff" : "inherit",
            }}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {!vaults && !error && <p aria-live="polite">Loading vaults...</p>}
      {vaults && shown.length === 0 && (
        <p>No vaults here yet. <Link to="/vaults/create">Create your first vault</Link>.</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {shown.map((v) => (
          <VaultCard
            key={v.id}
            id={v.id}
            name={v.name}
            amount={v.amount}
            currency={v.currency}
            status={v.status}
            deadline={v.deadline}
            progressPct={
              v.milestones.length
                ? Math.round((v.milestones.filter((m) => m.status === "validated").length / v.milestones.length) * 100)
                : timelineProgress(v.createdAt, v.deadline)
            }
            linkTo={`/vaults/${v.id}`}
          />
        ))}
      </div>
    </div>
  );
}
