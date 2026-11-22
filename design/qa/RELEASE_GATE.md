# Release Gate — Design-Approved Builds

**Purpose:** Define the minimum pass/fail criteria that must be satisfied before a build is considered design-approved and eligible to merge to `main`.  
**Applies to:** Any PR that touches `src/`, `design-system/`, `index.html`, or `public/`.  
**Owner:** Design lead signs off; Engineering lead confirms gates are met.  
**Timeframe:** Review must complete within 96 hours of PR opening.

---

> **⚠️ Automation status (as of 2026-07-27)**
>
> This repository does **not** yet have a `.github/workflows/` CI pipeline.
> The third-party visual-regression dependencies listed under G6
> (`@percy/cli`, `@percy/playwright`, `chromatic`) are **not** installed.
> Until workflows exist, **every gate is a manual reviewer checklist item**,
> not an automated merge block.  A PR can currently merge to `main` without
> any automated check catching a violation of G1–G8.
>
> **What is automated today:**
> - `npm test` (Vitest) — enforces coverage thresholds
>   (`statements: 50`, `branches: 80`, `functions: 65`, `lines: 50`) and
>   runs component/unit tests.
> - `npm run lint` (ESLint) — catches code-style and some a11y issues
>   via `eslint-plugin-jsx-a11y` if configured.
>
> **Action required (tracked separately):**
> 1. Stand up a `.github/workflows/ci.yml` that runs `npm test` and
>    `npm run lint` on every PR touching the paths above.
> 2. Integrate a visual-regression tool (Percy, Chromatic, or Playwright
>    screenshot diff) and install the corresponding package before marking
>    G6 as automated.
> 3. Once each gate has an automated enforcement mechanism, update this
>    table to remove the "Manual" caveat for that gate.

---

## Gate summary

| Gate | Type | Blocks merge? | Enforcement |
|---|---|---|---|
| G1 — Contrast (WCAG 2.1 AA) | Hard | ✅ Yes | Manual review |
| G2 — Focus management | Hard | ✅ Yes | Manual review |
| G3 — Touch targets | Hard | ✅ Yes | Manual review |
| G4 — No horizontal overflow | Hard | ✅ Yes | Manual review |
| G5 — Reduced-motion compliance | Hard | ✅ Yes | Manual review |
| G6 — Visual regression (Percy/Chromatic) | Hard | ✅ Yes (unapproved diffs) | Manual screenshots — no CI tooling installed |
| G7 — Screen reader smoke test | Hard | ✅ Yes (critical flows) | Manual review |
| G8 — Token alignment | Hard | ✅ Yes | Manual review |
| G9 — Dark mode contrast gaps | Soft | ⚠️ No (document only) | Manual review |
| G10 — Figma traceability | Soft | ⚠️ No (must document) | Manual review |
| G11 — Design critique sign-off | Soft | ⚠️ No (async OK) | Manual review |

---

## Hard gates (block merge)

### G1 — Contrast (WCAG 2.1 AA)

**Pass:** Every text/UI element listed in `DESIGN_QA_CHECKLIST.md §1` meets its required ratio.

**Fail criteria (any one fails the gate):**
- Normal text (< 18 px regular, < 14 px bold) below **4.5 : 1**
- Large text (≥ 18 px regular or ≥ 14 px bold) below **3 : 1**
- UI component (button border, input border, focus ring) below **3 : 1**
- Status badge text on badge background below **3 : 1**

**How to verify:** WebAIM Contrast Checker, browser DevTools accessibility panel, or `axe-core` in CI.

**Exception process:** If a token value must change to pass, update `design-system/tokens/colors.json` and `src/index.css` in the same PR. Tag the token change in the PR description.

---

### G2 — Focus management

**Pass:** All interactive elements receive visible focus; modals trap focus; focus returns to trigger on close.

**Fail criteria:**
- Any interactive element unreachable by keyboard
- Any interactive element with no visible focus indicator
- Modal does not trap focus
- Focus does not return to trigger after modal close
- Form errors not announced to screen reader on submit

---

### G3 — Touch targets

**Pass:** All interactive elements on mobile viewports (≤ 640 px) have a minimum hit area of **44 × 44 px**.

**Fail criteria:**
- Any button, link, or control with a rendered hit area smaller than 44 × 44 px at 375 px viewport
- The `--touch-target: 44px` CSS variable is overridden to a smaller value without design approval

---

### G4 — No horizontal overflow

**Pass:** No page produces a horizontal scrollbar at any tested viewport (375, 640, 768, 1024, 1280 px).

**Fail criteria:**
- `document.documentElement.scrollWidth > window.innerWidth` at any breakpoint
- Any element visually clips outside the viewport

**Quick test:**
```js
// Paste in DevTools console
document.querySelectorAll('*').forEach(el => {
  if (el.offsetWidth > document.documentElement.offsetWidth) {
    console.warn('Overflow:', el);
  }
});
```

---

### G5 — Reduced-motion compliance

**Pass:** Under `prefers-reduced-motion: reduce`, all animation durations collapse to ≤ 1 ms and no content flashes > 3 times/second.

