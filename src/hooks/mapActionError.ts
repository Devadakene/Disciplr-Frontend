import { ApiError } from "../services/api";

export const GENERIC_ACTION_ERROR =
  "The action could not be submitted. Please try again.";

export function mapActionError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return "You appear to be offline. Please check your connection and try again.";
    }
    if (err.status === 403) {
      return "Only the vault's verifier can do this.";
    }
    if (err.status === 409) {
      return "This vault is already settled or inactive.";
    }
  }
  return GENERIC_ACTION_ERROR;
}
