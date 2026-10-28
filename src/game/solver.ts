import type { BoxShape, Grid, RuleId } from './types';

export const RULE_IDS: RuleId[] = ['A', 'B', 'C'];

type Coord = [number, number];

/** Digits a board of this size uses: 1..size. */
export const digitsFor = (size: number) => Array.from({ length: size }, (_, i) => i + 1);

/**
 * Every group of `size` cells a rule constrains, in reading order.
 * A = rows, B = columns, C = boxes (`box.rows` high by `box.cols` wide).
 */
export function groupsFor(rule: RuleId, size: number, box: BoxShape): Coord[][] {
  const groups: Coord[][] = [];
  const boxesPerRow = size / box.cols;
  for (let i = 0; i < size; i++) {
    const g: Coord[] = [];
    for (let j = 0; j < size; j++) {
      if (rule === 'A') g.push([i, j]);
      else if (rule === 'B') g.push([j, i]);
      else {
        const r0 = Math.floor(i / boxesPerRow) * box.rows;
        const c0 = (i % boxesPerRow) * box.cols;
        g.push([r0 + Math.floor(j / box.cols), c0 + (j % box.cols)]);
      }
    }
    groups.push(g);
  }
  return groups;
}

/** True when the rule holds on a fully filled grid. */
export function ruleHolds(grid: Grid, rule: RuleId, size: number, box: BoxShape): boolean {
  return groupsFor(rule, size, box).every((g) => {
    const seen = new Set(g.map(([r, c]) => grid[r][c]));
    return seen.size === size && [...seen].every((v) => v >= 1 && v <= size);
  });
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

export function isComplete(grid: Grid): boolean {
  return grid.every((row) => row.every((v) => v !== 0));
}
