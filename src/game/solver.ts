import type { Cell, Digit, Grid, RuleId } from './types';

export const SIZE = 4;
export const DIGITS: Digit[] = [1, 2, 3, 4];
export const RULE_IDS: RuleId[] = ['A', 'B', 'C'];

type Coord = [number, number];

/** Every group of four cells that a rule constrains. */
export function groupsFor(rule: RuleId): Coord[][] {
  const groups: Coord[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const g: Coord[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (rule === 'A') g.push([i, j]);
      else if (rule === 'B') g.push([j, i]);
      else g.push([2 * Math.floor(i / 2) + Math.floor(j / 2), 2 * (i % 2) + (j % 2)]);
    }
    groups.push(g);
  }
  return groups;
}

/** True when the rule holds on a fully filled grid. */
export function ruleHolds(grid: Grid, rule: RuleId): boolean {
  return groupsFor(rule).every((g) => {
    const seen = new Set(g.map(([r, c]) => grid[r][c]));
    return seen.size === SIZE && !seen.has(0);
  });
}

/** True when no enforced group already contains a repeated digit. */
function consistent(grid: Grid, rules: RuleId[]): boolean {
  for (const rule of rules) {
    for (const g of groupsFor(rule)) {
      const seen = new Set<Cell>();
      for (const [r, c] of g) {
        const v = grid[r][c];
        if (v === 0) continue;
        if (seen.has(v)) return false;
        seen.add(v);
      }
    }
  }
  return true;
}

/** Enumerate every completion of `givens` (digits 1-4 only) satisfying all `rules`. */
export function solveAll(givens: Grid, rules: RuleId[]): Grid[] {
  const grid = givens.map((row) => [...row]) as Grid;
  const out: Grid[] = [];
  if (!consistent(grid, rules)) return out;
  const empties: Coord[] = [];
  grid.forEach((row, r) => row.forEach((v, c) => v === 0 && empties.push([r, c])));

  const step = (k: number) => {
    if (k === empties.length) {
      out.push(grid.map((row) => [...row]) as Grid);
      return;
    }
    const [r, c] = empties[k];
    for (const d of DIGITS) {
      grid[r][c] = d;
      if (consistent(grid, rules)) step(k + 1);
    }
    grid[r][c] = 0;
  };
  step(0);
  return out;
}

/** Number of completions when `falseRule` is ignored and the other two are enforced. */
export function countIfFalse(givens: Grid, falseRule: RuleId): Grid[] {
  return solveAll(givens, RULE_IDS.filter((r) => r !== falseRule));
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

export function isComplete(grid: Grid): boolean {
  return grid.every((row) => row.every((v) => v !== 0));
}