**Fail criteria:**
- Any CSS transition or animation duration > 1 ms under reduced-motion
- Any Framer Motion component that does not check `useReducedMotion()`
- Any looping animation that cannot be paused by the user

**How to verify:** Enable "Emulate CSS media feature prefers-reduced-motion" in DevTools → Rendering panel.

---

### G6 — Visual regression (Percy/Chromatic)

**Pass:** All Percy/Chromatic diffs on the PR have been reviewed and **explicitly approved** by the design lead.

**Fail criteria:**
- Any unreviewed diff (Percy/Chromatic shows "Changes detected" without approval)
- Percy/Chromatic CI check is red

**Exception:** If Percy/Chromatic is not yet configured, the manual snapshot list in `VISUAL_REGRESSION_TARGETS.md` must be completed and attached to the PR as before/after screenshots. Design lead must comment "✅ visual approved" on the PR.

---

### G7 — Screen reader smoke test

**Pass:** The critical flows listed below complete without errors using VoiceOver (macOS) or NVDA (Windows).

**Critical flows (must pass):**
1. Navigate to Vaults list — each vault card announces name, amount, status
2. Open Create Vault form — all labels announced; submit with empty fields announces errors
3. Open and close a modal — dialog role announced; focus trap confirmed; focus returns to trigger
4. Toggle theme — button state announced

**Fail criteria:**
- Any critical flow item above fails
- A form input has no associated label
- A modal lacks `role="dialog"` and `aria-labelledby`

---

### G8 — Token alignment

**Pass:** All color, spacing, typography, and motion values used in code reference CSS variables or token values defined in `design-system/tokens/*.json`. No hardcoded hex values, pixel sizes, or durations outside the token system.

**Fail criteria:**
- Hardcoded color hex in component styles (e.g. `color: #14B8A6` instead of `color: var(--accent)`)
- Hardcoded spacing in px that does not correspond to a `--spacing-*` token
- New animation duration not defined in `design-system/tokens/motion.json`

**Exception:** Third-party component overrides may use hardcoded values if the token cannot be applied. Document the exception in the PR.

---

## Soft gates (warn, do not block)

### G9 — Dark mode contrast gaps

Document any dark-mode contrast values below 4.5 : 1 for normal text in the PR description under "Dark mode gaps". These are tracked but do not block merge unless they are new regressions introduced by the PR.

Known existing gaps (as of initial audit):
- `--muted` (#9CA3AF) on dark `--bg` (#111827): ~3.9 : 1 — acceptable for caption/secondary text ≥ 18 px only
- `--accent` (#14B8A6) on dark `--bg` (#111827): ~3.1 : 1 — acceptable for large/bold text only

---

### G10 — Figma traceability

The PR description must include:
- Figma file URL (or note "no Figma file — design in code")
- Figma node IDs for any new or changed components
- List of `design-system/tokens/*.json` files updated (or "no token changes")

Missing traceability does not block merge but must be added within 48 hours of merge.

---

### G11 — Design critique sign-off

A synchronous or async design critique (eng + design) must occur for any PR that:
- Introduces a new page or modal
- Changes the visual design of an existing page (not just a bug fix)
- Updates token values

Sign-off is recorded as a PR comment: "✅ design critique complete — [name], [date]".

Async sign-off (Loom or annotated screenshot) is acceptable within the 96-hour window.

---

## PR description template

Copy this into every design-touching PR:

```markdown
## Design QA

### Gates
- [ ] G1 Contrast — all items in DESIGN_QA_CHECKLIST.md §1 checked
- [ ] G2 Focus — keyboard nav and modal focus trap verified
- [ ] G3 Touch targets — 44×44 px minimum on mobile
- [ ] G4 No horizontal overflow — verified at 375, 768, 1280 px
- [ ] G5 Reduced-motion — verified with DevTools emulation
- [ ] G6 Visual regression — Percy/Chromatic diffs approved (or manual screenshots attached)
- [ ] G7 Screen reader — critical flows tested with VoiceOver/NVDA
- [ ] G8 Token alignment — no hardcoded values outside token system

### Soft gates
- [ ] G9 Dark mode gaps documented (or "none")
- [ ] G10 Figma link: <!-- paste URL -->
- [ ] G11 Design critique: <!-- "complete — name, date" or "async — Loom link" -->

### Token changes
<!-- List any design-system/tokens/*.json changes, or "none" -->

### Screenshots
<!-- Before / after at 375 px and 1280 px, light and dark -->
```

---

## Escalation

If a hard gate cannot be met within the 96-hour window:

1. Open a follow-up issue tagged `design-debt` with the specific failure and a proposed fix.
2. Get explicit sign-off from both design lead and engineering lead to merge with the known gap.
3. The follow-up issue must be resolved before the next release.

---

## Revision history

| Date | Change | Author |
|---|---|---|
| 2026-04-29 | Initial version | Kiro |
| 2026-07-27 | Added automation-status warning; annotated gate table with current enforcement mode; documented what is actually automated today (Vitest coverage, ESLint) vs what remains manual | Kiro |
