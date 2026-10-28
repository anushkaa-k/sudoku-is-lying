import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { checkSubmission, type CheckResult } from './game/check';
import { explain } from './game/explain';
import { POOL, TIERS, TUTORIALS, tierPuzzles } from './game/pool';
import { loadSolved, saveSolved } from './game/progress';
import { DIGITS, SIZE } from './game/solver';
import type { Cell, Grid, Puzzle, RuleId, Tier } from './game/types';

const TILTS = [-4, 2, -1];

/** Failure copy is the same for every level and never hints at which rule lies. */
const FEEDBACK: Record<Exclude<CheckResult, 'solved'>, { title: string; body: string }> = {
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
};

const cloneGrid = (g: Grid) => g.map((row) => [...row]) as Grid;

function firstEmpty(g: Grid): [number, number] {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[r][c] === 0) return [r, c];
  return [0, 0];
}

const TIER_LABEL: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const byId = (id: string) => POOL.find((p) => p.id === id)!;

type View = { kind: 'menu' } | { kind: 'play'; id: string };

export default function App() {
  const [solved, setSolved] = useState(loadSolved);
  const tutorialDone = TUTORIALS.every((p) => solved.has(p.id));
  // A new player starts on the first unsolved tutorial; after that, on the difficulty screen.
  const [view, setView] = useState<View>(() => {
    const next = TUTORIALS.find((p) => !solved.has(p.id));
    return next ? { kind: 'play', id: next.id } : { kind: 'menu' };
  });
  // Counts screen changes so each new puzzle remounts fresh and later ones grab focus.
  const [visit, setVisit] = useState(0);

  const go = (v: View) => {
    setView(v);
    setVisit((n) => n + 1);
  };

  const markSolved = (id: string) =>
    setSolved((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveSolved(next);
      return next;
    });

  const unsolvedIn = (tier: Tier) => tierPuzzles(tier).filter((p) => !solved.has(p.id));

  /** Starts a random unsolved puzzle from the tier; returns false when there is none. */
  const startTier = (tier: Tier): boolean => {
    const options = unsolvedIn(tier);
    if (options.length === 0) return false;
    go({ kind: 'play', id: options[Math.floor(Math.random() * options.length)].id });
    return true;
  };

  const picker = (
    <DifficultyPicker
      unsolved={(t) => unsolvedIn(t).length}
      total={(t) => tierPuzzles(t).length}
      onPick={startTier}
      onReplay={(id) => go({ kind: 'play', id })}
    />
  );

  if (view.kind === 'menu') return <Menu key={visit} focusOnMount={visit > 0} picker={picker} />;

  const puzzle = byId(view.id);
  const tutorialIndex = TUTORIALS.indexOf(puzzle);
  let winActions: ReactNode;
  if (tutorialIndex >= 0 && tutorialIndex + 1 < TUTORIALS.length) {
    const next = TUTORIALS[tutorialIndex + 1];
    winActions = (
      <button type="button" className="next" onClick={() => go({ kind: 'play', id: next.id })}>
        Next puzzle
      </button>
    );
  } else if (tutorialIndex >= 0) {
    winActions = (
      <>
        <p className="more">Tutorial over. From here on you pick the case.</p>
        {picker}
      </>
    );
  } else if (unsolvedIn(puzzle.tier).length > 0) {
    winActions = (
      <button type="button" className="next" onClick={() => startTier(puzzle.tier)}>
        New game
      </button>
    );
  } else {
    winActions = (
      <>
        <p className="more">
          That was the last unsolved {TIER_LABEL[puzzle.tier]} case. No reruns; the rulebook has
          standards.
        </p>
        {picker}
      </>
    );
  }

  return (
    <Game
      key={visit}
      puzzle={puzzle}
      label={puzzle.status === 'tutorial' ? puzzle.name : `${TIER_LABEL[puzzle.tier]} · ${puzzle.name}`}
      focusOnMount={visit > 0}
      onSolved={() => markSolved(puzzle.id)}
      winActions={winActions}
      onMenu={tutorialDone ? () => go({ kind: 'menu' }) : undefined}
    />
  );
}

function Header({ tag, label, children }: { tag: string; label?: string; children: ReactNode }) {
  return (
    <header>
      <div className="tag-row">
        <span className="tag">{tag}</span>
        {label && <span className="level">{label}</span>}
      </div>
      <h1>
        One rule is <span className="chip">full of it.</span>
      </h1>
      <p className="lede">{children}</p>
    </header>
  );
}

