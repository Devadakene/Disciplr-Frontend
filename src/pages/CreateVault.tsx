import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Text } from "../components/Text";
import { Field } from "../components/Field";
import type {
  CreateVaultErrors,
  CreateVaultMilestoneInput,
} from "../utils/vaultValidation";
import {
  exceedsBalance,
  hasCreateVaultErrors,
  validateCreateVault,
} from "../utils/vaultValidation";
import { EvidenceUpload } from "../components/EvidenceUpload";
import { CreateVaultReview } from "../components/CreateVaultReview";
import { formatUsdcInput, parseUsdcInput } from "../utils/usdcInput";
import { logger } from "../utils/logger";
import { useWallet } from "../context/WalletContext";
import {
  DEADLINE_PRESETS,
  computeFutureDeadline,
  getPresetDays,
  getPresetLabel,
  type DeadlinePreset,
} from "../utils/deadlinePresets";
import { toUtcIso } from "../utils/format";
import { getCreateVaultPrefill } from "../utils/vaultPrefill";
import {
  createVault,
  CreateIntegrityError,
  findRecentVaultByCreator,
} from "../services/vaultService";
import { ApiError, classifyCreateError, isApiEnabled } from "../services/api";
import { normalizeEvidenceUrl } from "../utils/url";
import { isNetworkMismatch, APP_EXPECTED_NETWORK } from "../utils/networkMismatch";
import { isValidStellarAddress } from "../utils/stellarAddress";
import { useToastStore } from "../Zustand/toastStore";
import type { Vault } from "../types/vault";
import {
  clearDraft,
  createVaultDraft,
  readDraft,
  writeDraft,
  type CreateVaultDraft,
} from "../utils/createVaultDraft";
import { registerNavigationGuard } from "../utils/navigationGuard";

/** How long the form must stay idle before its draft is persisted. */
const DRAFT_WRITE_DELAY_MS = 500;

interface MilestoneFormRow extends CreateVaultMilestoneInput {
  id: string;
}

function createMilestoneRow(index: number): MilestoneFormRow {
  return {
    id: `milestone-${Date.now()}-${index}`,
    title: index === 0 ? "Milestone 1" : "",
    criteria: index === 0 ? "Default milestone criteria" : "",
  };
}

