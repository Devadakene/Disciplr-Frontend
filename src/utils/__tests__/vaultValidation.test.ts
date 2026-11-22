import { ACCOUNT_A, ACCOUNT_B, ACCOUNT_C, ACCOUNT_D, CONTRACT_ADDRESS } from '@/__tests__/fixtures/stellarAddresses';
import { describe, expect, it, vi } from "vitest";

import {
  exceedsBalance,
  isFutureDeadline,
  isValidStellarAddress,
  isValidUsdcAmount,
  validateMilestones,
  validateCreateVault as validateCreateVaultForm,
  type CreateVaultFormValues,
} from "../vaultValidation";

const successAddress = ACCOUNT_A;
const failureAddress = ACCOUNT_B;
const verifierAddress = ACCOUNT_C;
const now = new Date("2026-06-18T00:00:00Z");
const validFormValues: CreateVaultFormValues = {
  name: "Valid vault",
  amount: "100",
  deadline: "2026-06-19T00:00:00Z",
  successAddress,
  failureAddress,
  verifierAddress,
};

function validateCreateVault(
  values: Partial<CreateVaultFormValues>,
  validationDate = new Date(),
  creatorAddress?: string,
) {
  return validateCreateVaultForm(
    { ...validFormValues, ...values },
    validationDate,
    creatorAddress,
  );
}

