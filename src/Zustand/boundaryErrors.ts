export type BoundaryErrorCode =
  | "DISCONNECTED_WALLET"
  | "WRONG_NETWORK"
  | "INVALID_ADDRESS"
  | "TAMPERED_INPUT"
  | "REPLAY"
  | "MALFORMED_RESPONSE"
  | "SESSION_CHANGED"
  | "UNAUTHORIZED";

export class BoundaryError extends Error {
  readonly code: BoundaryErrorCode;
  readonly details?: unknown;

  constructor(code: BoundaryErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "BoundaryError";
    this.code = code;
    this.details = details;
  }
}

export function isBoundaryError(value: unknown): value is BoundaryError {
  return value instanceof BoundaryError;
}
