/**
 * Authoring aid, not part of the app. Finds candidate puzzles for a board size:
 *  1. build a grid that obeys the two honest rules and breaks the liar: either a
 *     random fill, or (subtler) a valid standard grid broken by a few swaps that
 *     only the liar's rule can notice;
 *  2. strip givens one at a time, keeping a removal only if, with singles alone,
 *     the true liar still solves completely and both wrong liars still hit a
 *     contradiction (so the lie stays deducible);
 *  3. reject anything whose givens visibly repeat a digit (the lie would be free);
 *  4. optionally pad back up to a fixed clue count, so every liar in a tier gets the
 *     same number of givens and the count itself can't hint at the liar. (When rows
 *     or columns lie, the grid splits into independent stacks/bands, which needs
 *     far more givens than when boxes lie.)
 * Candidates are drafts until they are in the pool and pass `npm run verify`.
 *
 * Run: npm run search -- <size> [trials] [random|subtle] [clues]
 *      e.g. npm run search -- 9 40 subtle 54
 */
import { groups, holds, logicSolve, RULES, visibleRepeat, type Geometry, type Rule } from './lib/checker';

const GEOS: Record<number, Geometry> = {
  4: { size: 4, boxRows: 2, boxCols: 2 },
  6: { size: 6, boxRows: 2, boxCols: 3 },
  9: { size: 9, boxRows: 3, boxCols: 3 },
};

const size = Number(process.argv[2] ?? 6);
const trials = Number(process.argv[3] ?? 30);
const style = process.argv[4] === 'random' ? 'random' : 'subtle';
const targetClues = Number(process.argv[5] ?? 0);
const geo = GEOS[size];
if (!geo) throw new Error(`no geometry for size ${size}`);

let seed = 7_000 + size;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Random grid obeying `enforced` (randomised backtracking, most-constrained cell first). */
function randomFill(enforced: Rule[]): number[] | null {
  const n = geo.size;
  const gs = enforced.flatMap((r) => groups(geo, r));
  const ofCell: number[][] = Array.from({ length: n * n }, () => []);
  gs.forEach((g, gi) => g.forEach((k) => ofCell[k].push(gi)));
  const used = new Array(gs.length).fill(0);
  const grid = new Array(n * n).fill(0);
  let nodes = 0;
  const go = (): boolean => {
    if (++nodes > 200_000) return false;
    let best = -1;
    let bestC: number[] = [];
    for (let k = 0; k < grid.length; k++) {
      if (grid[k]) continue;
      const m = ofCell[k].reduce((a, gi) => a | used[gi], 0);
      const c = [];
      for (let d = 1; d <= n; d++) if (!(m & (1 << (d - 1)))) c.push(d);
      if (c.length === 0) return false;
      if (best === -1 || c.length < bestC.length) [best, bestC] = [k, c];
    }
    if (best === -1) return true;
    for (const d of shuffle(bestC)) {
      grid[best] = d;
      ofCell[best].forEach((gi) => (used[gi] |= 1 << (d - 1)));
      if (go()) return true;
      ofCell[best].forEach((gi) => (used[gi] &= ~(1 << (d - 1))));
      grid[best] = 0;
    }
    return false;
  };
  return go() ? grid : null;
}

/**
 * A valid standard grid, then 1-2 swaps that keep the honest rules intact:
 *  A (rows lie):    swap two cells in one column inside one box
 *  B (columns lie): swap two cells in one row inside one box
 *  C (boxes lie):   swap two whole rows from different bands
 */
