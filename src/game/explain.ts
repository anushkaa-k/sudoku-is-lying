import { groupsFor, RULE_IDS } from './solver';
import type { Puzzle, RuleId } from './types';

const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const PLURAL: Record<RuleId, string> = { A: 'Rows', B: 'Columns', C: 'Boxes' };

function groupName(p: Puzzle, rule: RuleId, i: number): string {
  if (rule === 'A') return `row ${i + 1}`;
  if (rule === 'B') return `column ${i + 1}`;
  if (p.size === 4) return `the ${CORNERS[i]} box`;
  const cells = groupsFor('C', p.size, p.box)[i];
  const [r0, c0] = cells[0];
  const [r1, c1] = cells[cells.length - 1];
  return `the box at rows ${r0 + 1}–${r1 + 1}, columns ${c0 + 1}–${c1 + 1}`;
}

/**
 * The win-screen text: names the liar and points at a real repeat in the solution.
 * Only shown after a correct solve, so it never leaks anything early.
 */
export function explain(p: Puzzle): string {
  if (p.explanation) return p.explanation;
  const liar = p.falseRuleId;
  const [a, b] = RULE_IDS.filter((r) => r !== liar);
  const groups = groupsFor(liar, p.size, p.box);
  const i = groups.findIndex((g) => new Set(g.map(([r, c]) => p.solution[r][c])).size < p.size);
  const digits = groups[i].map(([r, c]) => p.solution[r][c]).join(', ');
  const givenRepeat = groups.some((g) => {
    const vals = g.map(([r, c]) => p.givens[r][c]).filter((v) => v !== 0);
    return new Set(vals).size !== vals.length;
  });
  const how = givenRepeat
    ? 'The fixed tiles were already repeating a digit, which is about as subtle as the rulebook gets.'
    : `No fixed tile gave it away. Trust Rule ${liar} and the grid has no answer at all.`;
  return `Rule ${liar} lied. ${PLURAL[a]} and ${PLURAL[b].toLowerCase()} hold, but ${groupName(p, liar, i)} reads ${digits}. ${how}`;
}