function Menu({ focusOnMount, picker }: { focusOnMount: boolean; picker: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focusOnMount) return;
    window.scrollTo(0, 0);
    ref.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  return (
    <main className="app">
      <Header tag="CASE FILES">
        Every case below has three rules, <strong>exactly one of them lying</strong>, and exactly
        one correct grid. We checked every single one. The rulebook is still sulking about it.
      </Header>
      <section ref={ref} className="panel" aria-label="Pick a case">
        {picker}
      </section>
    </main>
  );
}

interface PickerProps {
  unsolved: (t: Tier) => number;
  total: (t: Tier) => number;
  /** Returns false when the tier has nothing left to serve. */
  onPick: (t: Tier) => boolean;
  onReplay: (id: string) => void;
}

function DifficultyPicker({ unsolved, total, onPick, onReplay }: PickerProps) {
  const [note, setNote] = useState('');
  const status = (t: Tier) =>
    total(t) === 0 ? 'none yet' : unsolved(t) === 0 ? 'all solved' : `${unsolved(t)} unsolved`;
  const pick = (t: Tier) => {
    if (onPick(t)) return;
    setNote(
      total(t) === 0
        ? `No ${TIER_LABEL[t]} cases yet. We’d rather ship nothing than ship a lie.`
        : `You’ve solved every ${TIER_LABEL[t]} case we have. No reruns. Try another pile.`,
    );
  };
  return (
    <div className="picker">
      <p className="picker-title">Pick a difficulty</p>
      <div className="tiers">
        {TIERS.map((t) => (
          <button key={t} type="button" className="tier" onClick={() => pick(t)}>
            <span className="tier-name">{TIER_LABEL[t]}</span>
            <span className="tier-count">{status(t)}</span>
          </button>
        ))}
      </div>
      <p className="picker-note" role="status" aria-live="polite">
        {note}
      </p>
      <p className="picker-sub">Replay the tutorial</p>
      <div className="row-actions">
        {TUTORIALS.map((p) => (
          <button key={p.id} type="button" className="key wide" onClick={() => onReplay(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

interface GameProps {
  puzzle: Puzzle;
  label: string;
  focusOnMount: boolean;
  onSolved: () => void;
  /** Shown under the explanation once solved. */
  winActions: ReactNode;
  /** Back to the difficulty screen; absent while the tutorial is still in progress. */
  onMenu?: () => void;
}

function Game({ puzzle, label, focusOnMount, onSolved, winActions, onMenu }: GameProps) {
  const isGiven = (r: number, c: number) => puzzle.givens[r][c] !== 0;
  const [grid, setGrid] = useState<Grid>(() => cloneGrid(puzzle.givens));
  const [sel, setSel] = useState<[number, number]>(() => firstEmpty(puzzle.givens));
  const [suspect, setSuspect] = useState<RuleId | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // After switching puzzles the win panel is gone, so bring the player back to the top of the new case.
  useEffect(() => {
    if (!focusOnMount) return;
    window.scrollTo(0, 0);
    const [r, c] = sel;
    tileRefs.current[r * SIZE + c]?.focus({ preventScroll: true });
  }, []);

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
      <Header tag={`CASE #${puzzle.caseNumber}`} label={label}>
        Below are three rules. <strong>Exactly one of them is lying.</strong> The other two are
        deadly serious. Fill the grid with 1–4, then name the liar. The fixed tiles never lie, and
        neither do we. Only the rulebook does, and it’s very proud of itself.
      </Header>

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

      <button
        type="button"
        className="check"
        onClick={() => {
          const r = checkSubmission(puzzle, grid, suspect);
          setResult(r);
          if (r === 'solved') onSolved();
        }}
      >
        Check
      </button>

      <div className={`feedback${result ? ` ${result}` : ''}`} role="status" aria-live="polite">
        {result && (
          <>
            <p className="feedback-title">{solved ? 'Case closed.' : FEEDBACK[result].title}</p>
            <p>{solved ? explain(puzzle) : FEEDBACK[result].body}</p>
            {solved && winActions}
          </>
        )}
      </div>

      {onMenu && (
        <button type="button" className="back" onClick={onMenu}>
          ← Back to case files
        </button>
      )}

      <p className="keys-help">Keyboard: arrows move · 1–4 type · Backspace erases</p>
    </main>
  );
}
