/**
 * Turns the checker's singles-only traces into a plain-English walkthrough:
 * how each wrong liar collapses, then how the grid fills once the real liar is known.
 * Every sentence comes from an actual deduction step, so it can't claim more than the logic did.
 */
import { groups, logicSolve, RULES, type Contradiction, type Geometry, type GroupRef, type Rule, type Step } from './checker';

const FAMILY: Record<Rule, string> = { A: 'rows', B: 'columns', C: 'boxes' };

const cellName = (geo: Geometry, k: number) => `R${Math.floor(k / geo.size) + 1}C${(k % geo.size) + 1}`;

export function groupName(geo: Geometry, g: GroupRef): string {
  if (g.rule === 'A') return `row ${g.index + 1}`;
  if (g.rule === 'B') return `column ${g.index + 1}`;
  const cells = groups(geo, 'C')[g.index];
  const r = (k: number) => Math.floor(k / geo.size) + 1;
  const c = (k: number) => (k % geo.size) + 1;
  const last = cells[cells.length - 1];
  return `box ${g.index + 1} (rows ${r(cells[0])}–${r(last)}, columns ${c(cells[0])}–${c(last)})`;
}

function stepText(geo: Geometry, enforced: Rule[], s: Step): string {
  const at = `${cellName(geo, s.cell)} = ${s.digit}`;
  if (s.kind === 'hidden') return `${at}: the only cell in ${groupName(geo, s.group)} that can still take ${s.digit === 8 ? 'an' : 'a'} ${s.digit}.`;
  return `${at}: its ${enforced.map((r) => FAMILY[r].slice(0, -1).replace('boxe', 'box')).join(' and ')} already use every other digit.`;
}

/** Which other enforced group already holds `digit` for a given cell. */
function blocker(geo: Geometry, grid: number[], enforced: Rule[], cell: number, digit: number, except: Rule): string {
  for (const r of enforced) {
    if (r === except) continue;
    const gi = groups(geo, r).findIndex((g) => g.includes(cell));
    if (groups(geo, r)[gi].some((k) => grid[k] === digit)) return r === 'C' ? 'its box' : `its ${FAMILY[r].slice(0, -1)}`;
  }
  return 'its other groups';
}

function contradictionText(geo: Geometry, grid: number[], enforced: Rule[], c: Contradiction): string {
  if (c.kind === 'repeat') return `The fixed tiles already put two ${c.digit}s in ${groupName(geo, c.group)}. Impossible.`;
  if (c.kind === 'no-candidates') {
    return `${cellName(geo, c.cell)} is empty, but its ${enforced.map((r) => FAMILY[r].slice(0, -1).replace('boxe', 'box')).join(' and ')} already use every digit 1–${geo.size}. Impossible.`;
  }
  const g = groups(geo, c.group.rule)[c.group.index];
  const empty = g.filter((k) => grid[k] === 0);
  const why = empty.map((k) => `${cellName(geo, k)} (${blocker(geo, grid, enforced, k, c.digit, c.group.rule)} has one)`);
  return `${groupName(geo, c.group)[0].toUpperCase()}${groupName(geo, c.group).slice(1)} still needs ${c.digit === 8 ? 'an' : 'a'} ${c.digit}, but every empty cell in it is blocked: ${why.join(', ')}. Nowhere left for the ${c.digit}. Impossible.`;
}

export interface Walkthrough {
  /** One paragraph per wrong liar. */
  refutations: { liar: Rule; text: string; steps: number }[];
  /** Intro line for the real solve. */
  solveIntro: string;
  solveSteps: string[];
}

export function walkthrough(geo: Geometry, givens: number[], liar: Rule): Walkthrough {
  const refutations = RULES.filter((h) => h !== liar).map((h) => {
    const enforced = RULES.filter((r) => r !== h);
    const res = logicSolve(geo, givens, enforced);
    const lines = [`Suppose Rule ${h} (${FAMILY[h]}) is the liar, so ${FAMILY[enforced[0]]} and ${FAMILY[enforced[1]]} must hold.`];
    for (const s of res.steps) lines.push(stepText(geo, enforced, s));
    if (res.outcome !== 'contradiction' || !res.contradiction) throw new Error(`Rule ${h} does not collapse by singles`);
    lines.push(contradictionText(geo, res.grid, enforced, res.contradiction));
    lines.push(`So Rule ${h} is telling the truth.`);
    return { liar: h, text: lines.join(' '), steps: res.steps.length };
  });
  const enforced = RULES.filter((r) => r !== liar);
  const res = logicSolve(geo, givens, enforced);
  if (res.outcome !== 'solved') throw new Error(`Rule ${liar} does not solve by singles`);
  return {
    refutations,
    solveIntro: `That leaves Rule ${liar} (${FAMILY[liar]}) as the liar. With only ${FAMILY[enforced[0]]} and ${FAMILY[enforced[1]]} in force, the grid fills by singles alone, ${res.steps.length} steps, no guessing:`,
    solveSteps: res.steps.map((s) => stepText(geo, enforced, s)),
  };
}
