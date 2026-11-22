# FundReleaseStatus

`FundReleaseStatus` communicates where locked vault funds went after settlement. It gives vault owners and verifiers a single panel for the outcome, destination, amount, settlement timestamp, and Stellar transaction proof.

## Outcomes

| Outcome | Meaning | Token |
| --- | --- | --- |
| `released` | Funds were released to the success destination. | `--success` |
| `redirected` | Funds were redirected to the failure destination. | `--danger` |
| `pending` | Funds are still locked and no settlement transaction exists yet. | `--warning` |

Each outcome includes both icon and text, so the state is not conveyed by color alone.

## Accessibility

- Long destination addresses and transaction hashes are visually truncated.
- The full destination is preserved in `title` and `aria-label`.
- Transaction links include the full hash and the active Stellar network in their accessible label.

## Explorer Links

The component reads `network` from `WalletContext`:

- `TESTNET` links to `https://stellar.expert/explorer/testnet/tx/{hash}`.
- `PUBLIC` links to `https://stellar.expert/explorer/public/tx/{hash}`.
- A missing network falls back to TESTNET for safer development defaults.

## Bounds and Invariants

The component enforces explicit bounds to keep rendering and network costs
bounded even for adversarial inputs:

| Constant | Value | Purpose |
| --- | --- | --- |
| `MAX_AMOUNT` | 1e12 | Caps the displayed amount; larger values are clamped. |
| `MAX_CURRENCY_LENGTH` | 16 | Truncates over-long currency strings. |
| `MAX_ADDRESS_LENGTH` | 128 | Bounds the destination address string. |
| `MAX_HASH_LENGTH` | 128 | Bounds the transaction hash string. |

State invariants are validated and logged via the shared `logger`:

- A `released` or `redirected` outcome must carry a `destinationAddress`.
- A `pending` outcome must NOT carry settlement details (destination or hash).
- `amount` must be a finite, non-negative number within `MAX_AMOUNT`.
- `currency` must be a non-empty string within `MAX_CURRENCY_LENGTH`.

Violations are logged as structured warnings without leaking secrets (only
field names and outcome are included, never full addresses or hashes).
