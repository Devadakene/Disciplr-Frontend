# Performance Observability

## Web Vitals Reporting (Issue #1536)

Disciplr uses a lightweight web-vitals reporting seam to capture Core Web Vitals for performance observability. This enables detection of regressions from heavy components (recharts, jsPDF) and data-heavy tables in vault/verifier flows.

### Implementation

**Locations:** `src/utils/reportWebVitals.ts` (measurement) and `src/utils/vitalsSink.ts` (delivery)

The reporter uses the native Performance API to capture:
- **LCP** (Largest Contentful Paint) - Loading performance
- **CLS** (Cumulative Layout Shift) - Visual stability
- **INP** (Interaction to Next Paint) - Interactivity

FID is no longer reported: it is deprecated in favour of INP.

Measurement follows the reference algorithms from the [`web-vitals`](https://github.com/GoogleChrome/web-vitals) package (v5), without taking a dependency on it, so the app keeps its zero-external-dependency design:

- **CLS** - Layout shifts are grouped into session windows (max 5s window, resets after 1s of no shifts or on input). Shifts with `hadRecentInput` are excluded. The largest window is reported; `0` is reported if no shifts occurred.
- **INP** - Event timings (via the `event` observer with `durationThreshold: 40` plus `first-input`) are grouped by `interactionId`, keeping the longest duration per interaction. Entries with a falsy `interactionId` are ignored. The reported value is the p98 estimate over the top-10 longest interactions (index `min(len - 1, floor(count / 50))`).
- **LCP** - The latest entry's value (`renderTime || loadTime || startTime`) is held until finalisation; later entries after finalisation are ignored.

### Finalisation

Each metric is reported **exactly once** per page lifecycle:

- **LCP** finalises on the first `keydown`/`pointerdown`, or when the page hides - whichever comes first.
- **CLS** and **INP** finalise when the page hides.
- "Page hides" means `visibilitychange -> hidden` or `pagehide`; buffered records are flushed with `PerformanceObserver.takeRecords()` first so nothing observed during the event is lost.
- On a `pageshow` with `persisted` (back/forward-cache restore) the session state resets with new metric ids and observers re-arm with `buffered: false`, so pre-restore entries are not replayed as new metrics.

### Metric Interface

```typescript
interface Metric {
  id: string;           // Unique identifier, 'v1-<timestamp>-<random>'
  name: string;         // 'LCP' | 'CLS' | 'INP'
  value: number;        // Metric value in milliseconds (LCP, INP) or unitless (CLS)
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;        // Change from the previous reported value
  navigationType?: string; // 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'unknown'
}
```

### Rating Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5s | 2.5s - 4.0s | > 4.0s |
| CLS | < 0.1 | 0.1 - 0.25 | > 0.25 |
| INP | < 200ms | 200ms - 500ms | > 500ms |

### Delivery: the vitals sink

**Location:** `src/utils/vitalsSink.ts`

`src/main.tsx` wires `reportWebVitals` to `defaultVitalsHandler(logger)`, which wraps `createVitalsSink().onMetric`. Behaviour:

- **Off by default.** Without `VITE_VITALS_ENDPOINT` the sink is inactive: no network calls, no listeners beyond dev logging.
- **Opt-in endpoint.** `VITE_VITALS_ENDPOINT` accepts an absolute `http(s)` URL or an app-relative `/path`. Anything else (e.g. `javascript:`, `//host`, credentials in the URL) is ignored with a dev warning and the sink stays disabled.
- **Sampling.** `VITE_VITALS_SAMPLE_RATE` (default `0.1`, invalid values fall back to the default) is applied once per page load with `Math.random`. Unsampled pages never buffer or send.
- **Batching.** Sampled metrics are buffered and sent as one JSON batch via `navigator.sendBeacon` when the page hides: `{ ts, nav?, metrics: [{ id, name, value, rating, delta, path }] }`. The flush is scheduled from a microtask queued on `visibilitychange -> hidden` / `pagehide`, which runs after `reportWebVitals` has finalised the same event, so finalised metrics are always included. Flushing an empty buffer is a no-op.
- **Path normalisation.** Each metric records `location.pathname` with query strings and hashes stripped, route params matched against the patterns in `src/App.tsx` (e.g. `/vaults/:id`), and unknown segments reduced to `:param`, so payloads can never carry wallet addresses or other sensitive query parameters.
- **Production silence.** Dev output goes through the shared `logger` (see `src/utils/logger.ts`), which is a no-op in production builds - production emits no console output for vitals.
- **Never throws.** Failures in buffering, serialisation, the beacon itself, or sink setup are caught and logged; a broken setup yields an inert sink.

To send vitals to your own collector, set the environment variables in `.env`:

```bash
VITE_VITALS_ENDPOINT=https://collector.example.com/vitals
VITE_VITALS_SAMPLE_RATE=0.1
```

### Usage

**In `src/main.tsx`:**

```typescript
import { reportWebVitals } from './utils/reportWebVitals';

// Default: sink-backed (dev console + optional beacon)
bootstrap({ /* onWebVital defaults to defaultVitalsHandler(logger) */ });

// Custom reporter still supported
bootstrap({
  onWebVital: (metric) => myAnalytics.track('web_vital', metric),
});
```

### Design Principles

1. **Opt-in Production Behavior** - No side effects when no reporter or endpoint is provided
2. **Error Isolation** - Callback and sink errors never crash the application
3. **SSR-Safe** - Gracefully handles server-side rendering (window undefined)
4. **Graceful Degradation** - Works with or without PerformanceObserver support
5. **Zero External Dependencies** - Uses native Performance API only; algorithms mirror the `web-vitals` reference implementation

### Edge Case Handling

- **No callback provided** - Returns early, no observers created
- **Callback throws** - Error logged, app continues; the metric is marked reported so it is not retried
- **Missing PerformanceObserver** - Returns early, no metrics captured
- **SSR environment** - Returns early when window is undefined
- **Observer errors** - Individual observer failures don't affect other metrics
- **No entry type support** - Unsupported types (e.g. `first-input`) are skipped; the remaining metrics still work

### Testing

Tests are located in:

- `src/utils/__tests__/reportWebVitals.test.ts` - measurement and finalisation:
  - Callback wiring with various inputs (undefined, null, non-function)
  - Error handling (callback throws, observer errors)
  - Environment handling (SSR, missing PerformanceObserver)
  - INP grouping/p98 estimation, CLS session windows, LCP finalisation timing
  - Exactly-once reporting on hide/pagehide and back/forward-cache resets
  - End-to-end integration with the sink (beacon payload content)
- `src/utils/__tests__/vitalsSink.test.ts` - delivery:
  - Endpoint/rate resolution and validation fallbacks
  - Sample rate gating with an injected RNG
  - Batch payload shape, path normalisation, single-flush semantics
  - Auto-flush on hide/pagehide, beacon failure isolation, dev logging via `logger`

Run tests with:
```bash
npm run test
```

### Performance Impact

The reporter has minimal performance impact:
- Uses native browser APIs with negligible overhead
- Observers are passive and don't block rendering
- Callback execution is asynchronous
- No network calls unless `VITE_VITALS_ENDPOINT` is configured and the page is sampled

---

## Analytics Page Memoization (Issue #499)

### Problem

The Analytics page (`src/pages/Analytics.tsx`) was re-computing derived data on every render, causing unnecessary chart re-renders and performance degradation:

- Period data selection (`chartData`, `comparisonData`, `displayData`) recreated on every render
- KPI metrics (`kpis`) recalculated when unrelated state changed (theme toggle, comparison mode)
- Legend entries (`successLegendEntries`, `capitalLegendEntries`) recreated on every render
- Callback handlers passed to `AnalyticsCharts` had unstable identities
- `MutationObserver` token sync triggered unnecessary re-renders of derived data

### Solution

Applied targeted memoization using `useMemo` and `useCallback` with precise dependency arrays:

#### 1. Stable Data References (`src/pages/analyticsData.ts`)

Extracted static mock data into a separate module to ensure stable array/object references across renders:

```typescript
// analyticsData.ts - exported constants with stable identity
export const analyticsPeriodData: Record<Period, AnalyticsDataPoint[]> = { ... }
export const prevPeriodData: Record<Period, AnalyticsDataPoint[]> = { ... }
export const vaultStatusData = [...]
export const milestoneTypes = [...]
export const benchmarkData = [...]
export const TEAM_CHART_DATA = [...]
```

#### 2. Memoized Period Data Selection

```typescript
// Only recomputes when `period` changes
const chartData = useMemo(() => analyticsPeriodData[period], [period])
const prevChartData = useMemo(() => prevPeriodData[period], [period])

// Only recomputes when source data changes
const comparisonData = useMemo(
  () => chartData.map((d, i) => ({
    ...d,
    prevSuccess: prevChartData[i]?.success ?? 0,
    prevCapital: prevChartData[i]?.capital ?? 0,
  })),
  [chartData, prevChartData]
)

// Only recomputes when showComparison or source data changes
const displayData = useMemo(
  () => showComparison ? comparisonData : chartData,
  [showComparison, comparisonData, chartData]
)
```

#### 3. Memoized KPI Computation

```typescript
// Only recomputes when chartData or prevChartData changes (not on theme/comparison toggle)
const kpis = useMemo(
  () => computeAnalyticsKpis(chartData as AnalyticsDataPoint[], prevChartData as AnalyticsDataPoint[]),
  [chartData, prevChartData]
)
```

#### 4. Memoized Legend Entries

```typescript
// Stable references when showComparison toggles
const successLegendEntries = useMemo(() => showComparison ? [...] : [...], [showComparison])
const capitalLegendEntries = useMemo(() => showComparison ? [...] : [...], [showComparison])
```

#### 5. Stable Callback Identities

```typescript
// Stable period change handler
const setPeriod = useCallback((p: Period) => {
  setPeriodInternal(p)
  setSearchParams({ period: p })
}, [setSearchParams])

// Stable export handlers
const handleCsvExport = useCallback(() => { ... }, [chartData, period])
const handlePdfExport = useCallback(async () => { ... }, [chartData, period])

// Stable props object for AnalyticsCharts (prevents child re-renders)
const analyticsChartProps = useMemo(() => ({
  displayData, chartData, period, vaultStatusData, teamChartData: TEAM_CHART_DATA,
  showComparison, chartAnimationEnabled, tooltipStyle, seriesColors, chartTokens,
  successLegendEntries, capitalLegendEntries, isLoading
}), [/* all deps */])
```

#### 6. Theme Change Isolation

The `useAnalyticsChartTokens` hook uses a `MutationObserver` on `data-theme` attribute changes. Since derived data (`chartData`, `kpis`, `displayData`) only depends on `period` and source data arrays — not on `chartTokens` — theme changes now only update token-dependent values (`seriesColors`, `tooltipStyle`) without triggering KPI recomputation or chart data regeneration.

### Results

| Scenario | Before | After |
|----------|--------|-------|
| Theme toggle | Full KPI + chart data recompute | Token/color recompute only |
| Comparison toggle | Full KPI + chart data recompute | Legend entries + displayData only |
| Period change | Full recompute (correct) | Full recompute (correct) |
| Unrelated re-render | Full recompute | Zero recompute (stable refs) |

### Verification

Tests in `src/pages/__tests__/Analytics.test.tsx` verify:
- Stable `chartData` reference across unrelated re-renders
- Exact-once recomputation when `period` changes
- Stable KPI object reference when period unchanged
- Stable legend entries when comparison toggles off/on
- No derived data recomputation on theme change
- Zero recomputation on identical props/state render

Run with:
```bash
npm test -- src/pages/__tests__/Analytics.test.tsx
```

### Files Modified

- `src/pages/Analytics.tsx` — Main component with memoization
- `src/pages/analyticsData.ts` — Extracted stable data constants (new)
- `src/pages/analyticsTheme.ts` — Existing token utilities (unchanged)
- `src/utils/analyticsKpis.ts` — Pure KPI computation (unchanged)
- `src/pages/__tests__/Analytics.test.tsx` — Added memoization stability tests
- `docs/PERFORMANCE.md` — This documentation