export default function CreateVault() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = getCreateVaultPrefill(location.state);
  const { balance, balanceStatus, address, network } = useWallet();
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);
  const successAddressRef = useRef<HTMLInputElement>(null);
  const failureAddressRef = useRef<HTMLInputElement>(null);
  const verifierAddressRef = useRef<HTMLInputElement>(null);
  const milestoneTitleRefs = useRef<Record<string, HTMLInputElement | null>>(
    {},
  );
  const milestoneCriteriaRefs = useRef<Record<string, HTMLInputElement | null>>(
    {},
  );
  const [name, setName] = useState(prefill?.name ?? "");
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [deadline, setDeadline] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<DeadlinePreset | null>(null);
  const [successAddress, setSuccessAddress] = useState(
    prefill?.successAddress ?? "",
  );
  const [failureAddress, setFailureAddress] = useState(
    prefill?.failureAddress ?? "",
  );
  const [verifierAddress, setVerifierAddress] = useState(
    prefill?.verifierAddress ?? "",
  );
  const [milestones, setMilestones] = useState<MilestoneFormRow[]>(() => {
    if (prefill?.milestones && prefill.milestones.length > 0) {
      return prefill.milestones.map((m, index) => ({
        id: `milestone-${Date.now()}-${index}`,
        title: m.title,
        criteria: m.criteria,
      }));
    }
    return [createMilestoneRow(0)];
  });
  const [errors, setErrors] = useState<CreateVaultErrors>({});
  const [evidenceUrl, setEvidenceUrl] = useState<string | undefined>();
  const [showReview, setShowReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [reconciliationState, setReconciliationState] = useState<
    "checking" | "not-found" | "failed" | "ambiguous" | "disconnected" | null
  >(null);
  const [matchingVaults, setMatchingVaults] = useState<Vault[]>([]);
  const [integrityError, setIntegrityError] = useState<CreateIntegrityError | null>(null);
  const addressRef = useRef(address);
  const reconciliationControllerRef = useRef<AbortController | null>(null);
  const uncertainCreateRef = useRef<{
    creator: string;
    name: string;
    amount: number;
    since: number;
  } | null>(null);
  addressRef.current = address;

  useEffect(() => {
    if (!address) reconciliationControllerRef.current?.abort();
    return () => reconciliationControllerRef.current?.abort();
  }, [address]);

  const [draftOffer, setDraftOffer] = useState<CreateVaultDraft | null>(null);
  // Resolved once per mount: the restore prompt must not reappear after the
  // user has already restored or discarded the draft.
  const draftResolvedRef = useRef(false);

  // The values the form starts with (a Duplicate prefill, or the empty form).
  // Anything else counts as unsaved work worth drafting / warning about.
  const baselineMilestones: CreateVaultMilestoneInput[] =
    prefill?.milestones && prefill.milestones.length > 0
      ? prefill.milestones
      : [{ title: "Milestone 1", criteria: "Default milestone criteria" }];
  const isDirty =
    name !== (prefill?.name ?? "") ||
    verifierAddress !== (prefill?.verifierAddress ?? "") ||
    amount !== (prefill?.amount ?? "") ||
    deadline !== "" ||
    successAddress !== (prefill?.successAddress ?? "") ||
    failureAddress !== (prefill?.failureAddress ?? "") ||
    evidenceUrl !== undefined ||
    milestones.length !== baselineMilestones.length ||
    milestones.some(
      (milestone, index) =>
        milestone.title !== baselineMilestones[index].title ||
        milestone.criteria !== baselineMilestones[index].criteria,
    );

  // A create whose outcome is unknown has already left the app; the form is
  // locked and the user was told to check their vaults, so neither the
  // leave-page prompt nor the navigation guard should trap them.
  const hasUnsavedChanges = isDirty && !submissionUncertain;

  // Offer a saved draft once the wallet address is known. A Duplicate prefill
  // always wins: a draft is never applied (or offered) over it.
  useEffect(() => {
    if (draftResolvedRef.current) return;
    if (prefill) {
      draftResolvedRef.current = true;
      return;
    }
    if (!address) return;
    draftResolvedRef.current = true;
    setDraftOffer(readDraft(address));
  }, [address, prefill]);

  // Debounced autosave. Drafts are written per wallet address and never
  // contain wallet or signing material.
  useEffect(() => {
    if (!address || !hasUnsavedChanges) return;
    const timeoutId = window.setTimeout(() => {
      writeDraft(
        address,
        createVaultDraft({
          name,
          verifierAddress,
          amount,
          deadline,
          successAddress,
          failureAddress,
          milestones: milestones.map(({ title, criteria }) => ({
            title,
            criteria,
          })),
          evidenceUrl: evidenceUrl ?? undefined,
        }),
      );
    }, DRAFT_WRITE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    address,
    hasUnsavedChanges,
    name,
    verifierAddress,
    amount,
    deadline,
    successAddress,
    failureAddress,
    milestones,
    evidenceUrl,
  ]);

  // Native leave-page prompt while the form holds unsaved changes.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // In-app navigation guard: Layout asks for confirmation before following a
  // nav link while this guard is registered.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    return registerNavigationGuard();
  }, [hasUnsavedChanges]);

  const handleRestoreDraft = () => {
    if (!draftOffer) return;
    const restored = draftOffer;
    const restoredName = restored.name ?? name;
    const restoredVerifier = restored.verifierAddress ?? verifierAddress;
    setName(restoredName);
    setVerifierAddress(restoredVerifier);
    setAmount(restored.amount);
    setDeadline(restored.deadline);
    setSuccessAddress(restored.successAddress);
    setFailureAddress(restored.failureAddress);
    setMilestones(
      restored.milestones.map((milestone, index) => ({
        id: `milestone-${Date.now()}-${index}`,
        title: milestone.title,
        criteria: milestone.criteria,
      })),
    );
    setEvidenceUrl(restored.evidenceUrl);
    // Restored text is untrusted input: run it through the same validators the
    // live form uses so nothing can reach "ready to review" unvalidated.
    setErrors(
      validateCreateVault({
        name: restoredName,
        verifierAddress: restoredVerifier,
        amount: restored.amount,
        deadline: restored.deadline,
        successAddress: restored.successAddress,
        failureAddress: restored.failureAddress,
        milestones: restored.milestones,
      }, new Date(), address),
    );
    setDraftOffer(null);
  };

  const handleDiscardDraft = () => {
    clearDraft(address);
    setDraftOffer(null);
  };

  const errorFieldOrder: Array<
    "name" | "amount" | "deadline" | "successAddress" | "failureAddress" | "verifierAddress"
  > = ["name", "amount", "deadline", "successAddress", "failureAddress", "verifierAddress"];

  const fieldRefs = {
    name: nameRef,
    amount: amountRef,
    deadline: deadlineRef,
    successAddress: successAddressRef,
    failureAddress: failureAddressRef,
    verifierAddress: verifierAddressRef,
  };

  const errorEntries = errorFieldOrder.flatMap((field) =>
    errors[field] ? [{ key: field, message: errors[field] as string }] : [],
  );
  const milestoneErrorEntries = [
    ...(errors.milestones?.form
      ? [{ key: "milestones-form", message: errors.milestones.form }]
      : []),
    ...(errors.milestones?.rows ?? []).flatMap((row, rowIndex) =>
      row
        ? Object.values(row).map((message, errorIndex) => ({
            key: `milestone-${rowIndex}-${errorIndex}`,
            message,
          }))
        : [],
    ),
  ];
  const allErrorEntries = [...errorEntries, ...milestoneErrorEntries];

  const clearMilestoneErrors = () => {
    setErrors((current) => ({ ...current, milestones: undefined }));
  };

  const updateMilestone = (
    id: string,
    field: keyof CreateVaultMilestoneInput,
    value: string,
  ) => {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.id === id ? { ...milestone, [field]: value } : milestone,
      ),
    );
    clearMilestoneErrors();
  };

  const addMilestone = () => {
    setMilestones((current) => [
      ...current,
      createMilestoneRow(current.length),
    ]);
    clearMilestoneErrors();
  };

  const removeMilestone = (id: string) => {
    setMilestones((current) =>
      current.filter((milestone) => milestone.id !== id),
    );
    clearMilestoneErrors();
  };

  const moveMilestone = (id: string, direction: "up" | "down") => {
    setMilestones((current) => {
      const index = current.findIndex((milestone) => milestone.id === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    clearMilestoneErrors();
  };

  const focusFirstMilestoneError = (nextErrors: CreateVaultErrors) => {
    const rowIndex = nextErrors.milestones?.rows?.findIndex(Boolean) ?? -1;
    if (rowIndex < 0) return false;

    const row = nextErrors.milestones?.rows?.[rowIndex];
    const milestone = milestones[rowIndex];
    if (!row || !milestone) return false;

    if (row.title) {
      milestoneTitleRefs.current[milestone.id]?.focus();
      return true;
    }

    if (row.criteria) {
      milestoneCriteriaRefs.current[milestone.id]?.focus();
      return true;
    }

    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateCreateVault({
      name,
      amount,
      deadline,
      successAddress,
      failureAddress,
      verifierAddress,
      milestones,
    }, new Date(), address);
    setErrors(nextErrors);

    if (hasCreateVaultErrors(nextErrors)) {
      const firstInvalidField = errorFieldOrder.find(
        (field) => nextErrors[field],
      );
      if (firstInvalidField) {
        fieldRefs[firstInvalidField].current?.focus();
      } else {
        focusFirstMilestoneError(nextErrors);
      }
      return;
    }

    setShowReview(true);
  };

  const reconcileCreate = async (pendingCreate: {
    creator: string;
    name: string;
    amount: number;
    since: number;
  }) => {
    reconciliationControllerRef.current?.abort();
    const controller = new AbortController();
    reconciliationControllerRef.current = controller;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setReconciliationState("checking");
    setMatchingVaults([]);
    setSubmitError("Checking whether your vault was created...");

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (addressRef.current !== pendingCreate.creator) {
          setReconciliationState("disconnected");
          setSubmitError("Your wallet disconnected. Reconnect it, then check again.");
          return;
        }

        const matches = await findRecentVaultByCreator({
          ...pendingCreate,
          signal: controller.signal,
        });

        if (controller.signal.aborted || addressRef.current !== pendingCreate.creator) {
          setReconciliationState("disconnected");
          setSubmitError("Your wallet disconnected. Reconnect it, then check again.");
          return;
        }
        if (matches.length === 1) {
          useToastStore.getState().push({
            message: "Your vault was created.",
            variant: "success",
          });
          setSubmissionUncertain(false);
          // The vault exists, so this wallet's draft is done with.
          clearDraft(pendingCreate.creator);
          navigate(`/vaults/${matches[0].id}`);
          return;
        }
        if (matches.length > 1) {
          setMatchingVaults(matches);
          setReconciliationState("ambiguous");
          setSubmitError(
            "More than one matching vault was found. Choose the vault you created before taking any further action.",
          );
          return;
        }

        if (attempt === 0) {
          await new Promise<void>((resolve, reject) => {
            if (controller.signal.aborted) {
              reject(new DOMException("Reconciliation aborted.", "AbortError"));
              return;
            }
            const timer = window.setTimeout(() => {
              controller.signal.removeEventListener("abort", onAbort);
              resolve();
            }, 250);
            const onAbort = () => {
              window.clearTimeout(timer);
              reject(new DOMException("Reconciliation aborted.", "AbortError"));
            };
            controller.signal.addEventListener("abort", onAbort, { once: true });
          });
        }
      }

      setSubmissionUncertain(false);
      setReconciliationState("not-found");
      setSubmitError("No matching vault was found. You can safely try again.");
    } catch {
      const disconnected =
        controller.signal.aborted || addressRef.current !== pendingCreate.creator;
      logger.error("Vault creation reconciliation failed");
      setReconciliationState(disconnected ? "disconnected" : "failed");
      setSubmitError(
        disconnected
          ? "Your wallet disconnected. Reconnect it, then check again."
          : "We couldn't check whether your vault was created. Check again before retrying.",
      );
    } finally {
      if (reconciliationControllerRef.current === controller) {
        reconciliationControllerRef.current = null;
      }
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (isSubmittingRef.current || submissionUncertain) return;

    if (!address || !isValidStellarAddress(address)) {
      setSubmitError("Wallet account unavailable. Please reconnect your wallet.");
      return;
    }

    if (!network || isNetworkMismatch(network)) {
      setSubmitError(`Wallet network unavailable or incorrect. Please switch to ${APP_EXPECTED_NETWORK}.`);
      return;
    }

    const nextErrors = validateCreateVault({
      name,
      amount,
      deadline,
      successAddress,
      failureAddress,
      verifierAddress,
      milestones,
    }, new Date(), address);
    if (hasCreateVaultErrors(nextErrors)) {
      setErrors(nextErrors);
      setShowReview(false);
      return;
    }

    if (balanceStatus === 'success' && exceedsBalance(amount, balance)) {
      setSubmitError("Amount exceeds your available USDC balance.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    setValidationMessages([]);
    setReconciliationState(null);
    setMatchingVaults([]);

    const normalizedEvidence = evidenceUrl
      ? normalizeEvidenceUrl(evidenceUrl) ?? undefined
      : undefined;
    const apiEnabled = isApiEnabled();
    const pendingCreate = {
      creator: address,
      name: name.trim(),
      amount: Number(amount),
      since: Date.now(),
    };

    try {
      const newVault = await createVault({
        name: name.trim(),
        amount: Number(amount),
        currency: "USDC",
        deadline: toUtcIso(deadline),
        creatorAddress: address,
        verifierAddress: verifierAddress.trim(),
        successAddress,
        failureAddress,
        milestones: milestones.map(({ title, criteria }, index) => ({
          title,
          description: criteria,
          criteria,
          ...(index === 0 && !apiEnabled && normalizedEvidence
            ? { evidenceUrl: normalizedEvidence }
            : {}),
        })),
      });
      
      if (!newVault || !newVault.id) {
        throw new Error("Malformed response from server.");
      }

      // The vault exists, so this wallet's draft is done with. An unknown
      // outcome (below) keeps it: the user may need to retry after checking.
      clearDraft(address);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      navigate(`/vaults/${newVault.id}`);
    } catch (err) {
      if (err instanceof CreateIntegrityError) {
        // Post-creation integrity check failed: do not navigate silently.
        // Don't log full addresses in the integrity error.
        logger.error("Vault creation integrity mismatch detected");
        setIntegrityError(err);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      if (
        err instanceof ApiError &&
        classifyCreateError(err) === "rejected"
      ) {
        const apiError = err;
        logger.warn("Vault creation was rejected by the API");
        setValidationMessages(
          [apiError.serverError, ...apiError.details].filter(
            (message): message is string => Boolean(message),
          ),
        );
        setSubmitError(
          apiError.details.length > 0 ? null : apiError.serverError ?? "Vault creation was rejected.",
        );
        setSubmissionUncertain(false);
        setReconciliationState(null);
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      logger.error("Vault creation outcome unknown");
      uncertainCreateRef.current = pendingCreate;
      setSubmissionUncertain(true);
      setReconciliationState("checking");
      await reconcileCreate(pendingCreate);
    }
  };

  const handleBackToEdit = () => {
    setShowReview(false);
    setSubmitError(null);
    setValidationMessages([]);
  };

  const handleCheckAgain = () => {
    if (
      !address ||
      address !== uncertainCreateRef.current?.creator ||
      !uncertainCreateRef.current ||
      isSubmittingRef.current
    ) return;
    void reconcileCreate(uncertainCreateRef.current);
  };

  return (
    <div>
      <Text role="display" as="h1" style={{ marginBottom: "0.5rem" }}>
        Create Vault
      </Text>
      <Text
        role="body"
        as="p"
        style={{ color: "var(--muted)", marginBottom: "2rem" }}
      >
        Lock USDC with a deadline and milestone. Funds release on validation or
        redirect on failure.
      </Text>

      {integrityError ? (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            maxWidth: 540,
            padding: "1.25rem",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            background: "color-mix(in srgb, var(--danger) 8%, var(--surface))",
            marginBottom: "1.5rem",
          }}
        >
          <Text role="display" as="h2" style={{ color: "var(--danger)" }}>
            Vault Verification Warning
          </Text>
          <Text role="body" as="p">
            The vault was created on the server, but one or more stored values differ from what you confirmed. Please review the vault details below:
          </Text>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {Object.entries(integrityError.mismatches).map(([field, diff]) => (
              <li key={field} style={{ wordBreak: "break-all" }}>
                <strong>{field}:</strong> expected <code>{diff?.expected}</code>, but server stored <code>{diff?.actual}</code>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <Link
              to={`/vaults/${integrityError.vault.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--accent)",
                color: "var(--bg)",
                padding: "0.6rem 1.25rem",
                borderRadius: "var(--radius)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Review Vault
            </Link>
            <Link
              to="/vaults"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
                padding: "0.6rem 1.25rem",
                borderRadius: "var(--radius)",
                textDecoration: "none",
              }}
            >
              All Vaults
            </Link>
          </div>
        </div>
      ) : showReview ? (
        <CreateVaultReview
          name={name.trim()}
          amount={amount}
          deadline={deadline}
          successAddress={successAddress}
          failureAddress={failureAddress}
          verifierAddress={verifierAddress.trim()}
          milestones={milestones}
          isSubmitting={isSubmitting}
          submissionUncertain={submissionUncertain}
          error={submitError}
          validationMessages={validationMessages}
          reconciliationState={reconciliationState}
          matchingVaults={matchingVaults}
          canCheckAgain={Boolean(address && address === uncertainCreateRef.current?.creator)}
          onBack={handleBackToEdit}
          onConfirm={handleConfirm}
          onCheckAgain={handleCheckAgain}
        />
      ) : (

        <>
          {allErrorEntries.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                border: "1px solid var(--danger)",
                borderRadius: "var(--radius)",
                padding: "0.75rem",
                background:
                  "color-mix(in srgb, var(--danger) 10%, var(--surface))",
                marginBottom: "1rem",
                maxWidth: 400,
              }}
            >
              <Text
                role="caption"
                as="p"
                style={{ color: "var(--danger)", marginBottom: "0.5rem" }}
              >
                Please fix the highlighted fields before creating the vault.
              </Text>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "1.25rem",
                  color: "var(--danger)",
                }}
              >
                {allErrorEntries.map(({ key, message }, index) => (
                  <li key={`${key}-${index}`}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          {prefill && (
            <div
              role="status"
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.75rem",
                background: "var(--surface)",
                marginBottom: "1rem",
                maxWidth: 400,
              }}
            >
              <Text role="caption" as="p" style={{ margin: 0 }}>
                Duplicating {prefill.sourceVaultName ?? "an existing vault"}.
                Amount and destination addresses are prefilled; choose a fresh
                deadline for this new vault.
              </Text>
            </div>
          )}

          {draftOffer && (
            <div
              role="status"
              data-testid="create-vault-draft-banner"
              style={{
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius)",
                padding: "0.75rem",
                background: "var(--surface)",
                marginBottom: "1rem",
                maxWidth: 400,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <Text role="caption" as="p" style={{ margin: 0 }}>
                Restore draft from{" "}
                {new Date(draftOffer.savedAt).toLocaleString()}?
              </Text>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "none",
                    borderRadius: "var(--radius)",
                    background: "var(--accent)",
                    color: "var(--bg)",
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                >
                  <Text role="caption" as="span">
                    Restore
                  </Text>
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    minHeight: "44px",
                  }}
                >
                  <Text role="caption" as="span">
                    Discard
                  </Text>
                </button>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            noValidate
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              maxWidth: 400,
            }}
          >
            <Field
              ref={nameRef}
              id="create-vault-name"
              label="Vault name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="Website redesign"
              maxLength={80}
              error={errors.name}
              required
            />
            <Field
              ref={amountRef}
              id="create-vault-amount"
              label="Amount (USDC)"
              type="text"
              value={formatUsdcInput(amount)}
              onChange={(e) => {
                const raw = parseUsdcInput(e.target.value);
                setAmount(raw);
                setErrors((current) => ({ ...current, amount: undefined }));
              }}
              placeholder="1000"
              error={errors.amount}
              required
            />
            {balanceStatus === "success" && exceedsBalance(amount, balance) && (
              <p
                role="status"
                style={{
                  color: "var(--warning)",
                  margin: 0,
                  fontSize: "0.875rem",
                }}
              >
                Amount exceeds your available USDC balance ({balance}).
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {DEADLINE_PRESETS.map((preset) => {
                const days = getPresetDays(preset);
                const isActive = selectedPreset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDeadline(computeFutureDeadline(days));
                      setSelectedPreset(preset);
                      setErrors((current) => ({
                        ...current,
                        deadline: undefined,
                      }));
                    }}
                    style={{
                      padding: "0.4rem 0.875rem",
                      border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                      background: isActive
                        ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                        : "var(--surface)",
                      color: isActive ? "var(--accent)" : "var(--muted)",
                      borderRadius: "var(--radius)",
                      fontSize: "0.85rem",
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {getPresetLabel(preset)}
                  </button>
                );
              })}
            </div>
            <Field
              ref={deadlineRef}
              id="create-vault-deadline"
              label="Deadline (ISO date)"
              type="datetime-local"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                setSelectedPreset(null);
                setErrors((current) => ({ ...current, deadline: undefined }));
              }}
              error={errors.deadline}
              required
            />
            <Field
              ref={successAddressRef}
              id="create-vault-success-address"
              label="Success destination (Stellar address)"
              type="text"
              value={successAddress}
              onChange={(e) => {
                setSuccessAddress(e.target.value);
                setErrors((current) => ({
                  ...current,
                  successAddress: undefined,
                }));
              }}
              placeholder="G..."
              error={errors.successAddress}
              required
            />
            <Field
              ref={failureAddressRef}
              id="create-vault-failure-address"
              label="Failure destination (Stellar address)"
              type="text"
              value={failureAddress}
              onChange={(e) => {
                setFailureAddress(e.target.value);
                setErrors((current) => ({
                  ...current,
                  failureAddress: undefined,
                }));
              }}
              placeholder="G..."
              error={errors.failureAddress}
              required
            />
            <Field
              ref={verifierAddressRef}
              id="create-vault-verifier-address"
              label="Verifier address"
              type="text"
              value={verifierAddress}
              onChange={(e) => {
                setVerifierAddress(e.target.value);
                setErrors((current) => ({
                  ...current,
                  verifierAddress: undefined,
                }));
              }}
              placeholder="G..."
              error={errors.verifierAddress}
              required
            />
            <section
              aria-labelledby="create-vault-milestones-heading"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div>
                <Text
                  role="body"
                  as="h2"
                  id="create-vault-milestones-heading"
                  style={{ marginBottom: "0.25rem" }}
                >
                  Milestones
                </Text>
                <Text role="caption" as="p" style={{ color: "var(--muted)" }}>
                  Add each delivery checkpoint with clear validation criteria.
                </Text>
              </div>

              {errors.milestones?.form ? (
                <Text
                  role="caption"
                  as="p"
                  id="create-vault-milestones-error"
                  style={{ color: "var(--danger)" }}
                >
                  {errors.milestones.form}
                </Text>
              ) : null}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                }}
              >
                {milestones.map((milestone, index) => {
                  const rowErrors = errors.milestones?.rows?.[index];
                  const canMoveUp = index > 0;
                  const canMoveDown = index < milestones.length - 1;

                  return (
                    <fieldset
                      key={milestone.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        margin: 0,
                        padding: "0.875rem",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        background: "var(--bg)",
                      }}
                    >
                      <legend>
                        <Text role="caption" as="span">
                          Milestone {index + 1}
                        </Text>
                      </legend>
                      <Field
                        ref={(node) => {
                          milestoneTitleRefs.current[milestone.id] = node;
                        }}
                        id={`create-vault-milestone-${index}-title`}
                        label={`Milestone ${index + 1} title`}
                        type="text"
                        value={milestone.title}
                        onChange={(e) =>
                          updateMilestone(milestone.id, "title", e.target.value)
                        }
                        placeholder="Design approved"
                        error={rowErrors?.title}
                        required
                      />
                      <Field
                        ref={(node) => {
                          milestoneCriteriaRefs.current[milestone.id] = node;
                        }}
                        id={`create-vault-milestone-${index}-criteria`}
                        label={`Milestone ${index + 1} criteria`}
                        type="text"
                        value={milestone.criteria}
                        onChange={(e) =>
                          updateMilestone(
                            milestone.id,
                            "criteria",
                            e.target.value,
                          )
                        }
                        placeholder="Signed approval from the verifier"
                        error={rowErrors?.criteria}
                        required
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => moveMilestone(milestone.id, "up")}
                          disabled={!canMoveUp}
                          aria-label={`Move milestone ${index + 1} up`}
                          style={{
                            padding: "0.4rem 0.75rem",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            background: "var(--surface)",
                            color: "var(--text)",
                            cursor: canMoveUp ? "pointer" : "not-allowed",
                            opacity: canMoveUp ? 1 : 0.5,
                          }}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMilestone(milestone.id, "down")}
                          disabled={!canMoveDown}
                          aria-label={`Move milestone ${index + 1} down`}
                          style={{
                            padding: "0.4rem 0.75rem",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            background: "var(--surface)",
                            color: "var(--text)",
                            cursor: canMoveDown ? "pointer" : "not-allowed",
                            opacity: canMoveDown ? 1 : 0.5,
                          }}
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMilestone(milestone.id)}
                          aria-label={`Remove milestone ${index + 1}`}
                          style={{
                            padding: "0.4rem 0.75rem",
                            border: "1px solid var(--danger)",
                            borderRadius: "var(--radius)",
                            background: "transparent",
                            color: "var(--danger)",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addMilestone}
                style={{
                  alignSelf: "flex-start",
                  padding: "0.55rem 0.875rem",
                  border: "1px solid var(--accent)",
                  borderRadius: "var(--radius)",
                  background: "transparent",
                  color: "var(--accent)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Add milestone
              </button>
            </section>
            <EvidenceUpload value={evidenceUrl ?? ""} onChange={setEvidenceUrl} />
            {isApiEnabled() && (
              <Text
                role="caption"
                as="p"
                data-testid="evidence-api-note"
                style={{ color: "var(--muted)", margin: 0 }}
              >
                Evidence links aren't saved by the API yet
              </Text>
            )}
            <button
              type="submit"
              style={{
                background: "var(--accent)",
                color: "var(--bg)",
                padding: "0.75rem 1.5rem",
                borderRadius: "var(--radius)",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "0.5rem",
                minHeight: "44px",
                minWidth: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text role="caption" as="span">
                Create Vault
              </Text>
            </button>
          </form>
        </>
      )}
    </div>
  );
}
