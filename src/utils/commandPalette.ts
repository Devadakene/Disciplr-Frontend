export interface MatchResult {
  score: number;
  ranges: [number, number][];
}

function isWordBoundary(text: string, idx: number): boolean {
  if (idx === 0) return true;
  const prev = text.charCodeAt(idx - 1);
  const curr = text.charCodeAt(idx);
  // ASCII whitespace, dash, underscore, slash, dot, colon, etc.
  if (
    prev === 32 ||
    prev === 45 ||
    prev === 95 ||
    prev === 47 ||
    prev === 46 ||
    prev === 58 ||
    prev === 92 ||
    prev === 40 ||
    prev === 41 ||
    prev === 91 ||
    prev === 93
  ) {
    return true;
  }
  // camelCase boundary: prev is lowercase, curr is uppercase
  if (prev >= 97 && prev <= 122 && curr >= 65 && curr <= 90) {
    return true;
  }
  return false;
}

function normalizeDiacritics(str: string): string {
  let hasNonAscii = false;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      hasNonAscii = true;
      break;
    }
  }
  if (!hasNonAscii) {
    return str.toLowerCase();
  }
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Scores how well `query` matches `text`.
 * Returns `{ score, ranges }` if `query` is a subsequence of `text`, or `null` otherwise.
 *
 * Scoring bonuses:
 * - Substring / consecutive match bonuses
 * - Word boundary matches (+25)
 * - Prefix matches (+30..+40)
 * - Exact full matches (+50)
 *
 * Penalties:
 * - Distance/gap penalty between non-consecutive matches
 */
export function scoreMatch(query: string, text: string): MatchResult | null {
  const qTrim = query.trim();
  if (!qTrim) {
    return { score: 0, ranges: [] };
  }
  if (!text) {
    return null;
  }

  const qLen = qTrim.length;
  const tLen = text.length;
  if (tLen < qLen) {
    return null;
  }

  const normQ = normalizeDiacritics(qTrim);
  const normT = normalizeDiacritics(text);

  // Quick subsequence check
  let qi = 0;
  for (let ti = 0; ti < normT.length && qi < normQ.length; ti++) {
    if (normT.charCodeAt(ti) === normQ.charCodeAt(qi)) {
      qi++;
    }
  }
  if (qi < normQ.length) {
    return null;
  }

  // 1. Contiguous substring fast path
  const subIdx = normT.indexOf(normQ);
  if (subIdx !== -1) {
    let score = 100 + normQ.length * 10;
    if (subIdx === 0) score += 40;
    if (isWordBoundary(text, subIdx)) score += 30;
    if (normQ.length === normT.trim().length) score += 50;
    score -= subIdx;
    return { score, ranges: [[subIdx, subIdx + normQ.length]] };
  }

  // 2. Subsequence with word boundary preference
  const firstChar = normQ.charCodeAt(0);
  let bestScore = -Infinity;
  let bestPositions: number[] | null = null;

  for (let start = 0; start < normT.length; start++) {
    if (normT.charCodeAt(start) !== firstChar) continue;
    const isBnd = isWordBoundary(text, start);
    if (start !== 0 && !isBnd && bestPositions) break;

    const positions = [start];
    let currScore = 10;
    if (start === 0) currScore += 30;
    if (isBnd) currScore += 25;

    let pTi = start;
    let matched = true;

    for (let j = 1; j < normQ.length; j++) {
      const targetChar = normQ.charCodeAt(j);
      let found = -1;
      let foundScore = -Infinity;

      for (let k = pTi + 1; k < normT.length; k++) {
        if (normT.charCodeAt(k) === targetChar) {
          const isConsec = k === pTi + 1;
          const isB = isWordBoundary(text, k);
          const s = 10 + (isConsec ? 25 : 0) + (isB ? 20 : 0) - (k - pTi - 1);
          if (s > foundScore) {
            foundScore = s;
            found = k;
            if (isConsec || isB) break;
          }
        }
      }

      if (found === -1) {
        matched = false;
        break;
      }
      positions.push(found);
      currScore += foundScore;
      pTi = found;
    }

    if (matched && currScore > bestScore) {
      bestScore = currScore;
      bestPositions = positions;
    }
    if (isBnd && matched) break;
  }

  if (!bestPositions) {
    return null;
  }

  const ranges: [number, number][] = [];
  let rStart = bestPositions[0];
  let rEnd = rStart + 1;
  for (let i = 1; i < bestPositions.length; i++) {
    const p = bestPositions[i];
    if (p === rEnd) {
      rEnd = p + 1;
    } else {
      ranges.push([rStart, rEnd]);
      rStart = p;
      rEnd = p + 1;
    }
  }
  ranges.push([rStart, rEnd]);

  return { score: bestScore, ranges };
}

/**
 * Backward compatibility wrapper.
 */
export function fuzzyMatch(query: string, value: string): boolean {
  return scoreMatch(query, value) !== null;
}
