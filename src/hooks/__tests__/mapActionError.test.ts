import { describe, it, expect } from "vitest";
import { ApiError } from "../../services/api";
import { GENERIC_ACTION_ERROR, mapActionError } from "../mapActionError";

describe("mapActionError", () => {
  it.each([
    {
      name: "ApiError 409 -> conflict message",
      input: new ApiError("Conflict", 409),
      expected: "This vault is already settled or inactive.",
    },
    {
      name: "ApiError 403 -> verifier forbidden message",
      input: new ApiError("Forbidden", 403),
      expected: "Only the vault's verifier can do this.",
    },
    {
      name: "network ApiError status 0 -> offline message",
      input: new ApiError("Could not reach the Disciplr API.", 0),
      expected:
        "You appear to be offline. Please check your connection and try again.",
    },
    {
      name: "unknown Error -> generic message",
      input: new Error("Unexpected internal failure"),
      expected: GENERIC_ACTION_ERROR,
    },
    {
      name: "non-Error throw (string) -> generic message",
      input: "raw failure",
      expected: GENERIC_ACTION_ERROR,
    },
    {
      name: "non-Error throw (null) -> generic message",
      input: null,
      expected: GENERIC_ACTION_ERROR,
    },
  ])("$name", ({ input, expected }) => {
    expect(mapActionError(input)).toBe(expected);
  });
});