describe("vaultValidation", () => {
  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("requires a non-empty vault name (%s)", (_case, name) => {
    expect(validateCreateVault({ name }, now).name).toBe("Enter a vault name.");
  });

  it("rejects a vault name longer than 80 characters", () => {
    expect(validateCreateVault({ name: "a".repeat(81) }, now).name).toBe(
      "Vault name must be between 3 and 80 characters.",
    );
  });

  it("rejects control characters in vault names", () => {
    expect(validateCreateVault({ name: "Valid\nvault" }, now).name).toBe(
      "Vault name cannot contain control characters.",
    );
  });

  it("rejects vault names shorter than 3 characters", () => {
    expect(validateCreateVault({ name: "ab" }, now).name).toBe(
      "Vault name must be between 3 and 80 characters.",
    );
  });

  it("requires a verifier address", () => {
    expect(validateCreateVault({ verifierAddress: "" }, now).verifierAddress).toBe(
      "Enter a verifier address.",
    );
  });

  it.each(['successAddress', 'failureAddress', 'verifierAddress'] as const)(
    'rejects a checksum-corrupted %s',
    (field) => {
      const values = {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        verifierAddress,
      };
      const address = values[field];
      const replacement = address.endsWith('A') ? 'B' : 'A';
      const errors = validateCreateVault({
        ...values,
        [field]: `${address.slice(0, -1)}${replacement}`,
      }, now);
      expect(errors).toEqual({
        [field]: 'Enter a valid Stellar public key starting with G or C.',
      });
    },
  );

  it("validates positive USDC amounts with up to 7 decimals", () => {
    expect(isValidUsdcAmount("1")).toBe(true);
    expect(isValidUsdcAmount("0.0000001")).toBe(true);
    expect(isValidUsdcAmount("0")).toBe(false);
    expect(isValidUsdcAmount("-1")).toBe(false);
    expect(isValidUsdcAmount("1.12345678")).toBe(false);
    expect(isValidUsdcAmount("1e3")).toBe(false);
  });

  it("validates Stellar address encoding", () => {
    expect(isValidStellarAddress(successAddress)).toBe(true);
    expect(isValidStellarAddress(` ${successAddress} `)).toBe(true);
    expect(isValidStellarAddress(`M${"A".repeat(55)}`)).toBe(false);
    expect(isValidStellarAddress(`G${"A".repeat(54)}`)).toBe(false);
    expect(isValidStellarAddress(`G${"0".repeat(55)}`)).toBe(false);
  });

  it("requires a valid future deadline", () => {
    expect(isFutureDeadline("2026-06-18T00:00:01Z", now)).toBe(true);
    expect(isFutureDeadline("2026-06-18T00:00:00Z", now)).toBe(false);
    expect(isFutureDeadline("not-a-date", now)).toBe(false);
  });

  it("returns field-specific errors for invalid create-vault values", () => {
    const errors = validateCreateVault(
      {
        amount: "1.12345678",
        deadline: "2020-01-01T00:00:00Z",
        successAddress: "bad",
        failureAddress: "bad",
        milestones: [],
      },
      now,
    ACCOUNT_A,
    );

    expect(errors).toEqual({
      amount: "Enter a positive USDC amount with up to 7 decimal places.",
      deadline: "Choose a future deadline.",
      successAddress: "Enter a valid Stellar public key starting with G or C.",
      failureAddress: "Enter a valid Stellar public key starting with G or C.",
      milestones: { form: "Add at least one milestone." },
    });
  });

  it("rejects identical success and failure destinations", () => {
    const errors = validateCreateVault(
      {
        amount: "100",
        deadline: "2026-06-19T00:00:00Z",
        successAddress,
        failureAddress: successAddress,
        milestones: [{ title: "Launch", criteria: "Verifier approval" }],
      },
      now,
    );

    expect(errors).toEqual({
      failureAddress:
        "Failure destination must be different from success destination.",
    });
  });

  it("rejects contract addresses (C...) when API is enabled", async () => {
    const apiModule = await import("../../services/api");
    const isApiSpy = vi.spyOn(apiModule, "isApiEnabled").mockReturnValue(true);

    try {
      const errors = validateCreateVault(
        {
          amount: "100",
          deadline: "2026-06-19T00:00:00Z",
          successAddress: CONTRACT_ADDRESS,
          failureAddress: ACCOUNT_B,
          milestones: [{ title: "Launch", criteria: "Verifier approval" }],
        },
        now,
      );

      expect(errors.successAddress).toBe(
        "Enter a Stellar account address (starts with G). Contract addresses aren't supported yet.",
      );

      const errors2 = validateCreateVault(
        {
          amount: "100",
          deadline: "2026-06-19T00:00:00Z",
          successAddress: ACCOUNT_A,
          failureAddress: CONTRACT_ADDRESS,
          milestones: [{ title: "Launch", criteria: "Verifier approval" }],
        },
        now,
      );

      expect(errors2.failureAddress).toBe(
        "Enter a Stellar account address (starts with G). Contract addresses aren't supported yet.",
      );
    } finally {
      isApiSpy.mockRestore();
    }
  });

  it("accepts contract addresses (C...) when offline (API disabled)", async () => {
    const apiModule = await import("../../services/api");
    const isApiSpy = vi.spyOn(apiModule, "isApiEnabled").mockReturnValue(false);

    try {
      const errors = validateCreateVault(
        {
          amount: "100",
          deadline: "2026-06-19T00:00:00Z",
          successAddress: CONTRACT_ADDRESS,
          failureAddress: ACCOUNT_B,
          milestones: [{ title: "Launch", criteria: "Verifier approval" }],
        },
        now,
      );

      expect(errors.successAddress).toBeUndefined();
    } finally {
      isApiSpy.mockRestore();
    }
  });

  it("returns no errors for valid create-vault values", () => {

    expect(
      validateCreateVault(
        {
          amount: "100.1234567",
          deadline: "2026-06-19T00:00:00Z",
          successAddress,
          failureAddress,
          milestones: [{ title: "Launch", criteria: "Verifier approval" }],
        },
        now,
      ),
    ).toEqual({});
  });

  it('rejects whitespace-only milestone title', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        milestoneTitle: '   ',
        milestoneCriteria: 'Some criteria',
      },
      now,
    );
    expect(errors).toEqual({ milestoneTitle: 'Enter a milestone title.' });
  });

  it('rejects milestone title over 100 characters', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        milestoneTitle: 'a'.repeat(101),
        milestoneCriteria: 'Some criteria',
      },
      now,
    );
    expect(errors).toEqual({ milestoneTitle: 'Milestone title must be 100 characters or fewer.' });
  });

  it('accepts milestone title at exactly 100 characters', () => {
    expect(
      validateCreateVault(
        {
          amount: '100',
          deadline: '2026-06-19T00:00:00Z',
          successAddress,
          failureAddress,
          milestoneTitle: 'a'.repeat(100),
          milestoneCriteria: 'Some criteria',
        },
        now,
      ),
    ).toEqual({});
  });

  it('rejects whitespace-only milestone criteria', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        milestoneTitle: 'My Milestone',
        milestoneCriteria: '   ',
      },
      now,
    );
    expect(errors).toEqual({ milestoneCriteria: 'Enter the milestone criteria.' });
  });

  it('rejects milestone criteria over 500 characters', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        milestoneTitle: 'My Milestone',
        milestoneCriteria: 'a'.repeat(501),
      },
      now,
    );
    expect(errors).toEqual({ milestoneCriteria: 'Milestone criteria must be 500 characters or fewer.' });
  });

  it('accepts milestone criteria at exactly 500 characters', () => {
    expect(
      validateCreateVault(
        {
          amount: '100',
          deadline: '2026-06-19T00:00:00Z',
          successAddress,
          failureAddress,
          milestoneTitle: 'My Milestone',
          milestoneCriteria: 'a'.repeat(500),
        },
        now,
      ),
    ).toEqual({});
  });

  it('rejects a contract verifier address', () => {
    const errors = validateCreateVault(
      {
        verifierAddress: CONTRACT_ADDRESS,
      },
      now,
    );
    expect(errors.verifierAddress).toBe(
      "Enter a Stellar account address (starts with G). Contract addresses aren't supported yet.",
    );
  });

  it('rejects invalid verifier address', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        verifierAddress: 'bad',
      },
      now,
    );
    expect(errors.verifierAddress).toBe('Enter a valid Stellar public key starting with G or C.');
  });

  it('rejects verifier identical to success address', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        verifierAddress: successAddress,
      },
      now,
    );
    expect(errors.verifierAddress).toBe('Verifier must be different from the success destination.');
  });

  it('rejects verifier identical to the connected creator after trimming', () => {
    const errors = validateCreateVault(
      {
        verifierAddress: ` ${ACCOUNT_A} `,
          successAddress: ACCOUNT_B,
          failureAddress: ACCOUNT_D,
        },
        now,
        ACCOUNT_A,
      );
    expect(errors.verifierAddress).toBe("Verifier cannot be you.");
  });

  it('rejects verifier identical to failure address', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        verifierAddress: failureAddress,
      },
      now,
    );
    expect(errors.verifierAddress).toBe('Verifier must be different from the failure destination.');
  });

  it('accepts valid distinct verifier address', () => {
    const errors = validateCreateVault(
      {
        amount: '100',
        deadline: '2026-06-19T00:00:00Z',
        successAddress,
        failureAddress,
        verifierAddress,
      },
      now,
    );
    expect(errors.verifierAddress).toBeUndefined();
  });
});

