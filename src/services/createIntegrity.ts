import type { Vault } from "../types/vault";
import type { ApiVault } from "./api";

export interface IntegrityDiff {
  expected: string;
  actual: string;
}

export type IntegrityMismatches = Partial<
  Record<"creator" | "verifier" | "amount" | "successDestination" | "failureDestination", IntegrityDiff>
>;

export class CreateIntegrityError extends Error {
  public readonly mismatches: IntegrityMismatches;
  public readonly vault: Vault;

  constructor(mismatches: IntegrityMismatches, vault: Vault) {
    const fields = Object.keys(mismatches).join(", ");
    super(`Vault creation integrity verification failed for field(s): ${fields}`);
    this.name = "CreateIntegrityError";
    this.mismatches = mismatches;
    this.vault = vault;
    // Maintain prototype chain for instanceof checks across environments
    Object.setPrototypeOf(this, CreateIntegrityError.prototype);
  }
}

/**
 * Normalizes an address string for integrity comparison:
 * trims leading/trailing whitespace and checks for uppercase consistency.
 */
export function normalizeAddressForComparison(address: string): string {
  if (typeof address !== "string") return "";
  return address.trim();
}

/**
 * Normalizes decimal amount string representation for exact decimal comparison.
 * Handles numbers and numeric strings ("100", 100, "100.0000000").
 * Strips unnecessary trailing fractional zeros and trailing decimal points,
 * but compares decimals exactly without floating-point inaccuracy.
 */
export function normalizeAmountDecimal(amount: string | number): string {
  const str = String(amount).trim();
  if (!str) return "";

  // Check if it's a valid decimal number
  if (!/^-?\d+(?:\.\d+)?$/.test(str)) {
    return str;
  }

  const isNegative = str.startsWith("-");
  const unsigned = isNegative ? str.slice(1) : str;

  const [integerPartRaw, fractionalPartRaw = ""] = unsigned.split(".");
  // Strip leading zeros from integer part, but leave at least one digit
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "");

  // Strip trailing zeros from fractional part
  const fractionalPart = fractionalPartRaw.replace(/0+$/, "");

  const result = fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
  return isNegative && result !== "0" ? `-${result}` : result;
}

export interface ExpectedVaultValues {
  creator: string;
  verifier: string;
  amount: number | string;
  successAddress: string;
  failureAddress: string;
}

/**
 * Verifies that the server response matches the submitted vault parameters.
 * Throws CreateIntegrityError if any field differs.
 */
export function verifyCreateIntegrity(
  expected: ExpectedVaultValues,
  apiVault: ApiVault,
  vault: Vault,
): void {
  const mismatches: IntegrityMismatches = {};

  const expCreator = normalizeAddressForComparison(expected.creator);
  const actCreator = normalizeAddressForComparison(apiVault.creator);
  if (expCreator !== actCreator) {
    mismatches.creator = { expected: expCreator, actual: actCreator };
  }

  const expVerifier = normalizeAddressForComparison(expected.verifier);
  const actVerifier = normalizeAddressForComparison(apiVault.verifier);
  if (expVerifier !== actVerifier) {
    mismatches.verifier = { expected: expVerifier, actual: actVerifier };
  }

  const expSuccess = normalizeAddressForComparison(expected.successAddress);
  const actSuccess = normalizeAddressForComparison(apiVault.successDestination);
  if (expSuccess !== actSuccess) {
    mismatches.successDestination = { expected: expSuccess, actual: actSuccess };
  }

  const expFailure = normalizeAddressForComparison(expected.failureAddress);
  const actFailure = normalizeAddressForComparison(apiVault.failureDestination);
  if (expFailure !== actFailure) {
    mismatches.failureDestination = { expected: expFailure, actual: actFailure };
  }

  const expAmount = normalizeAmountDecimal(expected.amount);
  const actAmount = normalizeAmountDecimal(apiVault.amount);
  if (expAmount !== actAmount) {
    mismatches.amount = { expected: expAmount, actual: actAmount };
  }

  if (Object.keys(mismatches).length > 0) {
    throw new CreateIntegrityError(mismatches, vault);
  }
}