function subtleFill(liar: Rule): number[] | null {
  const n = geo.size;
  const g = randomFill(RULES);
  if (!g) return null;
  const swaps = 1 + Math.floor(rand() * 2);
  for (let s = 0; s < swaps; s++) {
    if (liar === 'C') {
      const bands = n / geo.boxRows;
      const b1 = Math.floor(rand() * bands);
      const b2 = (b1 + 1 + Math.floor(rand() * (bands - 1))) % bands;
      const r1 = b1 * geo.boxRows + Math.floor(rand() * geo.boxRows);
      const r2 = b2 * geo.boxRows + Math.floor(rand() * geo.boxRows);
      for (let c = 0; c < n; c++) [g[r1 * n + c], g[r2 * n + c]] = [g[r2 * n + c], g[r1 * n + c]];
    } else {
      // Two distinct cells sharing a column (A) or a row (B), inside the same box.
      const box = groups(geo, 'C')[Math.floor(rand() * n)];
      const [a, b] = shuffle(box)
        .flatMap((x, i, xs) => xs.slice(i + 1).map((y) => [x, y]))
        .find(([x, y]) => (liar === 'A' ? x % n === y % n : Math.floor(x / n) === Math.floor(y / n)))!;
      [g[a], g[b]] = [g[b], g[a]];
    }
  }
  return g;
}

function deducible(givens: number[], liar: Rule): boolean {
  return RULES.every((h) => {
    const out = logicSolve(geo, givens, RULES.filter((r) => r !== h)).outcome;
    return h === liar ? out === 'solved' : out === 'contradiction';
  });
}

interface Candidate {
  liar: Rule;
  givens: number[];
  solution: number[];
  clues: number;
  /** Singles needed before each wrong liar collapses. */
  refute: Record<string, number>;
  solveSteps: number;
}

function candidate(liar: Rule): Candidate | null {
  const enforced = RULES.filter((r) => r !== liar);
  const solution = style === 'subtle' ? subtleFill(liar) : randomFill(enforced);
  if (!solution || holds(geo, solution, liar) || !enforced.every((r) => holds(geo, solution, r))) return null;
  const givens = [...solution];
  // Strip the liar's repeats first so the final givens are less likely to show one.
  const repeatCells = new Set(
    groups(geo, liar).flatMap((g) => g.filter((k) => g.some((o) => o !== k && solution[o] === solution[k]))),
  );
  const order = [...shuffle([...repeatCells]), ...shuffle(givens.map((_, k) => k).filter((k) => !repeatCells.has(k)))];
  for (const k of order) {
    const v = givens[k];
    givens[k] = 0;
    if (!deducible(givens, liar)) givens[k] = v;
  }
  if (visibleRepeat(geo, givens)) return null;
  // Pad up to the tier's clue count with solution cells that keep the lie hidden.
  for (const k of shuffle(givens.map((_, i) => i))) {
    if (givens.filter(Boolean).length >= targetClues) break;
    if (givens[k]) continue;
    givens[k] = solution[k];
    if (visibleRepeat(geo, givens) || !deducible(givens, liar)) givens[k] = 0;
  }
  if (targetClues && givens.filter(Boolean).length !== targetClues) return null;
  const refute: Record<string, number> = {};
  for (const h of RULES) if (h !== liar) refute[h] = logicSolve(geo, givens, RULES.filter((r) => r !== h)).steps.length;
  return {
    liar,
    givens,
    solution,
    clues: givens.filter(Boolean).length,
    refute,
    solveSteps: logicSolve(geo, givens, enforced).steps.length,
  };
}

const rows = (g: number[]) => Array.from({ length: geo.size }, (_, r) => g.slice(r * geo.size, (r + 1) * geo.size));

for (const liar of RULES) {
  const found: Candidate[] = [];
  for (let t = 0; t < trials; t++) {
    const c = candidate(liar);
    if (c) found.push(c);
  }
  console.log(`\nliar ${liar}: ${found.length}/${trials} trials gave a candidate with no visible repeat`);
  // Fairest first: shortest worst-case refutation, then more clues.
  found.sort((a, b) => Math.max(...Object.values(a.refute)) - Math.max(...Object.values(b.refute)) || b.clues - a.clues);
  for (const c of found.slice(0, 3)) {
    console.log(`  ${c.clues} clues, refutations ${JSON.stringify(c.refute)}, true solve ${c.solveSteps} singles`);
    console.log(`    givens:   ${JSON.stringify(rows(c.givens))}`);
    console.log(`    solution: ${JSON.stringify(rows(c.solution))}`);
  }
}
