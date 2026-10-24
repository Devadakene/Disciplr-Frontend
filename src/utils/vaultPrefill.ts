import type { Milestone, Vault } from "../types/vault";

export interface CreateVaultPrefillState {
  sourceVaultId?: string;
  sourceVaultName?: string;
  name?: string;
  amount?: string;
  successAddress?: string;
  failureAddress?: string;
  verifierAddress?: string;
  milestones?: Array<Pick<Milestone, "title" | "criteria">>;
}

interface CreateVaultLocationState {
  createVaultPrefill?: CreateVaultPrefillState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function createVaultPrefillFromVault(
  vault: Vault,
): CreateVaultLocationState {
  return {
    createVaultPrefill: {
      sourceVaultId: vault.id,
      sourceVaultName: vault.name,
      name: `${vault.name} (copy)`,
      amount: String(vault.amount),
      successAddress: vault.successAddress,
      failureAddress: vault.failureAddress,
      verifierAddress: vault.verifierAddress,
      milestones: (vault.milestones ?? []).map(({ title, criteria }) => ({
        title,
        criteria,
      })),
    },
  };
}

export function getCreateVaultPrefill(
  state: unknown,
): CreateVaultPrefillState | undefined {
  if (!isRecord(state) || !isRecord(state.createVaultPrefill)) {
    return undefined;
  }

  const { createVaultPrefill } = state;
  const milestones = Array.isArray(createVaultPrefill.milestones)
    ? createVaultPrefill.milestones.filter(isRecord).map((milestone) => ({
        title: optionalString(milestone.title) ?? "",
        criteria: optionalString(milestone.criteria) ?? "",
      }))
    : undefined;

  return {
    sourceVaultId: optionalString(createVaultPrefill.sourceVaultId),
    sourceVaultName: optionalString(createVaultPrefill.sourceVaultName),
    name: optionalString(createVaultPrefill.name),
    amount: optionalString(createVaultPrefill.amount),
    successAddress: optionalString(createVaultPrefill.successAddress),
    failureAddress: optionalString(createVaultPrefill.failureAddress),
    verifierAddress: optionalString(createVaultPrefill.verifierAddress),
    milestones,
  };
}
