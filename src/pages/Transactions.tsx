import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Text } from "../components/Text";
import { listAllActivity, type VaultActivityRecord } from "../services/vaultService";

const LABEL: Record<VaultActivityRecord["type"], string> = {
  create: "Vault created",
  validate: "Milestone validated",
  release: "Funds released",
  redirect: "Funds redirected",
};

/** Activity feed across all vaults. */
export default function Transactions() {
  const [rows, setRows] = useState<VaultActivityRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAllActivity()
      .then((r) => !cancelled && setRows([...r].sort((a, b) => +b.timestamp - +a.timestamp)))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Could not load activity."));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--spacing-4)" }}>
      <Text role="title" as="h1">Transactions</Text>
      <p style={{ color: "var(--muted)" }}>Every create, validate, release and redirect across your vaults.</p>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && <p aria-live="polite">Loading activity...</p>}
      {rows && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: 8 }}>When</th>
                <th style={{ padding: 8 }}>Event</th>
                <th style={{ padding: 8 }}>Vault</th>
                <th style={{ padding: 8, textAlign: "right" }}>Amount (USDC)</th>
                <th style={{ padding: 8 }}>Hash</th>
                <th style={{ padding: 8 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border, #8883)" }}>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{r.timestamp.toLocaleString()}</td>
                  <td style={{ padding: 8 }}>{LABEL[r.type] ?? r.type}</td>
                  <td style={{ padding: 8 }}>{r.vault}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>{r.amount.toLocaleString()}</td>
                  <td style={{ padding: 8, fontFamily: "monospace" }}>{r.hash.slice(0, 10)}...</td>
                  <td style={{ padding: 8 }}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p>No activity yet. <Link to="/vaults/create">Create a vault</Link>.</p>}
        </div>
      )}
    </div>
  );
}
