/**
 * Size-aware puzzle checker used by the verify gate (and the authoring search).
 * Deliberately independent of the app's src/game code, so a bug there cannot
 * vouch for itself.
 *
 * Grids are flat arrays of length size*size, row-major, 0 = empty, digits 1..size.
 * Rules: A = rows, B = columns, C = boxes (boxRows high x boxCols wide).
 */

export type Rule = 'A' | 'B' | 'C';
export const RULES: Rule[] = ['A', 'B', 'C'];

export interface Geometry {
  size: number;
  boxRows: number;
  boxCols: number;
}

export const RULE_NOUN: Record<Rule, string> = { A: 'row', B: 'column', C: 'box' };

/** Cell indices of every group a rule constrains, in reading order. */
export function groups(geo: Geometry, rule: Rule): number[][] {
  const { size: n, boxRows: br, boxCols: bc } = geo;
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const g: number[] = [];
    for (let j = 0; j < n; j++) {
      if (rule === 'A') g.push(i * n + j);
      else if (rule === 'B') g.push(j * n + i);
      else {
        const boxesPerRow = n / bc;
        const r0 = Math.floor(i / boxesPerRow) * br;
        const c0 = (i % boxesPerRow) * bc;
        g.push((r0 + Math.floor(j / bc)) * n + c0 + (j % bc));
      }
    }
    out.push(g);
  }
  return out;
}

/** True when every group of the rule holds each digit 1..size exactly once. */
export function holds(geo: Geometry, grid: number[], rule: Rule): boolean {
  return groups(geo, rule).every((g) => {
    const seen = new Set(g.map((k) => grid[k]));
    return seen.size === geo.size && [...seen].every((v) => v >= 1 && v <= geo.size);
  });
}

interface Group {
  rule: Rule;
  index: number;
  cells: number[];
}

function buildGroups(geo: Geometry, enforced: Rule[]) {
  const list: Group[] = enforced.flatMap((rule) => groups(geo, rule).map((cells, index) => ({ rule, index, cells })));
  const ofCell: number[][] = Array.from({ length: geo.size * geo.size }, () => []);
  list.forEach((g, gi) => g.cells.forEach((k) => ofCell[k].push(gi)));
  return { list, ofCell };
}

const popcount = (x: number) => {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
};
const lowestDigit = (mask: number) => 31 - Math.clz32(mask & -mask) + 1;

// ---------------------------------------------------------------------------
// Backtracking counter with a hard budget
// ---------------------------------------------------------------------------

export interface Budget {
  maxNodes: number;
  maxMs: number;
}
export const DEFAULT_BUDGET: Budget = { maxNodes: 2_000_000, maxMs: 10_000 };

export type CountResult =
  /** The search finished. `count` is exact unless `capped` (then it means "at least count"). */
  | { status: 'complete'; count: number; capped: boolean; nodes: number; solutions: number[][] }
  /** The search was stopped before finishing: it proves nothing. */
  | { status: 'aborted'; reason: 'node budget' | 'time budget'; nodes: number };

/**
 * Counts completions of `givens` that satisfy every `enforced` rule, stopping at `cap`.
 * Uses bitmask candidates, most-constrained-cell branching and a per-group
 * "every missing digit still has a home" prune.
 */
