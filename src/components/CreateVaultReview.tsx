import { Text } from "./Text";
import { AddressDisplay } from "./AddressDisplay";
import { formatDateTime, formatUsdc } from "../utils/format";
import { isApiEnabled } from "../services/api";
import { useConnectivityStore } from "../services/connectivity";

export interface CreateVaultReviewMilestone {
  title: string;
  criteria: string;
}

/**
 * Props for the CreateVaultReview component.
 * 
 * @property amount - The vault amount in USDC. Must not be empty.
 * @property deadline - ISO datetime string for the vault deadline. Must not be empty.
 * @property successAddress - Destination address if milestones succeed. Must not be empty.
 * @property failureAddress - Destination address if milestones fail. Must not be empty.
 * @property verifierAddress - The address of the verifier.
 * @property milestone - (Optional) Legacy single milestone title.
 * @property milestones - (Optional) Array of milestone objects containing title and criteria.
 * @property isSubmitting - Disables interactions and shows a busy state when true.
 * @property submissionUncertain - Locks confirmation until the user checks whether a vault was created.
 * @property error - Error message to display to the user, announced to screen readers.
 * @property onBack - Callback to return to the edit form.
 * @property onConfirm - Callback to submit the vault creation. Should be guarded against duplicate calls in the parent.
 * @property onCheckVaults - Opens the vault list when a create outcome is unknown.
 */
interface CreateVaultReviewProps {
  name: string;
  amount: string;
  deadline: string;
  successAddress: string;
  failureAddress: string;
  verifierAddress: string;
  milestone?: string;
  milestones?: CreateVaultReviewMilestone[];
  isSubmitting?: boolean;
  submissionUncertain?: boolean;
  error?: string | null;
  onBack?: () => void;
  onConfirm?: () => void;
  onCheckVaults?: () => void;
}

/**
 * Renders a review screen for vault creation.
 * Enforces boundary invariants for all required vault details.
 * If required data is missing, an accessible error state is displayed prompting the user to go back.
 * Handles loading (isSubmitting) and error states with appropriate ARIA attributes for screen readers.
 */
export function CreateVaultReview({
  name,
  amount,
  deadline,
  successAddress,
  failureAddress,
  verifierAddress,
  milestone,
  milestones,
  isSubmitting,
  submissionUncertain,
  error,
  onBack,
  onConfirm,
  onCheckVaults,
}: CreateVaultReviewProps) {
  const connectivityStatus = useConnectivityStore((state) => state.status);
  const isDegraded = isApiEnabled() && connectivityStatus !== 'online';

  // Invariant validation for boundary conditions
  const isMissingData =
    !name || !amount || !deadline || !successAddress || !failureAddress || !verifierAddress;

  if (isMissingData) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxWidth: 480,
          padding: "1.25rem",
          border: "1px solid var(--danger)",
          borderRadius: "var(--radius)",
          background: "var(--surface)",
        }}
      >
        <Text role="display" as="h2" style={{ color: "var(--danger)" }}>
          Incomplete Vault Details
        </Text>
        <Text role="body" as="p">
          Missing required vault details. Please go back and complete the form.
        </Text>
        <button
          type="button"
          onClick={onBack}
          style={{
            alignSelf: "flex-start",
            background: "transparent",
            color: "var(--text)",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            cursor: "pointer",
          }}
        >
          <Text role="caption" as="span">
            Back to edit
          </Text>
        </button>
      </div>
    );
  }

  const reviewMilestones =
    milestones && milestones.length > 0
      ? milestones
      : milestone
        ? [{ title: milestone, criteria: "" }]
        : [];

  return (
    <div
      aria-busy={isSubmitting}
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        maxWidth: 480,
        padding: "1.25rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
      }}
    >
      <Text role="display" as="h2" style={{ marginBottom: "0.25rem" }}>
        Review Vault Details
      </Text>
      <Text role="body" as="p" style={{ color: "var(--muted)" }}>
        Confirm the vault details before creating it. This action is
        irreversible once submitted.
      </Text>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
            Vault name
          </Text>
          <Text role="body" as="p">
            {name}
          </Text>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
            Amount (USDC)
          </Text>
          <Text role="body" as="p">
            {formatUsdc(amount)}
          </Text>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
            Deadline
          </Text>
          <Text role="body" as="p">
            {(() => {
              const localFormatted = formatDateTime(deadline);
              const utcFormatted = formatDateTime(deadline, { timeZone: "UTC" });
              return `${localFormatted} (${utcFormatted} UTC)`;
            })()}
          </Text>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
            Success destination (If you succeed, funds go to …)
          </Text>
          <AddressDisplay address={successAddress} />
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
            Failure destination (If you fail, funds go to …)
          </Text>
          <AddressDisplay address={failureAddress} />
        </div>


        {verifierAddress ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
              Verifier address
            </Text>
            <AddressDisplay address={verifierAddress} />
          </div>
        ) : null}

        {reviewMilestones.length > 0 ? (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <Text role="caption" as="span" style={{ color: "var(--muted)" }}>
              Milestones
            </Text>
            <ol
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                margin: 0,
                paddingLeft: "1.25rem",
              }}
            >
              {reviewMilestones.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <Text role="body" as="p" style={{ fontWeight: 700 }}>
                    {item.title}
                  </Text>
                  {item.criteria ? (
                    <Text
                      role="caption"
                      as="p"
                      style={{ color: "var(--muted)" }}
                    >
                      {item.criteria}
                    </Text>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: "0.75rem",
            background: "color-mix(in srgb, var(--danger) 10%, var(--surface))",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            color: "var(--danger)",
            marginTop: "0.5rem",
          }}
        >
          <Text role="caption" as="p">
            {error}
          </Text>
        </div>
      ) : null}

      {isApiEnabled() && connectivityStatus !== 'online' ? (
        <div
          role="alert"
          style={{
            padding: "0.75rem",
            background: "color-mix(in srgb, var(--warning) 10%, var(--surface))",
            border: "1px solid var(--warning)",
            borderRadius: "var(--radius)",
            color: "var(--warning)",
            marginTop: "0.5rem",
          }}
        >
          <Text role="caption" as="p">
            {connectivityStatus === 'offline'
              ? 'You are currently offline. Actions are disabled until reconnected.'
              : 'The Disciplr service is currently unavailable. Actions are disabled.'}
          </Text>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting || submissionUncertain}
          aria-disabled={isSubmitting || submissionUncertain}
          style={{
            background: "transparent",
            color: "var(--text)",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            cursor: isSubmitting || submissionUncertain ? "not-allowed" : "pointer",
            opacity: isSubmitting || submissionUncertain ? 0.7 : 1,
          }}
        >
          <Text role="caption" as="span">
            Back to edit
          </Text>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting || submissionUncertain || isDegraded}
          aria-disabled={isSubmitting || submissionUncertain || isDegraded}
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            border: "none",
            cursor: isSubmitting || submissionUncertain || isDegraded ? "not-allowed" : "pointer",
            fontWeight: 600,
            opacity: isSubmitting || submissionUncertain || isDegraded ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Text role="caption" as="span">
            {isSubmitting ? "Submitting..." : submissionUncertain ? "Status unknown" : "Confirm Vault"}
          </Text>
        </button>
      </div>
      {submissionUncertain && onCheckVaults ? (
        <button
          type="button"
          onClick={onCheckVaults}
          style={{
            alignSelf: "flex-start",
            background: "transparent",
            color: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "0.75rem 1rem",
            cursor: "pointer",
          }}
        >
          View vaults
        </button>
      ) : null}
    </div>
  );
}