describe("validateMilestones", () => {
  it("requires at least one milestone", () => {
    expect(validateMilestones([])).toEqual({
      form: "Add at least one milestone.",
    });
  });

  it("requires title and criteria for each row", () => {
    expect(validateMilestones([{ title: "", criteria: "  " }])).toEqual({
      rows: [
        {
          title: "Enter a milestone title.",
          criteria: "Enter milestone criteria.",
        },
      ],
    });
  });

  it("rejects duplicate titles case-insensitively", () => {
    expect(
      validateMilestones([
        { title: "Launch", criteria: "First approval" },
        { title: " launch ", criteria: "Second approval" },
      ]),
    ).toEqual({
      rows: [
        { title: "Milestone titles must be unique." },
        { title: "Milestone titles must be unique." },
      ],
    });
  });

  it("accepts long criteria text without truncation", () => {
    expect(
      validateMilestones([
        {
          title: "Final delivery",
          criteria: "A".repeat(1000),
        },
      ]),
    ).toBeUndefined();
  });
});

describe("exceedsBalance", () => {
  it("returns true when amount is greater than balance", () => {
    expect(exceedsBalance("200", "100")).toBe(true);
  });

  it("returns false when amount equals balance", () => {
    expect(exceedsBalance("100", "100")).toBe(false);
  });

  it("returns false when amount is less than balance", () => {
    expect(exceedsBalance("50", "100")).toBe(false);
  });

  it("returns false when balance is null (unknown)", () => {
    expect(exceedsBalance("100", null)).toBe(false);
  });

  it("returns false when amount is not a finite number", () => {
    expect(exceedsBalance("abc", "100")).toBe(false);
  });

  it("returns false when balance is not a finite number", () => {
    expect(exceedsBalance("100", "abc")).toBe(false);
  });

  it("handles decimal amounts correctly", () => {
    expect(exceedsBalance("100.01", "100")).toBe(true);
    expect(exceedsBalance("99.99", "100")).toBe(false);
  });
});

describe('exceedsBalance', () => {
  it('returns true when amount is greater than balance', () => {
    expect(exceedsBalance('200', '100')).toBe(true);
  });

  it('returns false when amount equals balance', () => {
    expect(exceedsBalance('100', '100')).toBe(false);
  });

  it('returns false when amount is less than balance', () => {
    expect(exceedsBalance('50', '100')).toBe(false);
  });

  it('returns false when balance is null (unknown)', () => {
    expect(exceedsBalance('100', null)).toBe(false);
  });

  it('returns false when amount is not a finite number', () => {
    expect(exceedsBalance('abc', '100')).toBe(false);
  });

  it('returns false when balance is not a finite number', () => {
    expect(exceedsBalance('100', 'abc')).toBe(false);
  });

  it('handles decimal amounts correctly', () => {
    expect(exceedsBalance('100.01', '100')).toBe(true);
    expect(exceedsBalance('99.99', '100')).toBe(false);
  });
});
