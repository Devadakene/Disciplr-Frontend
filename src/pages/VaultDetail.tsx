import { useMemo, useState, useEffect, type ReactNode, type CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { MilestoneTracker } from "../components/MilestoneTracker";
import { VaultProgressBar } from "../components/VaultProgressBar";
import { VaultLifecycle } from "../components/VaultLifecycle";
import { CountdownDeadline } from "../components/CountdownDeadline";
import Breadcrumb from "../components/Breadcrumb";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { FundReleaseStatus } from "../components/FundReleaseStatus";
import { VaultMetaPanel } from "../components/VaultMetaPanel";
import { StatusChip } from "../components/StatusChip";
import { Text } from "../components/Text";
import { useWallet } from "../context/WalletContext";
import type { WalletNetwork } from "../context/WalletContext";
import { WalletConnectButton } from "../components/Wallet/WalletConnectButton";
import { submitVaultAction } from "../services/vaultService";
import { useVaultDetail } from "../hooks/useVaultDetail";
import { useOnRecovered } from "../hooks/useOnRecovered";
import { APP_EXPECTED_NETWORK } from "../utils/networkMismatch";
import { ApiError } from "../services/api";
import { contractExplorerUrl, getExplorerTxUrl, networkLabel } from "../utils/explorer";
import {
  isValidIcsDeadline,
  vaultDeadlineUid,
  vaultToIcsEvents,
  downloadIcsCalendar,
  icsFilename,
  type AlarmPreference,
} from "../utils/ics";
import { truncateMiddle } from "../utils/truncate";
import { createVaultPrefillFromVault } from "../utils/vaultPrefill";
import { timelineProgress } from "../utils/vaultLifecycle";
import {
  VAULT_ACTIONS,
  buildFundReleaseView,
  detectSettlementAnomalies,
  evalVaultActionAuth,
  isApiMode,
  type VaultAction,
  type VaultActionAuth,
} from "../utils/vaultState";
import type { Vault } from "../types/vault";

import { formatDate, formatDateTime, formatUsdc } from "../utils/format";

const TX_LABELS: Record<string, string> = {
  create: "Vault Created",
  validate: "Milestone Validated",
  release: "Funds Released",
  redirect: "Funds Redirected",
};

function fmtDate(iso: string): string {
  return formatDate(iso);
}

function fmtDateTime(iso: string): string {
  return formatDateTime(iso);
}


// ── Section Card ─────────────────────────────────────────────────────────────
function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.25rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Vault action config ───────────────────────────────────────────────────────
const VAULT_ACTION_CONFIG: Record<
  VaultAction,
  { title: string; message: string; confirmLabel: string }
> = {
  validate_milestone: {
    title: "Validate Milestone",
    message:
      "Are you sure you want to validate the current milestone? This will trigger an on-chain transaction to advance the vault. This action cannot be undone.",
    confirmLabel: "Validate",
  },
  extend_deadline: {
    title: "Extend Deadline",
    message:
      "Are you sure you want to extend the vault deadline? The new deadline must be confirmed by all relevant parties before taking effect.",
    confirmLabel: "Extend",
  },
  cancel_vault: {
    title: "Cancel Vault",
    message:
      "Are you sure you want to cancel this vault? Funds will be redirected to the failure destination address. This action cannot be undone.",
    confirmLabel: "Cancel Vault",
  },
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function VaultDetail() {
  const { id } = useParams<{ id: string }>();
  const { view, retry } = useVaultDetail(id);
  const { address, network } = useWallet();

  useOnRecovered(retry);

  switch (view.status) {
    case "loading":
      return <LoadingView />;
    case "invalid-id":
      return <InvalidIdView id={view.id} />;
    case "not-found":
      return <NotFoundView id={view.id} />;
    case "malformed":
      return <MalformedView issues={view.issues} onRetry={retry} />;
    case "error":
      return <ErrorView id={view.id} onRetry={retry} />;
    case "ready":
      return (
        <VaultDetailContent
          vault={view.vault}
          walletAddress={address}
          walletNetwork={network}
          onChanged={retry}
        />
      );
  }
}

// ── Async boundary views ──────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div style={{ maxWidth: "var(--container-detail)", margin: "0 auto", padding: "0 0 3rem" }}>
      <div
        data-testid="vault-detail-loading"
        style={{
          height: 96,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
      <Text role="title" as="h2" style={{ marginBottom: "0.5rem" }}>
        {title}
      </Text>
      <div
        style={{
          color: "var(--muted)",
          marginBottom: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          alignItems: "center",
        }}
      >
        {children}
      </div>
      <Link to="/vaults" style={{ color: "var(--accent)" }}>
        ← Back to Vaults
      </Link>
    </div>
  );
}

export function InvalidIdView({ id }: { id: string }) {
  return (
    <EmptyState title="Invalid vault identifier">
      <Text role="body" as="p" style={{ margin: 0 }}>
        The vault ID "{id}" is not a valid identifier and could not be used.
      </Text>
      <Text role="caption" as="p" style={{ margin: 0 }}>
        Check the link you followed and try again.
      </Text>
    </EmptyState>
  );
}

export function NotFoundView({ id }: { id: string }) {
  return (
    <EmptyState title="Vault not found">
      <Text role="body" as="p" style={{ margin: 0 }}>
        No vault with ID "{id}" exists.
      </Text>
    </EmptyState>
  );
}

function MalformedView({
  issues,
  onRetry,
}: {
  issues: string[];
  onRetry: () => void;
}) {
  return (
    <EmptyState title="Vault data could not be verified">
      <div role="alert" style={{ color: "var(--danger)" }}>
        The vault response failed validation and its state was not rendered.
        {issues.length > 0 && (
          <ul style={{ textAlign: "left", marginTop: "0.5rem" }}>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: "0.5rem",
          background: "transparent",
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          borderRadius: "var(--radius)",
          padding: "0.4rem 0.9rem",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          minHeight: 36,
        }}
      >
        Retry
      </button>
    </EmptyState>
  );
}

function ErrorView({ id, onRetry }: { id: string; onRetry: () => void }) {
  return (
    <EmptyState title="Failed to load vault">
      <Text role="body" as="p" style={{ margin: 0 }}>
        Vault "{id}" could not be loaded right now.
      </Text>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: "transparent",
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          borderRadius: "var(--radius)",
          padding: "0.4rem 0.9rem",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          minHeight: 36,
        }}
      >
        Retry
      </button>
    </EmptyState>
  );
}