export function countSolutions(
  geo: Geometry,
  givens: number[],
  enforced: Rule[],
  cap = 2,
  budget: Budget = DEFAULT_BUDGET,
): CountResult {
  const n = geo.size;
  const full = (1 << n) - 1;
  const { list, ofCell } = buildGroups(geo, enforced);
  const used = new Array<number>(list.length).fill(0);
  const grid = [...givens];
  for (let k = 0; k < grid.length; k++) {
    const v = grid[k];
    if (v === 0) continue;
    const bit = 1 << (v - 1);
    for (const gi of ofCell[k]) {
      if (used[gi] & bit) return { status: 'complete', count: 0, capped: false, nodes: 0, solutions: [] };
      used[gi] |= bit;
    }
  }
  const solutions: number[][] = [];
  let nodes = 0;
  const start = Date.now();
  let aborted: 'node budget' | 'time budget' | null = null;

  const cand = (k: number) => {
    let m = 0;
    for (const gi of ofCell[k]) m |= used[gi];
    return full & ~m;
  };

  const search = (): void => {
    if (aborted || solutions.length >= cap) return;
    if (++nodes > budget.maxNodes) {
      aborted = 'node budget';
      return;
    }
    if ((nodes & 1023) === 0 && Date.now() - start > budget.maxMs) {
      aborted = 'time budget';
      return;
    }
    // Prune: in every group, each missing digit needs at least one candidate cell.
    for (let gi = 0; gi < list.length; gi++) {
      const missing = full & ~used[gi];
      if (!missing) continue;
      let reach = 0;
      for (const k of list[gi].cells) if (grid[k] === 0) reach |= cand(k);
      if ((reach & missing) !== missing) return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let k = 0; k < grid.length; k++) {
      if (grid[k] !== 0) continue;
      const m = cand(k);
      const c = popcount(m);
      if (c === 0) return;
      if (c < bestCount) {
        best = k;
        bestMask = m;
        bestCount = c;
        if (c === 1) break;
      }
    }
    if (best === -1) {
      solutions.push([...grid]);
      return;
    }
    let m = bestMask;
    while (m) {
      const d = lowestDigit(m);
      const bit = 1 << (d - 1);
      m &= ~bit;
      grid[best] = d;
      for (const gi of ofCell[best]) used[gi] |= bit;
      search();
      for (const gi of ofCell[best]) used[gi] &= ~bit;
      grid[best] = 0;
      if (aborted || solutions.length >= cap) return;
    }
  };
  search();
  if (aborted) return { status: 'aborted', reason: aborted, nodes };
  return { status: 'complete', count: solutions.length, capped: solutions.length >= cap, nodes, solutions };
}

// ---------------------------------------------------------------------------
// Human-style logic: naked and hidden singles only, with a trace
// ---------------------------------------------------------------------------

export interface GroupRef {
  rule: Rule;
  index: number;
}

export type Step =
  /** The only cell in `group` that can still take `digit`. */
  | { kind: 'hidden'; cell: number; digit: number; group: GroupRef }
  /** Every other digit is already used by the cell's enforced groups. */
  | { kind: 'naked'; cell: number; digit: number };

export type Contradiction =
  | { kind: 'repeat'; group: GroupRef; digit: number }
  | { kind: 'no-candidates'; cell: number }
  | { kind: 'no-place'; group: GroupRef; digit: number };

export interface LogicResult {
  outcome: 'solved' | 'contradiction' | 'stuck';
  steps: Step[];
  grid: number[];
  contradiction?: Contradiction;
}

/** Applies singles one at a time (hidden first, then naked) until solved, contradicted or stuck. */
export function logicSolve(geo: Geometry, givens: number[], enforced: Rule[]): LogicResult {
  const n = geo.size;
  const full = (1 << n) - 1;
  const { list, ofCell } = buildGroups(geo, enforced);
  const grid = [...givens];
  const steps: Step[] = [];
  const ref = (gi: number): GroupRef => ({ rule: list[gi].rule, index: list[gi].index });
  const done = (outcome: LogicResult['outcome'], contradiction?: Contradiction): LogicResult => ({
    outcome,
    steps,
    grid,
    contradiction,
  });

  for (let gi = 0; gi < list.length; gi++) {
    const seen = new Set<number>();
    for (const k of list[gi].cells) {
      const v = grid[k];
      if (v === 0) continue;
      if (seen.has(v)) return done('contradiction', { kind: 'repeat', group: ref(gi), digit: v });
      seen.add(v);
    }
  }

  for (;;) {
    const used = list.map((g) => g.cells.reduce((m, k) => (grid[k] ? m | (1 << (grid[k] - 1)) : m), 0));
    const cand = (k: number) => full & ~ofCell[k].reduce((m, gi) => m | used[gi], 0);
    const empties = grid.map((v, k) => (v === 0 ? k : -1)).filter((k) => k >= 0);
    if (empties.length === 0) return done('solved');
    for (const k of empties) if (cand(k) === 0) return done('contradiction', { kind: 'no-candidates', cell: k });

    let step: Step | null = null;
    for (let gi = 0; gi < list.length && !step; gi++) {
      for (let d = 1; d <= n && !step; d++) {
        const bit = 1 << (d - 1);
        if (used[gi] & bit) continue;
        const spots = list[gi].cells.filter((k) => grid[k] === 0 && cand(k) & bit);
        if (spots.length === 0) return done('contradiction', { kind: 'no-place', group: ref(gi), digit: d });
        if (spots.length === 1) step = { kind: 'hidden', cell: spots[0], digit: d, group: ref(gi) };
      }
    }
    if (!step) {
      for (const k of empties) {
        const m = cand(k);
        if (popcount(m) === 1) {
          step = { kind: 'naked', cell: k, digit: lowestDigit(m) };
          break;
        }
      }
    }
    if (!step) return done('stuck');
    grid[step.cell] = step.digit;
    steps.push(step);
  }
}

