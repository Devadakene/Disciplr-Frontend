# Design System Token Authoring Guide

This guide outlines the conventions and rules for adding or modifying design tokens in this repository. Our tokens follow the [Design Token Community Group (DTCG) specification](https://design-tokens.github.io/community-group/format/) and are strictly validated in CI.

## 1. Naming Conventions

All tokens must pass the `isKebabCase` and `hasValidTokenPrefix` checks enforced by `validators.ts`.

* **Format:** Tokens must strictly use `kebab-case`.
* **Prefixes:** Every token must start with a valid category prefix:
    * `chart-*`
    * `color-*`
    * `font-*`
    * `spacing-*`
    * `typography-*`
    * `border-*`
    * `shadow-*`
    * `radius-*`
    * `motion-*`
    * `z-index-*`

## 2. Standard Token Structure

Every token requires a `$type` and a `$value`. We also highly encourage a `$description`. 

### Colors
Colors usually require light/dark modes and optional accessibility metadata (validated via `isValidColorToken`).

```json
{
  "color-surface-primary": {
    "$type": "color",
    "$value": {
      "light": "#ffffff",
      "dark": "#121212"
    },
    "$description": "The primary background surface color.",
    "$extensions": {
      "accessibility": {
        "contrastRequirement": "WCAG21:AA",
        "minimumContrast": 4.5
      }
    }
  }
}
```

### Dimensions & Spacing

Spacing, borders, and typography sizes use the dimension type.

```json
{
  "spacing-layout-medium": {
    "$type": "dimension",
    "$value": "16px",
    "$description": "Standard container padding."
  }
}
```

### Motion / Animation

Motion tokens dictate duration and easing curves.

```json
{
  "motion-duration-fast": {
    "$type": "duration",
    "$value": "150ms",
    "$description": "Used for simple hover state transitions."
  }
}
```

### Chart Tokens (Complex Surfaces)

Chart tokens are structurally unique. The isValidChartTokens validator enforces that chart tokens define their colors based on the surface they sit on, ensuring contrast is maintained across different backgrounds.

```json
{
  "chart-line-primary": {
    "$type": "color",
    "$description": "Primary data line in analytics charts.",
    "$value": {
      "surface-light": {
        "light": "#0055ff",
        "dark": "#6699ff"
      },
      "surface-dark": {
        "light": "#6699ff",
        "dark": "#0055ff"
      }
    }
  }
}
```

### Copy-Paste Template

Use this blank template when adding a new standard color token:

```json
{
  "prefix-category-element": {
    "$type": "color",
    "$description": "Description of where and how to use this token.",
    "$value": {
      "light": "#HEXCODE",
      "dark": "#HEXCODE"
    },
    "$extensions": {
      "accessibility": {
        "contrastRequirement": "WCAG21:AA"
      }
    }
  }
}
```