// ── Ready content ─────────────────────────────────────────────────────────────
interface VaultDetailContentProps {
  vault: Vault;
  walletAddress: string | null;
  walletNetwork: WalletNetwork | null;
  onChanged?: () => void;
}

function VaultDetailContent({
  vault,
  walletAddress,
  walletNetwork,
  onChanged,
}: VaultDetailContentProps) {
  const { network, connectDemo } = useWallet();

  useEffect(() => {
    if (vault?.name) {
      document.title = `${vault.name} · Disciplr`;
    }
  }, [vault?.name]);

  const [activeAction, setActiveAction] = useState<VaultAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const authResults = useMemo(() => {
    const results = {} as Record<VaultAction, VaultActionAuth>;
    for (const action of VAULT_ACTIONS) {
      results[action] = evalVaultActionAuth({
        action,
        vault,
        walletAddress,
        walletNetwork,
        expectedNetwork: APP_EXPECTED_NETWORK,
        mode: isApiMode() ? "api" : "offline",
      });
    }
    return results;
  }, [vault, walletAddress, walletNetwork]);

  const handleActionClick = (action: VaultAction) => {
    setActiveAction(action);
    setActionError(null);
  };

  const handleModalClose = () => {
    if (isSubmitting) return;
    setActiveAction(null);
    setActionError(null);
  };

  const handleActionConfirm = async () => {
    if (!activeAction || !walletAddress || isSubmitting) return;

    setActionError(null);
    setIsSubmitting(true);
    try {
      await submitVaultAction(activeAction, vault.id, walletAddress);
      setActiveAction(null);
      onChanged?.();
    } catch (err) {
      setActionError(mapActionError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = timelineProgress(vault.createdAt, vault.deadline);
  const isActive =
    vault.status === "active" || vault.status === "pending_validation";
  const settlement = buildFundReleaseView(vault);
  const settlementAnomalies = detectSettlementAnomalies(vault);
  const canExportDeadline = isValidIcsDeadline(vault.deadline);
  const [alarmPreference, setAlarmPreference] = useState<AlarmPreference>("both");
  const handleCalendarExport = () => {
    const events = vaultToIcsEvents(vault, alarmPreference);
    downloadIcsCalendar(
      events,
      icsFilename(`${vault.name} deadline`, vaultDeadlineUid(vault.id)),
      { alarms: alarmPreference }
    );
  };

  return (
    <div
      style={{
        maxWidth: "var(--container-detail)",
        margin: "0 auto",
        padding: "0 0 3rem",
      }}
    >
      <Breadcrumb
        segments={[
          { label: "Home", to: "/" },
          { label: "Vaults", to: "/vaults" },
          { label: vault.name },
        ]}
        style={{ marginBottom: "var(--spacing-4)" }}
      />

      {/* Back link */}
      <Link
        to="/vaults"
        style={{
          color: "var(--muted)",
          fontSize: 14,
          display: "inline-block",
          marginBottom: "1.25rem",
        }}
      >
        ← Back to Vaults
      </Link>

      {/* ── Header ── */}
      <Card style={{ marginBottom: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                flexWrap: "wrap",
                marginBottom: "0.5rem",
              }}
            >
              <Text role="title" as="h1" style={{ margin: 0 }}>
                {vault.name}
              </Text>
              <StatusChip status={vault.status} size="lg" />
            </div>
            <Text
              role="display"
              as="div"
              style={{ color: "var(--accent)", lineHeight: 1.1 }}
            >
              {formatUsdc(vault.amount)}{" "}
              <span
                style={{
                  fontSize: "0.45em",
                  color: "var(--muted)",
                  fontWeight: 400,
                }}
              >
                {vault.currency}
              </span>
            </Text>
          </div>

          {/* Quick Actions / Connect CTA */}
          {!walletAddress ? (
            <div
              data-testid="vault-connect-cta"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "0.5rem",
              }}
            >
              <Text role="caption" as="div" style={{ color: "var(--muted)" }}>
                Connect a wallet to take action
              </Text>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                <WalletConnectButton />
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
                    fontSize: 13,
                  }}
                >
                  Try the demo account
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link
                to="/vaults/create"
                state={createVaultPrefillFromVault(vault)}
                style={{
                  ...actionBtn("var(--accent)"),
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Duplicate Vault
              </Link>
              {isActive && (
                <>
                  {(vault.status === "pending_validation" || vault.status === "active") && (
                    <ActionButton
                      label="Validate Milestone"
                      color="var(--accent)"
                      auth={authResults.validate_milestone}
                      onClick={() => handleActionClick("validate_milestone")}
                    />
                  )}
                  {!isApiMode() && (
                    <ActionButton
                      label="Extend Deadline"
                      color="var(--warning)"
                      auth={authResults.extend_deadline}
                      onClick={() => handleActionClick("extend_deadline")}
                    />
                  )}
                  <ActionButton
                    label="Cancel Vault"
                    color="var(--danger)"
                    auth={authResults.cancel_vault}
                    onClick={() => handleActionClick("cancel_vault")}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {walletAddress &&
          isActive &&
          !authResults.extend_deadline.allowed &&
          authResults.extend_deadline.reasons.length > 0 && (
            <Text
              role="caption"
              as="p"
              style={{ color: "var(--muted)", marginTop: "0.5rem", marginBottom: 0 }}
            >
              Actions are limited because: {authResults.extend_deadline.reasons[0]}
            </Text>
          )}
        {walletAddress && isActive && isApiMode() && (
          <Text
            role="caption"
            as="p"
            style={{ color: "var(--muted)", marginTop: "0.5rem", marginBottom: 0 }}
          >
            Extending a deadline is not supported by the demo API.
          </Text>
        )}
      </Card>

      {/* ── Timeline ── */}
      <Card style={{ marginBottom: "1.25rem" }}>
        <Text
          role="caption"
          as="div"
          style={{
            color: "var(--muted)",
            marginBottom: "1rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Status Timeline
        </Text>
        <VaultProgressBar
          value={progress}
          label={`${vault.name} timeline progress`}
          showValue={false}
        />
        <VaultLifecycle status={vault.status} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginTop: "0.5rem",
          }}
        >
          <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
            Created {fmtDate(vault.createdAt)}
          </Text>
          {isActive ? (
            <CountdownDeadline deadline={vault.deadline} />
          ) : (
            <StatusChip status={vault.status} />
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
              Deadline {fmtDate(vault.deadline)}
            </Text>
            {canExportDeadline ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <select
                  aria-label="Alarm preference"
                  value={alarmPreference}
                  onChange={(e) => setAlarmPreference(e.target.value as AlarmPreference)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.25rem 0.5rem",
                    fontSize: 12,
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  <option value="both">Alarms: 1 day & 1 hour</option>
                  <option value="1day">1 day before</option>
                  <option value="1hour">1 hour before</option>
                  <option value="none">No alarms</option>
                </select>
                <button
                  type="button"
                  onClick={handleCalendarExport}
                  style={actionBtn("var(--accent)")}
                >
                  Add to calendar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ── Info + Addresses ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.25rem",
        }}
      >
        <Card>
          <Text
            role="caption"
            as="div"
            style={{
              color: "var(--muted)",
              marginBottom: "1rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Vault Info
          </Text>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
          >
            <InfoRow label="Created" value={fmtDateTime(vault.createdAt)} />
            <InfoRow label="Deadline" value={fmtDateTime(vault.deadline)} />
            <InfoRow
              label="Duration"
              value={durationLabel(vault.createdAt, vault.deadline)}
            />
            <InfoRow
              label="Amount"
              value={`${formatUsdc(vault.amount)} ${vault.currency}`}
            />
          </div>
        </Card>

        <Card>
          <VaultMetaPanel
            network={network}
            creatorAddress={vault.creatorAddress}
            verifierAddress={vault.verifierAddress}
            successAddress={vault.successAddress}
            failureAddress={vault.failureAddress}
            contractAddress={vault.contractAddress}
          />
        </Card>
      </div>

      {settlementAnomalies.length > 0 && (
        <div
          role="alert"
          aria-label="Fund release inconsistency notice"
          style={{
            marginBottom: "1.25rem",
            padding: "0.75rem 1rem",
            color: "var(--danger)",
            background: "var(--bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
          }}
        >
          <Text role="caption" as="p" style={{ margin: 0, fontWeight: 700 }}>
            Fund release data could not be verified:
          </Text>
          <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
            {settlementAnomalies.map((anomaly) => (
              <li key={anomaly}>{anomaly}</li>
            ))}
          </ul>
        </div>
      )}

      <FundReleaseStatus {...settlement} network={APP_EXPECTED_NETWORK} />

      {/* ── Milestones ── */}
      <Card style={{ marginBottom: "1.25rem" }}>
        <Text
          role="caption"
          as="div"
          style={{
            color: "var(--muted)",
            marginBottom: "1rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Milestones
        </Text>
        <MilestoneTracker milestones={vault.milestones} />
      </Card>

      {/* ── Transactions ── */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <Text
            role="caption"
            as="div"
            style={{
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Transaction History
          </Text>
          <Link
            to={`/vaults/${vault.id}/transactions`}
            style={{
              color: "var(--accent)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View all
          </Link>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {vault.transactions.map((tx) => (
            <div
              key={tx.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                padding: "0.75rem",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <div>
                <Text
                  role="caption"
                  as="div"
                  style={{ fontWeight: 600, marginBottom: 2 }}
                >
                  {TX_LABELS[tx.type]}
                </Text>
                <Text role="caption" as="div" style={{ color: "var(--muted)" }}>
                  {fmtDateTime(tx.timestamp)}
                </Text>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {tx.amount != null && (
                  <Text
                    role="caption"
                    as="span"
                    style={{ color: "var(--text)", fontWeight: 600 }}
                  >
                    {formatUsdc(tx.amount)} {vault.currency}
                  </Text>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Text
                    role="mono"
                    as="span"
                    style={{ color: "var(--muted)", fontSize: 11 }}
                  >
                    {truncateMiddle(tx.hash, 8, 6)}
                  </Text>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tx.hash).catch(() => {});
                    }}
                    title="Copy hash"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                      padding: "0 4px",
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                  >
                    ⎘
                  </button>
                  <a
                    href={getExplorerTxUrl(tx.hash, network)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)", fontSize: 11 }}
                  >
                    ↗
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Network Footer Banner ── */}
      <NetworkFooterBanner
        network={network}
        contractAddress={vault.contractAddress}
      />

      {/* ── Vault Action Confirmation Modal ── */}
      {activeAction && (
        <>
          {actionError && (
            <div
              role="alert"
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                color: "var(--danger)",
                background: "var(--bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--radius)",
              }}
            >
              {actionError}
            </div>
          )}
          <ConfirmationModal
            isOpen={activeAction !== null}
            onClose={handleModalClose}
            onConfirm={handleActionConfirm}
            simpleConfirm={VAULT_ACTION_CONFIG[activeAction]}
            isSubmitting={isSubmitting}
          />
        </>
      )}
    </div>
  );
}

// ── Action button with authorization gate ─────────────────────────────────────
function ActionButton({
  label,
  color,
  auth,
  onClick,
}: {
  label: string;
  color: string;
  auth: VaultActionAuth;
  onClick: () => void;
}) {
  return (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        alignItems: "flex-start",
      }}
    >
      <button
        type="button"
        style={{ ...actionBtn(color), opacity: auth.allowed ? 1 : 0.55 }}
        onClick={onClick}
        disabled={!auth.allowed}
        aria-disabled={!auth.allowed}
      >
        {label}
      </button>
      {!auth.allowed && auth.reasons.length > 0 && (
        <Text
          role="caption"
          as="span"
          style={{ color: "var(--muted)", maxWidth: 220 }}
        >
          {auth.reasons[0]}
        </Text>
      )}
    </span>
  );
}

// ── Network Footer Banner ─────────────────────────────────────────────────────
interface NetworkFooterBannerProps {
  network: string | null | undefined;
  contractAddress: string;
}

function NetworkFooterBanner({ network, contractAddress }: NetworkFooterBannerProps) {
  const label = networkLabel(network);
  const explorerUrl = contractAddress
    ? contractExplorerUrl(contractAddress, network ?? "TESTNET")
    : "";

  const isTestnet = network !== "PUBLIC";
  const networkStatusColor = isTestnet
    ? "var(--warning)"
    : "var(--success)";

  return (
    <footer
      aria-label="Network information"
      style={{
        marginTop: "1.5rem",
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius)",
        border: `1px solid ${networkStatusColor}`,
        background: isTestnet
          ? "rgba(245,158,11,0.07)"
          : "rgba(16,185,129,0.07)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem 1rem",
      }}
    >
      {/* Network badge */}
      <span
        aria-label={`Network: ${label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: networkStatusColor,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: networkStatusColor,
          }}
        />
        {label}
      </span>

      {/* Contract address */}
      {contractAddress && (
        <Text
          role="mono"
          as="span"
          style={{ color: "var(--muted)", fontSize: 12, flex: "1 1 100%", minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-all" }}
          aria-label={`Contract address: ${contractAddress}`}
        >
          {contractAddress}
        </Text>
      )}

      {/* Explorer link */}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View contract ${contractAddress} on Stellar ${label} explorer`}
          style={{
            color: networkStatusColor,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          View on Explorer ↗
        </a>
      )}
    </footer>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
        {label}
      </Text>
      <Text
        role="caption"
        as="span"
        style={{ color: "var(--text)", textAlign: "right" }}
      >
        {value}
      </Text>
    </div>
  );
}

function durationLabel(start: string, end: string): string {
  const days = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
  );
  if (days >= 365) return `${Math.round(days / 365)}y`;
  if (days >= 30) return `${Math.round(days / 30)}mo`;
  return `${days}d`;
}

function actionBtn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    borderRadius: "var(--radius)",
    padding: "0.4rem 0.9rem",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    minHeight: 36,
  };
}

function mapActionError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return "Only the vault's verifier can do this.";
    }
    if (err.status === 409) {
      return "This vault is already settled or inactive.";
    }
  }
  return err instanceof Error
    ? err.message
    : "The action could not be submitted. Please try again.";
}