// ---------------------------------------------------------------------------
// The fairness gate
// ---------------------------------------------------------------------------

export interface PuzzleInput {
  geo: Geometry;
  givens: number[];
  solution: number[];
  liar: Rule;
}

export interface HypothesisReport {
  liar: Rule;
  count: CountResult;
  logic: LogicResult;
}

export type Verdict = 'PASS' | 'FAIL' | 'UNVERIFIABLE';

export interface GateReport {
  verdict: Verdict;
  hypotheses: HypothesisReport[];
  /** Human-readable reasons for a FAIL or UNVERIFIABLE verdict. */
  problems: string[];
}

export function gate(p: PuzzleInput, budget: Budget = DEFAULT_BUDGET): GateReport {
  const { geo, givens, solution, liar } = p;
  const problems: string[] = [];
  const n = geo.size;
  if (geo.boxRows * geo.boxCols !== n || n % geo.boxRows || n % geo.boxCols) problems.push('box shape does not tile the grid');
  if (givens.length !== n * n || solution.length !== n * n) problems.push('grid is not size x size');
  if (!givens.every((v) => Number.isInteger(v) && v >= 0 && v <= n)) problems.push(`givens use digits outside 0-${n}`);
  if (!solution.every((v) => Number.isInteger(v) && v >= 1 && v <= n)) problems.push(`solution uses digits outside 1-${n}`);
  if (!givens.every((v, k) => v === 0 || v === solution[k])) problems.push('solution changes a given');
  for (const r of RULES) {
    if (holds(geo, solution, r) !== (r !== liar)) {
      problems.push(r === liar ? `stored solution obeys the liar (Rule ${r})` : `stored solution breaks Rule ${r}`);
    }
  }
  if (problems.length) return { verdict: 'FAIL', hypotheses: [], problems };

  let unverifiable = false;
  const hypotheses = RULES.map((h): HypothesisReport => {
    const enforced = RULES.filter((r) => r !== h);
    const count = countSolutions(geo, givens, enforced, 2, budget);
    const logic = logicSolve(geo, givens, enforced);
    if (count.status === 'aborted') {
      unverifiable = true;
      problems.push(`if ${h} lies: search stopped (${count.reason}) after ${count.nodes} nodes, so no count`);
    } else if (h === liar) {
      if (count.count !== 1) problems.push(`if ${h} lies: ${count.capped ? '2 or more' : count.count} solutions, need exactly 1`);
      else if (count.solutions[0].some((v, k) => v !== solution[k])) problems.push(`if ${h} lies: the unique solution is not the stored one`);
    } else if (count.count !== 0) {
      problems.push(`if ${h} lies: ${count.capped ? '2 or more' : count.count} solution(s), need 0`);
    }
    if (h === liar && logic.outcome !== 'solved') problems.push(`if ${h} lies: singles get ${logic.outcome}, not a full solve`);
    if (h !== liar && logic.outcome !== 'contradiction') problems.push(`if ${h} lies: singles get ${logic.outcome}, not a contradiction`);
    return { liar: h, count, logic };
  });
  const verdict: Verdict = unverifiable ? 'UNVERIFIABLE' : problems.length ? 'FAIL' : 'PASS';
  return { verdict, hypotheses, problems };
}

/** Givens repeat a digit inside some row, column or box (the lie is visible at a glance). */
export function visibleRepeat(geo: Geometry, givens: number[]): boolean {
  return RULES.some((r) =>
    groups(geo, r).some((g) => {
      const vals = g.map((k) => givens[k]).filter((v) => v !== 0);
      return new Set(vals).size !== vals.length;
    }),
  );
}
