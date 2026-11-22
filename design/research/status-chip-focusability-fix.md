# StatusChip Focusability Fix

## Problem

Previously, every `StatusChip` rendered on the page had `tabIndex={0}` unconditionally, making each chip a keyboard focus stop. On list-heavy pages (Vaults, ValidationHistory, PendingValidations, Dashboard vault cards), this meant keyboard users had to tab through one extra, purely-informational stop per row just to reach the next interactive control.

### Impact

- **Bloated tab order**: On a page with 20 vault cards, that's 20 extra tab stops
- **No actionable behavior**: The chips don't do anything when activated - they only expose a tooltip
- **Redundant information**: The `aria-label` already carries the status information for screen readers

## Solution

Make StatusChip focusable **only when a custom tooltip is explicitly provided**, indicating the developer wants to draw attention to additional information.

### Implementation

```tsx
// Only make focusable if a custom tooltip was explicitly provided.
// The aria-label already exposes the status to screen readers, so keyboard
// users don't need a tab stop just to read the default description.
const shouldBeFocusable = tooltip !== undefined;

const chip = (
  <span
    // ... other props
    aria-label={displayLabel}
    {...(shouldBeFocusable && { tabIndex: 0 })}
  >
    {displayLabel}
  </span>
);
```

### Behavior

| Scenario | Focusable? | Reasoning |
|----------|-----------|-----------|
| `<StatusChip status="active" />` | ❌ No | Default tooltip shows standard description; screen readers have aria-label |
| `<StatusChip status="active" label="Custom" />` | ❌ No | Still using default tooltip content; only label text changed |
| `<StatusChip status="active" tooltip="Important info!" />` | ✅ Yes | Custom tooltip provided - developer wants to expose this information |

## Benefits

1. **Reduced cognitive load**: Keyboard users can navigate through lists more efficiently
2. **Maintained accessibility**: Screen readers still get full status information via `aria-label`
3. **Opt-in complexity**: Developers can still make chips focusable when needed by providing a custom tooltip
4. **Progressive enhancement**: Default behavior is simpler; complexity only when explicitly requested

## Testing

Added test cases to verify:
- Chips are not focusable by default
- Chips become focusable when custom tooltip is provided
- Overriding label without custom tooltip keeps chip non-focusable

## Related Files

- `src/components/StatusChip.tsx` - Implementation
- `src/components/__tests__/StatusChip.test.tsx` - Tests
- `design-system/documentation/status-chip.md` - Documentation updated

## Migration Notes

No breaking changes. This is a pure improvement to default behavior:
- All existing usages without custom tooltips will automatically benefit from reduced tab stops
- Any rare cases that were relying on focusability can add a custom `tooltip` prop
