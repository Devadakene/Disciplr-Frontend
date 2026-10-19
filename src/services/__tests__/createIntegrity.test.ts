import { describe, it, expect } from "vitest";
import {
  verifyCreateIntegrity,
  CreateIntegrityError,
  normalizeAmountDecimal,
  normalizeAddressForComparison,
} from "../createIntegrity";
import type { ApiVault } from "../api";
import type { Vault } from "../../types/vault";
import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_C, ACCOUNT_D } from "@/__tests__/fixtures/stellarAddresses";

describe("createIntegrity", () => {
  const baseApiVault: ApiVault = {
    id: "vault-123",
    name: "Vault 100 USDC",
    creator: ACCOUNT_A,
    verifier: ACCOUNT_C,
    amount: "100",
    status: "active",
    startDate: "2026-06-18T00:00:00Z",
    endDate: "2026-06-19T00:00:00Z",
    successDestination: ACCOUNT_B,
    failureDestination: ACCOUNT_D,
    createdAt: "2026-06-18T00:00:00Z",
    updatedAt: "2026-06-18T00:00:00Z",
    milestones: [],
  };

  const baseVault: Vault = {
    id: "vault-123",
    name: "Vault 100 USDC",
    status: "active",
    amount: 100,
    currency: "USDC",
    createdAt: "2026-06-18T00:00:00Z",
    deadline: "2026-06-19T00:00:00Z",
    creatorAddress: ACCOUNT_A,
    verifierAddress: ACCOUNT_C,
    successAddress: ACCOUNT_B,
    failureAddress: ACCOUNT_D,
    contractAddress: ACCOUNT_A,
    milestones: [],
    transactions: [],
  };

  const expectedValues = {
    creator: ACCOUNT_A,
    verifier: ACCOUNT_C,
    amount: "100",
    successAddress: ACCOUNT_B,
    failureAddress: ACCOUNT_D,
  };

  it("passes when all fields match exactly", () => {
    expect(() =>
      verifyCreateIntegrity(expectedValues, baseApiVault, baseVault),
    ).not.toThrow();
  });

  describe("amount decimal comparison", () => {
    it.each([
      ["100", "100"],
      ["100", 100],
      [100, "100"],
      ["100", "100.0000000"],
      ["100.0000000", "100"],
      ["100.5", "100.5000000"],
      ["0.0000001", "0.0000001"],
    ])("accepts matching amount representations: expected %s, actual %s", (expected, actual) => {
      expect(() =>
        verifyCreateIntegrity(
          { ...expectedValues, amount: expected },
          { ...baseApiVault, amount: String(actual) },
          baseVault,
        ),
      ).not.toThrow();
    });

    it("rejects different decimal amounts without float inaccuracy", () => {
      expect(() =>
        verifyCreateIntegrity(
          { ...expectedValues, amount: "100" },
          { ...baseApiVault, amount: "100.0000001" },
          baseVault,
        ),
      ).toThrow(CreateIntegrityError);
    });

    it("normalizes decimal strings properly", () => {
      expect(normalizeAmountDecimal("100.0000000")).toBe("100");
      expect(normalizeAmountDecimal("00100.500")).toBe("100.5");
      expect(normalizeAmountDecimal(100)).toBe("100");
      expect(normalizeAmountDecimal("0.100")).toBe("0.1");
      expect(normalizeAmountDecimal("0")).toBe("0");
    });
  });

  describe("field mismatches", () => {
    it("detects creator mismatch", () => {
      try {
        verifyCreateIntegrity(
          { ...expectedValues, creator: ACCOUNT_A },
          { ...baseApiVault, creator: ACCOUNT_D },
          baseVault,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CreateIntegrityError);
        const error = err as CreateIntegrityError;
        expect(error.mismatches.creator).toEqual({
          expected: ACCOUNT_A,
          actual: ACCOUNT_D,
        });
        expect(error.vault).toBe(baseVault);
      }
    });

    it("detects verifier mismatch", () => {
      try {
        verifyCreateIntegrity(
          { ...expectedValues, verifier: ACCOUNT_C },
          { ...baseApiVault, verifier: ACCOUNT_A },
          baseVault,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CreateIntegrityError);
        const error = err as CreateIntegrityError;
        expect(error.mismatches.verifier).toEqual({
          expected: ACCOUNT_C,
          actual: ACCOUNT_A,
        });
      }
    });

    it("detects successDestination mismatch", () => {
      try {
        verifyCreateIntegrity(
          { ...expectedValues, successAddress: ACCOUNT_B },
          { ...baseApiVault, successDestination: ACCOUNT_A },
          baseVault,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CreateIntegrityError);
        const error = err as CreateIntegrityError;
        expect(error.mismatches.successDestination).toEqual({
          expected: ACCOUNT_B,
          actual: ACCOUNT_A,
        });
      }
    });

    it("detects failureDestination mismatch (e.g. backend silent replacement)", () => {
      try {
        verifyCreateIntegrity(
          { ...expectedValues, failureAddress: ACCOUNT_D },
          { ...baseApiVault, failureDestination: ACCOUNT_C },
          baseVault,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CreateIntegrityError);
        const error = err as CreateIntegrityError;
        expect(error.mismatches.failureDestination).toEqual({
          expected: ACCOUNT_D,
          actual: ACCOUNT_C,
        });
      }
    });

    it("detects multiple simultaneous mismatches", () => {
      try {
        verifyCreateIntegrity(
          {
            creator: ACCOUNT_A,
            verifier: ACCOUNT_C,
            amount: "100",
            successAddress: ACCOUNT_B,
            failureAddress: ACCOUNT_D,
          },
          {
            ...baseApiVault,
            successDestination: ACCOUNT_A,
            failureDestination: ACCOUNT_C,
          },
          baseVault,
        );
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CreateIntegrityError);
        const error = err as CreateIntegrityError;
        expect(error.mismatches.successDestination).toBeDefined();
        expect(error.mismatches.failureDestination).toBeDefined();
      }
    });
  });

  describe("address normalization", () => {
    it("trims whitespace for comparison", () => {
      expect(normalizeAddressForComparison(`  ${ACCOUNT_A}  `)).toBe(ACCOUNT_A);
      expect(() =>
        verifyCreateIntegrity(
          { ...expectedValues, successAddress: `  ${ACCOUNT_B}  ` },
          { ...baseApiVault, successDestination: ACCOUNT_B },
          baseVault,
        ),
      ).not.toThrow();
    });
  });
});
