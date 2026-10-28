import { useRef, useState, type KeyboardEvent } from 'react';
import { checkSubmission, type CheckResult } from './game/check';
import { TUTORIAL } from './game/puzzles';
import { DIGITS, SIZE } from './game/solver';
import type { Cell, Grid, RuleId } from './game/types';

const puzzle = TUTORIAL;
const TILTS = [-4, 2, -1];

const FEEDBACK: Record<CheckResult, { title: string; body: string }> = {
  incomplete: {
    title: 'Not finished yet.',
    body: 'There are still empty tiles. The rulebook refuses to be judged on a half-done job.',
  },
  'no-suspect': {
    title: 'Not finished yet.',
    body: 'Every tile is filled, but you haven’t accused anyone. Tap the rule you think is bluffing.',
  },
  wrong: {
    title: 'Not solved yet.',
    body: 'Something in your case doesn’t hold up. We’re not saying what. We’re enjoying this.',
  },
  solved: {
    title: 'Case closed.',
    body: puzzle.explanation,
  },
};

const cloneGrid = (g: Grid) => g.map((row) => [...row]) as Grid;
const isGiven = (r: number, c: number) => puzzle.givens[r][c] !== 0;

export default function App() {
  const [grid, setGrid] = useState<Grid>(() => cloneGrid(puzzle.givens));
  const [sel, setSel] = useState<[number, number]>([0, 2]);
  const [suspect, setSuspect] = useState<RuleId | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const solved = result === 'solved';
  const [sr, sc] = sel;
  const selGiven = isGiven(sr, sc);

  const setCell = (r: number, c: number, v: Cell) => {
    if (solved || isGiven(r, c)) return;
    setGrid((g) => {
      const next = cloneGrid(g);
      next[r][c] = v;
      return next;
    });
    setResult(null);
  };

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(SIZE - 1, r));
    const nc = Math.max(0, Math.min(SIZE - 1, c));
    setSel([nr, nc]);
    tileRefs.current[nr * SIZE + nc]?.focus();
  };

  const onGridKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === 'ArrowUp') move(sr - 1, sc);
    else if (k === 'ArrowDown') move(sr + 1, sc);
    else if (k === 'ArrowLeft') move(sr, sc - 1);
    else if (k === 'ArrowRight') move(sr, sc + 1);
    else if (/^[1-4]$/.test(k)) setCell(sr, sc, Number(k) as Cell);
    else if (k === 'Backspace' || k === 'Delete' || k === '0') setCell(sr, sc, 0);
    else return;
    e.preventDefault();
  };

  const reset = () => {
    setGrid(cloneGrid(puzzle.givens));
    setSuspect(null);
    setResult(null);
  };

  const accuse = (id: RuleId) => {
    if (solved) return;
    setSuspect((s) => (s === id ? null : id));
    setResult(null);
  };

  const tile = (r: number, c: number) => {
    const v = grid[r][c];
    const given = isGiven(r, c);
    const selected = r === sr && c === sc;
    const label = `Row ${r + 1}, column ${c + 1}: ${v === 0 ? 'empty' : v}${given ? ', fixed' : ''}`;
    return (
      <button
        key={`${r}-${c}`}
        ref={(el) => (tileRefs.current[r * SIZE + c] = el)}
        type="button"
        className={`tile${given ? ' given' : ''}${selected ? ' selected' : ''}`}
        tabIndex={selected ? 0 : -1}
        aria-label={label}
        aria-pressed={selected}
        onClick={() => move(r, c)}
      >
        {v === 0 ? '' : v}
      </button>
    );
  };

  // Render box by box so the gap between 2x2 boxes can be wider than the gap between tiles.
  const boxes = [0, 1, 2, 3].map((b) => {
    const r0 = 2 * Math.floor(b / 2);
    const c0 = 2 * (b % 2);
    return (
      <div className="box" key={b}>
        {tile(r0, c0)}
        {tile(r0, c0 + 1)}
        {tile(r0 + 1, c0)}
        {tile(r0 + 1, c0 + 1)}
      </div>
    );
  });

  // Keep focus on the selected tile when tapping keypad buttons with a pointer.
  const keepFocus = (e: React.PointerEvent) => e.preventDefault();

  return (
    <main className="app">
      <header>
        <span className="tag">CASE #{puzzle.caseNumber}</span>
        <h1>
          One rule is <span className="chip">full of it.</span>
        </h1>
        <p className="lede">
          Below are three rules. <strong>Exactly one of them is lying.</strong> The other two
          are deadly serious. Fill the grid with 1–4, then name the liar. The fixed tiles never
          lie, and neither do we. Only the rulebook does, and it’s very proud of itself.
        </p>
      </header>

      <section aria-label="Puzzle grid" className="panel">
        <div className="grid" role="group" aria-label="4 by 4 grid" onKeyDown={onGridKey}>
          {boxes}
        </div>
      </section>

      <section className="controls" aria-label="Number pad">
        <div className="keypad">
          {DIGITS.map((d) => (
            <button
              key={d}
              type="button"
              className="key"
              disabled={solved || selGiven}
              onPointerDown={keepFocus}
              onClick={() => setCell(sr, sc, d)}
              aria-label={`Enter ${d}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="key wide"
            disabled={solved || selGiven}
            onPointerDown={keepFocus}
            onClick={() => setCell(sr, sc, 0)}
          >
            Erase
          </button>
          <button type="button" className="key wide" onClick={reset}>
            Reset
          </button>
        </div>
      </section>

      <section aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="sr-only">
          Rule cards
        </h2>
        <div className="cards">
          {puzzle.rules.map((rule, i) => (
            <button
              key={rule.id}
              type="button"
              className={`card${suspect === rule.id ? ' suspect' : ''}`}
              style={{ ['--tilt' as string]: `${TILTS[i % TILTS.length]}deg` }}
              aria-pressed={suspect === rule.id}
              aria-label={`Rule ${rule.id}: ${rule.text}${suspect === rule.id ? ' (your suspect)' : ''}`}
              onClick={() => accuse(rule.id)}
            >
              <span className="card-letter">{rule.id}</span>
              <span className="card-text">{rule.text}</span>
            </button>
          ))}
        </div>
        <p className="prompt">Which one is bluffing?</p>
        <p className="hint">Tap a card to mark your suspect. It’s your guess, not a clue.</p>
      </section>

      <button type="button" className="check" onClick={() => setResult(checkSubmission(puzzle, grid, suspect))}>
        Check
      </button>

      <div className={`feedback${result ? ` ${result}` : ''}`} role="status" aria-live="polite">
        {result && (
          <>
            <p className="feedback-title">{FEEDBACK[result].title}</p>
            <p>{FEEDBACK[result].body}</p>
          </>
        )}
      </div>

      <p className="keys-help">Keyboard: arrows move · 1–4 type · Backspace erases</p>
    </main>
  );
}
