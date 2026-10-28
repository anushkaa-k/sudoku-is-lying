/**
 * The fairness gate for every puzzle in the pool, at every board size.
 * Uses scripts/lib/checker.ts, which is independent of the app's src/game code.
 *
 * For each puzzle and each candidate liar (A rows, B columns, C boxes) it runs:
 *  - a backtracking count (capped at 2) with a node and time budget. A search that
 *    hits its budget proves nothing: the puzzle is reported UNVERIFIABLE, never 0 or 1.
 *  - a singles-only logic pass (naked + hidden singles, no guessing).
 * A puzzle PASSES only if:
 *  - the stored liar gives exactly 1 solution, equal to the stored solution, and the
 *    singles pass fills the whole grid (the solve is deducible);
 *  - each other liar gives 0 solutions, and the singles pass reaches a contradiction
 *    (the lie is deducible, not a guess);
 *  - the stored solution breaks the liar and obeys the other two rules, keeps every
 *    given, uses digits 1..size, and the board size and box shape match its tier.
 * Anything not PASS must not ship: the script exits non-zero if a non-draft puzzle
 * fails or is unverifiable.
 *
 * Run: npm run verify
 *      npm run verify -- --nodes 50 --ms 1000     (tighter budget, to see UNVERIFIABLE)
 *      npm run verify -- --walkthroughs docs/WALKTHROUGHS.md
 */
import { writeFileSync } from 'fs';
import { POOL, TIER_SIZE } from '../src/game/pool';
import type { Puzzle } from '../src/game/types';
import { DEFAULT_BUDGET, gate, RULES, visibleRepeat, type Budget, type GateReport, type Geometry } from './lib/checker';
import { walkthrough } from './lib/walkthrough';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const budget: Budget = {
  maxNodes: Number(arg('nodes') ?? DEFAULT_BUDGET.maxNodes),
  maxMs: Number(arg('ms') ?? DEFAULT_BUDGET.maxMs),
};
const walkthroughFile = arg('walkthroughs');

const geoOf = (p: Puzzle): Geometry => ({ size: p.size, boxRows: p.box.rows, boxCols: p.box.cols });
const EXPECTED_BOX: Record<number, string> = { 4: '2x2', 6: '2x3', 9: '3x3' };

console.log(`Budget per search: ${budget.maxNodes} nodes, ${budget.maxMs} ms\n`);

const results: { p: Puzzle; report: GateReport }[] = [];
const ids = new Set<string>();
for (const p of POOL) {
  const geo = geoOf(p);
  const report = gate({ geo, givens: p.givens.flat(), solution: p.solution.flat(), liar: p.falseRuleId }, budget);
  // Pool-level checks the checker can't know about.
  const shape = `${p.box.rows}x${p.box.cols}`;
  if (p.givens.length !== p.size || p.givens.some((r) => r.length !== p.size)) report.problems.push('givens are not size x size');
  if (EXPECTED_BOX[p.size] !== shape) report.problems.push(`box shape ${shape} is not the ${EXPECTED_BOX[p.size]} this size uses`);
  if (p.status === 'live' && TIER_SIZE[p.tier] !== p.size) report.problems.push(`${p.tier} serves ${TIER_SIZE[p.tier]}x${TIER_SIZE[p.tier]}, not ${p.size}x${p.size}`);
  if (ids.has(p.id)) report.problems.push('duplicate id');
  ids.add(p.id);
  if (report.verdict === 'PASS' && report.problems.length) report.verdict = 'FAIL';
  results.push({ p, report });

  console.log(`${p.id}  "${p.name}"  ${p.size}x${p.size} (${shape} boxes)  tier: ${p.tier}  status: ${p.status}  stored liar: Rule ${p.falseRuleId}`);
  for (const h of report.hypotheses) {
    const c = h.count;
    const count =
      c.status === 'aborted' ? `UNFINISHED (${c.reason}, ${c.nodes} nodes)` : `${c.capped ? '2+' : c.count} solution(s) [search complete, ${c.nodes} nodes]`;
    const logic =
      h.logic.outcome === 'solved'
        ? `singles solve it in ${h.logic.steps.length} steps`
        : h.logic.outcome === 'contradiction'
          ? `singles reach a contradiction after ${h.logic.steps.length} steps`
          : `singles get stuck after ${h.logic.steps.length} steps`;
    console.log(`  if ${h.liar} lies: ${count}; ${logic}`);
  }
  console.log(`  givens: ${p.givens.flat().filter(Boolean).length}/${p.size * p.size}, visible repeat: ${visibleRepeat(geo, p.givens.flat()) ? 'yes' : 'no'}`);
  for (const problem of report.problems) console.log(`  - ${problem}`);
  console.log(`  => ${report.verdict}${report.verdict !== 'PASS' ? (p.status === 'draft' ? ' (draft, not shipped)' : ' (must be discarded)') : ''}\n`);
}

console.log('Summary');
console.log('  id            size  tier    status    liar  verdict');
for (const { p, report } of results) {
  console.log(`  ${p.id.padEnd(14)}${`${p.size}x${p.size}`.padEnd(6)}${p.tier.padEnd(8)}${p.status.padEnd(10)}${p.falseRuleId.padEnd(6)}${report.verdict}`);
}
const shipped = results.filter(({ p }) => p.status !== 'draft');
const bad = shipped.filter(({ report }) => report.verdict !== 'PASS');
const count = (v: string) => results.filter(({ report }) => report.verdict === v).length;
console.log(`\n${count('PASS')} pass, ${count('FAIL')} fail, ${count('UNVERIFIABLE')} unverifiable, of ${results.length} puzzles.`);
console.log(bad.length ? `VERIFICATION FAILED: ${bad.map(({ p }) => p.id).join(', ')} must not ship.` : 'All shipped puzzles verified.');

if (walkthroughFile && !bad.length) {
  const lines = [
    '# Walkthroughs: Medium and Hard',
    '',
    'Generated by `npm run verify -- --walkthroughs docs/WALKTHROUGHS.md` from the',
    'verify gate\'s own singles-only traces (naked and hidden singles, no guessing).',
    'Cells are RrowCcolumn, counted from the top-left. Boxes are numbered left to right, top to bottom.',
    '',
  ];
  for (const { p } of results.filter(({ p }) => p.status === 'live' && p.size > 4)) {
    const w = walkthrough(geoOf(p), p.givens.flat(), p.falseRuleId);
    lines.push(`## Case #${p.caseNumber} "${p.name}" (${p.tier}, ${p.size}x${p.size}, ${p.box.rows}x${p.box.cols} boxes)`, '');
    lines.push('**Spot the liar.** Test each rule as the possible liar:', '');
    for (const r of w.refutations) lines.push(`- ${r.text}`);
    lines.push('', `**Solve.** ${w.solveIntro}`, '');
    w.solveSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }
  writeFileSync(walkthroughFile, lines.join('\n'));
  console.log(`Walkthroughs written to ${walkthroughFile}`);
}
process.exit(bad.length ? 1 : 0);
