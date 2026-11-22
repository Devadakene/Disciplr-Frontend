# MilestoneTracker

`MilestoneTracker` renders vault milestones as an ordered progress list for the
Vault Detail page.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `milestones` | `Milestone[]` | Ordered milestone records from the vault detail model. |

The `Milestone` shape matches the vault detail model:

```ts
type MilestoneStatus = "pending" | "validated" | "failed";

interface Milestone {
  id: string;
  title: string;
  description: string;
  criteria: string;
  status: MilestoneStatus;
  validatedAt?: string;
  evidenceUrl?: string;
}
```

## States

| Status | Badge | Token |
| --- | --- | --- |
| `pending` | Pending | `--warning` |
| `validated` | Validated | `--success` |
| `failed` | Failed | `--danger` |

The first pending milestone is treated as the current step and receives
`aria-current="step"`. Empty lists render a neutral empty state instead of an
empty ordered list. Single-milestone lists keep the same marker, badge, and
current-step behavior.

## Token Usage

- Structure uses `--bg`, `--surface`, `--surface-raised`, `--border`, and
  `--accent-transparent`.
- Status colors use only `--success`, `--warning`, and `--danger`.
- Spacing, border widths, and radii use `--spacing-*`, `--border-width-*`,
  `--radius`, and `--radius-full`.
- No component styles use hardcoded hex color values.

## Accessibility

- The tracker is an ordered list with `aria-label="Vault milestone progress"`.
- The active milestone is exposed with `aria-current="step"`.
- Evidence links use normal anchor semantics and open in a new tab with
  `rel="noopener noreferrer"`.
- The empty state uses `aria-live="polite"` so late-loaded vault data can be
  announced without interrupting the user.

## Bounds and Invariants

The component enforces explicit rendering bounds to keep DOM and layout cost
bounded even for adversarial inputs:

| Constant | Value | Purpose |
| --- | --- | --- |
| `MAX_MILESTONES_RENDERED` | 50 | Caps the number of milestone rows rendered. |
| `MAX_TITLE_LENGTH` | 200 | Truncates over-long milestone titles. |
| `MAX_DESCRIPTION_LENGTH` | 500 | Truncates over-long descriptions. |
| `MAX_CRITERIA_LENGTH` | 500 | Truncates over-long criteria text. |
| `MAX_EVIDENCE_URL_LENGTH` | 2048 | Bounds the URL passed to `SafeLink`. |

State invariants are validated and logged via the shared `logger`:

- A `validated` milestone must carry a `validatedAt` timestamp.
- A `pending` or `failed` milestone must NOT carry a `validatedAt` timestamp.
- Text fields are truncated to the bounds above; truncation is logged.

When more than `MAX_MILESTONES_RENDERED` milestones are supplied, a truncation
notice is rendered and a structured warning is emitted.

## Tests

Component coverage lives in
`src/components/__tests__/MilestoneTracker.test.tsx` and verifies status
rendering, current-step exposure, empty-state handling, evidence links,
single-milestone behavior, rendering bounds, text truncation, and invariant
diagnostics.
