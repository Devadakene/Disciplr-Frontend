import { describe, expect, it } from "vitest";
import { fuzzyMatch, scoreMatch } from "../commandPalette";

describe("scoreMatch", () => {
  it("handles empty query", () => {
    expect(scoreMatch("", "Alpha Vault")).toEqual({ score: 0, ranges: [] });
    expect(scoreMatch("   ", "Alpha Vault")).toEqual({ score: 0, ranges: [] });
  });

  it("returns null for non-matching queries or empty target text", () => {
    expect(scoreMatch("xyz", "Alpha Vault")).toBeNull();
    expect(scoreMatch("vlt", "")).toBeNull();
  });

  it("handles diacritics and case-insensitivity", () => {
    const res = scoreMatch("cafe", "Café");
    expect(res).not.toBeNull();
    expect(res?.ranges).toEqual([[0, 4]]);

    const res2 = scoreMatch("résumé", "Resume");
    expect(res2).not.toBeNull();
    expect(res2?.ranges).toEqual([[0, 6]]);
  });

  it("handles regex-special characters in query and target without crashing", () => {
    const res = scoreMatch("[test]", "Alpha [test] Beta");
    expect(res).not.toBeNull();
    expect(res?.ranges).toEqual([[6, 12]]);

    const res2 = scoreMatch("a(b)", "a(b)");
    expect(res2).not.toBeNull();
    expect(res2?.ranges).toEqual([[0, 4]]);

    const res3 = scoreMatch(".*+?^${}()|[]\\", ".*+?^${}()|[]\\");
    expect(res3).not.toBeNull();
  });

  it("computes correct ranges for contiguous and non-contiguous matches", () => {
    const res = scoreMatch("alp", "Alpha Vault");
    expect(res).not.toBeNull();
    expect(res?.ranges).toEqual([[0, 3]]);

    const res2 = scoreMatch("av", "Alpha Vault");
    expect(res2).not.toBeNull();
    expect(res2?.ranges).toEqual([
      [0, 1],
      [6, 7],
    ]);
  });

  describe("scoring order tables", () => {
    it("ranks prefix matches above interior matches", () => {
      const prefix = scoreMatch("vault", "Vault Detail");
      const interior = scoreMatch("vault", "Browse all vaults");
      expect(prefix).not.toBeNull();
      expect(interior).not.toBeNull();
      expect(prefix!.score).toBeGreaterThan(interior!.score);
    });

    it("ranks word-boundary matches above random subsequence matches", () => {
      const boundary = scoreMatch("cv", "Create Vault");
      const nonBoundary = scoreMatch("cv", "Archive Vault");
      expect(boundary).not.toBeNull();
      expect(nonBoundary).not.toBeNull();
      expect(boundary!.score).toBeGreaterThan(nonBoundary!.score);
    });

    it("query 'vlt' ranks vault items above 'Dashboard'", () => {
      const vaultMatch = scoreMatch("vlt", "Alpha Vault");
      const dashboardMatch = scoreMatch("vlt", "Dashboard");
      expect(vaultMatch).not.toBeNull();
      expect(dashboardMatch).toBeNull();
    });

    it("query 'cv' ranks 'Create Vault' first", () => {
      const createVault = scoreMatch("cv", "Create Vault");
      const verifierQueue = scoreMatch("cv", "Verifier Queue");
      expect(createVault).not.toBeNull();
      expect(verifierQueue).toBeNull();
    });
  });

  describe("performance budget", () => {
    it("filters and scores 1000 items in under 5ms per keystroke", () => {
      const items = Array.from({ length: 1000 }, (_, i) =>
        i % 10 === 0 ? `Vault ${i}` : `Action ${i} detail`,
      );
      const query = "vlt";

      // Warmup
      for (let i = 0; i < 20; i++) {
        scoreMatch(query, items[i]);
      }

      const start = performance.now();
      for (let i = 0; i < items.length; i++) {
        scoreMatch(query, items[i]);
      }
      const elapsed = performance.now() - start;

      // Budget is < 5ms for 1000 items
      expect(elapsed).toBeLessThan(5);
    });
  });
});

describe("fuzzyMatch", () => {
  it("matches subsequence queries without requiring contiguous letters", () => {
    expect(fuzzyMatch("av", "Alpha Vault")).toBe(true);
    expect(fuzzyMatch("b2", "beta-2")).toBe(true);
    expect(fuzzyMatch("zz", "Alpha Vault")).toBe(false);
  });
});
