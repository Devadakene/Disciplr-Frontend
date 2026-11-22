import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { RankedPaletteItem } from "../../utils/commandPalette";

interface PaletteResultsProps {
  results: RankedPaletteItem[];
  activeIndex: number;
  isLoading: boolean;
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: RankedPaletteItem["item"]) => void;
}

function HighlightedText({
  text,
  ranges,
}: {
  text: string;
  ranges?: [number, number][];
}) {
  if (!ranges || ranges.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  ranges.forEach(([start, end], index) => {
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <mark
        key={index}
        style={{
          backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
          color: "inherit",
          fontWeight: 700,
          padding: "0 1px",
          borderRadius: "2px",
        }}
      >
        {text.slice(start, end)}
      </mark>,
    );
    lastIndex = end;
  });
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

export default function PaletteResults({
  results,
  activeIndex,
  isLoading,
  onActiveIndexChange,
  onSelect,
}: PaletteResultsProps) {
  return (
    <div
      id="command-palette-results"
      role="listbox"
      aria-label="Command palette results"
      style={{ maxHeight: "420px", overflowY: "auto", padding: "0.5rem" }}
    >
      {isLoading && results.length === 0 && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span>Loading vaults...</span>
        </div>
      )}
      {results.length === 0 && !isLoading ? (
        <p role="status" style={{ margin: 0, padding: "1rem", color: "var(--muted)" }}>
          No matching vaults or actions.
        </p>
      ) : (
        results.map(({ item, labelRanges, descRanges }, index) => (
          <button
            key={item.id}
            id={`command-palette-option-${index}`}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onSelect(item)}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.25rem",
              border: "none",
              borderRadius: "var(--radius)",
              background:
                index === activeIndex
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "transparent",
              color: "var(--text)",
              cursor: "pointer",
              padding: "0.75rem",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <span style={{ fontWeight: 700 }}>
                <HighlightedText text={item.label} ranges={labelRanges} />
              </span>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--muted)",
                  opacity: 0.8,
                }}
              >
                {item.group}
              </span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              <HighlightedText text={item.description} ranges={descRanges} />
            </span>
          </button>
        ))
      )}
    </div>
  );
}
