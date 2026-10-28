/**
 * Authoring aid, not part of the app. Searches for candidate puzzles the way Level 2
 * was found: take a grid that obeys exactly two rules, then strip givens while
 * "exactly one liar has exactly one solution" still holds. Candidates are only
 * drafts until they are added to the pool and pass `npm run verify`.
 *
 * Run: npm run search
 */
import { countIfFalse, groupsFor, ruleHolds, solveAll, RULE_IDS } from '../src/game/solver';
import type { Grid, RuleId } from '../src/game/types';

let seed = 20261028;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const CELLS = Array.from({ length: 16 }, (_, k): [number, number] => [Math.floor(k / 4), k % 4]);

function uniqueLiar(givens: Grid, liar: RuleId): boolean {
  return RULE_IDS.every((id) => countIfFalse(givens, id).length === (id === liar ? 1 : 0));
}

/** True when the givens alone already repeat a digit in some row, column or box. */
function visibleRepeat(givens: Grid): boolean {
  return RULE_IDS.some((id) =>
    groupsFor(id).some((g) => {
      const vals = g.map(([r, c]) => givens[r][c]).filter((v) => v !== 0);
      return new Set(vals).size !== vals.length;
    }),
  );
}

const count = (g: Grid) => g.flat().filter((v) => v !== 0).length;
const key = (g: Grid) => g.flat().join('');

/** Remove givens in random order while the unique-liar property holds. */
function strip(solution: Grid, liar: RuleId, keep: Set<number> = new Set()): Grid {
  const g = solution.map((r) => [...r]) as Grid;
  for (const k of shuffle(CELLS.map((_, i) => i))) {
    if (keep.has(k)) continue;
    const [r, c] = CELLS[k];
    const v = g[r][c];
    g[r][c] = 0;
    if (!uniqueLiar(g, liar)) g[r][c] = v;
  }
  return g;
}

/** Put back `extra` solution cells without creating a visible repeat (unless allowed). */
function pad(givens: Grid, solution: Grid, extra: number, allowRepeat: boolean): Grid {
  const g = givens.map((r) => [...r]) as Grid;
  for (const k of shuffle(CELLS.map((_, i) => i))) {
    if (extra === 0) break;
    const [r, c] = CELLS[k];
    if (g[r][c] !== 0) continue;
    g[r][c] = solution[r][c];
    if (!allowRepeat && visibleRepeat(g)) g[r][c] = 0;
    else extra--;
  }
  return g;
}

const seen = new Set<string>();
// Tutorial solutions are already taken.
seen.add('1212343421214343');
seen.add('4213243113243142');
const out: Record<string, { liar: RuleId; givens: Grid; solution: Grid; n: number }[]> = {
  easy: [],
  medium: [],
  hard: [],
};

for (const liar of RULE_IDS) {
  const others = RULE_IDS.filter((r) => r !== liar);
  const sols = shuffle(solveAll([0, 0, 0, 0].map(() => [0, 0, 0, 0]) as Grid, others)).filter(
    (s) => !ruleHolds(s, liar),
  );
  const hard: Grid[] = [];
  const medium: Grid[] = [];
  const easy: Grid[] = [];
  for (const sol of sols.slice(0, 60)) {
    const m = strip(sol, liar);
    if (!visibleRepeat(m)) {
      hard.push(m);
      medium.push(pad(m, sol, 2, false));
    }
    // Easy: keep a pair of tiles that visibly repeat inside one of the liar's groups.
    const bad = groupsFor(liar).find((g) => new Set(g.map(([r, c]) => sol[r][c])).size < 4)!;
    const [p, q] = bad.flatMap((a, i) => bad.slice(i + 1).map((b) => [a, b])).find(
      ([a, b]) => sol[a[0]][a[1]] === sol[b[0]][b[1]],
    )!;
    const e = strip(sol, liar, new Set([p[0] * 4 + p[1], q[0] * 4 + q[1]]));
    easy.push(pad(e, sol, Math.max(0, 9 - count(e)), true));
  }
  const pickFrom = (tier: string, grids: Grid[], order: (a: Grid, b: Grid) => number) => {
    // One puzzle per solution grid, so no two tiers share an answer.
    const g = [...grids]
      .sort(order)
      .find((x) => uniqueLiar(x, liar) && !seen.has(key(countIfFalse(x, liar)[0])));
    if (!g) return;
    const solution = countIfFalse(g, liar)[0];
    seen.add(key(solution));
    out[tier].push({ liar, givens: g, solution, n: count(g) });
  };
  pickFrom('hard', hard, (a, b) => count(a) - count(b));
  pickFrom('medium', medium, (a, b) => count(b) - count(a));
  pickFrom('easy', easy, (a, b) => count(b) - count(a));
}

for (const [tier, list] of Object.entries(out)) {
  console.log(`\n${tier.toUpperCase()}`);
  for (const p of list) {
    console.log(`  liar ${p.liar}, ${p.n} givens, visible repeat: ${visibleRepeat(p.givens)}`);
    console.log(`    givens:   ${JSON.stringify(p.givens)}`);
    console.log(`    solution: ${JSON.stringify(p.solution)}`);
  }
}
