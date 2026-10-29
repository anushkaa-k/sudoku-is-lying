import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { checkSubmission, type CheckResult } from './game/check';
import { explain } from './game/explain';
import { POOL, TIER_SIZE, TIERS, TUTORIALS, tierPuzzles } from './game/pool';
import { loadFlag, loadSolved, recordKey, saveFlag, saveSolved } from './game/progress';
import { digitsFor, groupsFor } from './game/solver';
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
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g.length; c++) if (g[r][c] === 0) return [r, c];
  return [0, 0];
}

/** mm:ss, or h:mm:ss past the hour. */
function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

/** Elapsed milliseconds, accumulating only while `running`. */
function useStopwatch(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const banked = useRef(0);
  useEffect(() => {
    if (!running) return;
    const since = performance.now();
    const id = setInterval(() => setElapsed(banked.current + performance.now() - since), 250);
    return () => {
      clearInterval(id);
      banked.current += performance.now() - since;
      setElapsed(banked.current);
    };
  }, [running]);
  return elapsed;
}

const TIER_LABEL: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const SUGGESTION_FLAG = 'tutorial-suggestion-dismissed';

const byId = (id: string) => POOL.find((p) => p.id === id)!;

type Mode = Tier | 'tutorial';

/**
 * play: a puzzle on the board. `replay` marks a puzzle the player already solved.
 * exhausted: the chosen tier has no unsolved puzzles left, so nothing is dealt.
 */
type View = { kind: 'play'; mode: Mode; id: string; replay: boolean } | { kind: 'exhausted'; tier: Tier };

export default function App() {
  // Record keys (id + content fingerprint), so progress can't attach to a changed puzzle.
  const [solved, setSolved] = useState(() => loadSolved(POOL));
  const isSolved = (p: Puzzle) => solved.has(recordKey(p));
  const unsolvedIn = (tier: Tier, except?: string) =>
    tierPuzzles(tier).filter((p) => !isSolved(p) && p.id !== except);

  /** Deals a random unsolved puzzle from the tier, or reports that none are left. */
  const deal = (tier: Tier, except?: string): View => {
    const options = unsolvedIn(tier, except);
    if (options.length === 0) return { kind: 'exhausted', tier };
    const p = options[Math.floor(Math.random() * options.length)];
    return { kind: 'play', mode: tier, id: p.id, replay: false };
  };
  const tutorialView = (id: string): View => ({ kind: 'play', mode: 'tutorial', id, replay: isSolved(byId(id)) });

  // Open straight on a playable puzzle: the first tier with anything unsolved (Easy if all are done).
  const [view, setView] = useState<View>(() => deal(TIERS.find((t) => unsolvedIn(t).length > 0) ?? 'easy'));
  // Bumped on every switch so the new puzzle remounts fresh; later mounts also grab focus.
  const [visit, setVisit] = useState(0);
  // Whether the board holds unsaved work (entries or a suspect, not yet solved).
  const dirty = useRef(false);
  const [pending, setPending] = useState<View | null>(null);
  const [suggest, setSuggest] = useState(() => solved.size === 0 && !loadFlag(SUGGESTION_FLAG));

  const show = (v: View) => {
    dirty.current = false;
    setPending(null);
    setView(v);
    setVisit((n) => n + 1);
  };
  /** Never silently discard an active game: ask first. */
  const switchTo = (v: View) => (dirty.current && view.kind === 'play' ? setPending(v) : show(v));

  const dismissSuggestion = () => {
    setSuggest(false);
    saveFlag(SUGGESTION_FLAG);
  };

  const markSolved = (p: Puzzle) => {
    dismissSuggestion();
    const key = recordKey(p);
    setSolved((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev).add(key);
      saveSolved(next);
      return next;
    });
  };

  const mode: Mode = view.kind === 'play' ? view.mode : view.tier;
  const pickMode = (m: Mode) => {
    if (m === mode) return;
    if (m === 'tutorial') {
      const first = TUTORIALS.find((p) => !isSolved(p)) ?? TUTORIALS[0];
      switchTo(tutorialView(first.id));
    } else switchTo(deal(m));
  };

  const puzzle = view.kind === 'play' ? byId(view.id) : null;

  let winActions: ReactNode = null;
  if (puzzle && view.kind === 'play') {
    const tutorialIndex = TUTORIALS.indexOf(puzzle);
    if (view.mode === 'tutorial' && tutorialIndex + 1 < TUTORIALS.length) {
      const next = TUTORIALS[tutorialIndex + 1];
      winActions = (
        <button type="button" className="next" onClick={() => show(tutorialView(next.id))}>
          Next puzzle
        </button>
      );
    } else if (view.mode === 'tutorial') {
      winActions = <p className="more">Tutorial over. Pick Easy, Medium or Hard at the top for a real case.</p>;
    } else if (unsolvedIn(view.mode, puzzle.id).length > 0) {
      const tier = view.mode;
      winActions = (
        <button type="button" className="next" onClick={() => show(deal(tier, puzzle.id))}>
          New game
        </button>
      );
    } else {
      const tier = view.mode;
      winActions = (
        <>
          <p className="more">
            That was the last unseen {TIER_LABEL[tier]} case. No reruns pretending to be new; the
            rulebook has standards.
          </p>
          <button type="button" className="next" onClick={() => show({ kind: 'exhausted', tier })}>
            Replay {tier === 'easy' ? 'an' : 'a'} {TIER_LABEL[tier]} case
          </button>
        </>
      );
    }
  }

  const label =
    puzzle && view.kind === 'play'
      ? (puzzle.status === 'tutorial' ? puzzle.name : `${TIER_LABEL[puzzle.tier]} · ${puzzle.name}`) +
        (view.replay ? ' (replay)' : '')
      : undefined;

  return (
    <main className="app">
      <Header
        tag={puzzle ? `CASE #${puzzle.caseNumber}` : 'CASE FILES'}
        label={label}
        intro="Below are three rules."
        rest={
          <>
            <strong>Exactly one of them is lying.</strong> The other two are deadly serious. Fill the
            grid with 1–{puzzle?.size ?? TIER_SIZE[mode === 'tutorial' ? 'easy' : mode]}, then name the
            liar. The fixed tiles never lie, and neither do we. Only the rulebook does, and it’s very
            proud of itself.
          </>
        }
      />

      {suggest && (
        <section className="suggest" aria-label="Tutorial suggestion">
          <p>New here? The two-case tutorial shows how a lying rule works. Entirely optional.</p>
          <div className="row-actions">
            <button
              type="button"
              className="key wide"
              onClick={() => {
                dismissSuggestion();
                pickMode('tutorial');
              }}
            >
              Try the tutorial
            </button>
            <button type="button" className="key wide" onClick={dismissSuggestion}>
              Skip
            </button>
          </div>
        </section>
      )}

      <ModeSelector
        mode={mode}
        unsolved={(t) => unsolvedIn(t).length}
        total={(t) => tierPuzzles(t).length}
        onPick={pickMode}
        tutorialId={view.kind === 'play' && view.mode === 'tutorial' ? view.id : undefined}
        onTutorialLevel={(id) => view.kind === 'play' && view.id !== id && switchTo(tutorialView(id))}
      />

      {pending && <ConfirmAbandon onKeep={() => setPending(null)} onAbandon={() => show(pending)} />}

      {view.kind === 'exhausted' ? (
        <Exhausted
          key={visit}
          tier={view.tier}
          focusOnMount={visit > 0}
          onReplay={(id) => show({ kind: 'play', mode: view.tier, id, replay: true })}
        />
      ) : (
        <Game
          key={visit}
          puzzle={puzzle!}
          focusOnMount={visit > 0}
          onDirty={(d) => {
            dirty.current = d;
          }}
          onSolved={() => markSolved(puzzle!)}
          winActions={winActions}
        />
      )}
    </main>
  );
}

interface HeaderProps {
  tag: string;
  label?: string;
  /** First sentence of the intro, always shown. */
  intro: string;
  /** The rest of the intro, shown inline when "How to play" is open. */
  rest: ReactNode;
}

function Header({ tag, label, intro, rest }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header>
      <div className="tag-row">
        <span className="tag">{tag}</span>
        {label && <span className="level">{label}</span>}
      </div>
      <h1>
        One rule is <span className="chip">full of it.</span>
      </h1>
      <p className="lede" id="how-to-play">
        {intro}
        {open && <> {rest}</>}
      </p>
      <button
        type="button"
        className="howto"
        aria-expanded={open}
        aria-controls="how-to-play"
        onClick={() => setOpen((o) => !o)}
      >
        How to play
      </button>
    </header>
  );
}

interface ModeSelectorProps {
  mode: Mode;
  unsolved: (t: Tier) => number;
  total: (t: Tier) => number;
  onPick: (m: Mode) => void;
  /** Set while a tutorial level is on the board. */
  tutorialId?: string;
  onTutorialLevel: (id: string) => void;
}

function ModeSelector({ mode, unsolved, total, onPick, tutorialId, onTutorialLevel }: ModeSelectorProps) {
  const count = (t: Tier) =>
    total(t) === 0 ? 'none yet' : unsolved(t) === 0 ? 'all solved' : `${unsolved(t)} unsolved`;
  return (
    <nav aria-label="Difficulty" className="modes-wrap">
      <div className="modes">
        {TIERS.map((t) => (
          <button key={t} type="button" className="mode" aria-pressed={mode === t} onClick={() => onPick(t)}>
            <span className="mode-name">{TIER_LABEL[t]}</span>
            <span className="mode-count">{count(t)}</span>
          </button>
        ))}
        <button type="button" className="mode" aria-pressed={mode === 'tutorial'} onClick={() => onPick('tutorial')}>
          <span className="mode-name">Tutorial</span>
          <span className="mode-count">optional</span>
        </button>
      </div>
      {mode === 'tutorial' && (
        <div className="row-actions">
          {TUTORIALS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="key wide sub"
              aria-pressed={tutorialId === p.id}
              onClick={() => onTutorialLevel(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

function ConfirmAbandon({ onKeep, onAbandon }: { onKeep: () => void; onAbandon: () => void }) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keep.current?.focus();
  }, []);
  return (
    <div className="confirm" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-body">
      <p id="confirm-title" className="confirm-title">
        Abandon this case?
      </p>
      <p id="confirm-body">Your entries and suspect will be cleared. It stays unsolved.</p>
      <div className="row-actions">
        <button ref={keep} type="button" className="key wide" onClick={onKeep}>
          Keep playing
        </button>
        <button type="button" className="key wide" onClick={onAbandon}>
          Abandon it
        </button>
      </div>
    </div>
  );
}

function Exhausted({ tier, focusOnMount, onReplay }: { tier: Tier; focusOnMount: boolean; onReplay: (id: string) => void }) {
  const ref = useRef<HTMLElement>(null);
  const puzzles = tierPuzzles(tier);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, []);
  return (
    <section ref={ref} tabIndex={-1} className="panel exhausted" aria-live="polite">
      {puzzles.length === 0 ? (
        <p className="exhausted-title">No {TIER_LABEL[tier]} cases yet. We’d rather ship nothing than ship a lie.</p>
      ) : (
        <>
          <p className="exhausted-title">No unseen {TIER_LABEL[tier]} cases left.</p>
          <p>
            You’ve solved all {puzzles.length}. Pick another difficulty above, or replay one. A replay
            is labelled as a replay.
          </p>
          <div className="replays">
            {puzzles.map((p) => (
              <button key={p.id} type="button" className="key wide" onClick={() => onReplay(p.id)}>
                Replay: {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

interface GameProps {
  puzzle: Puzzle;
  focusOnMount: boolean;
  /** Reports whether the board holds unsolved work worth confirming before discarding. */
  onDirty: (dirty: boolean) => void;
  onSolved: () => void;
  /** Shown under the explanation once solved. */
  winActions: ReactNode;
}

function Game({ puzzle, focusOnMount, onDirty, onSolved, winActions }: GameProps) {
  const isGiven = (r: number, c: number) => puzzle.givens[r][c] !== 0;
  const [grid, setGrid] = useState<Grid>(() => cloneGrid(puzzle.givens));
  const [sel, setSel] = useState<[number, number]>(() => firstEmpty(puzzle.givens));
  const [suspect, setSuspect] = useState<RuleId | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { size, box } = puzzle;

  // After switching puzzles the win panel is gone, so bring the player back to the top of the new case.
  useEffect(() => {
    if (!focusOnMount) return;
    window.scrollTo(0, 0);
    const [r, c] = sel;
    tileRefs.current[r * size + c]?.focus({ preventScroll: true });
  }, []);

  const solved = result === 'solved';
  // Stopwatch: counts up from 00:00, pauses on request (or when the tab is hidden), stops on a solve.
  // The Game remounts for every new puzzle, so it also resets then.
  const [paused, setPaused] = useState(false);
  const elapsed = useStopwatch(!paused && !solved);
  const resumeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onHide = () => document.hidden && setPaused(true);
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  useEffect(() => {
    if (paused) resumeRef.current?.focus();
  }, [paused]);
  const locked = solved || paused;
  const touched = suspect !== null || grid.some((row, r) => row.some((v, c) => v !== puzzle.givens[r][c]));
  useEffect(() => {
    onDirty(touched && !solved);
  }, [touched, solved]);
  const [sr, sc] = sel;
  const selGiven = isGiven(sr, sc);

  const setCell = (r: number, c: number, v: Cell) => {
    if (locked || isGiven(r, c)) return;
    setGrid((g) => {
      const next = cloneGrid(g);
      next[r][c] = v;
      return next;
    });
    setResult(null);
  };

  const move = (r: number, c: number) => {
    const nr = Math.max(0, Math.min(size - 1, r));
    const nc = Math.max(0, Math.min(size - 1, c));
    setSel([nr, nc]);
    tileRefs.current[nr * size + nc]?.focus();
  };

  const onGridKey = (e: KeyboardEvent) => {
    if (paused) return;
    const k = e.key;
    if (k === 'ArrowUp') move(sr - 1, sc);
    else if (k === 'ArrowDown') move(sr + 1, sc);
    else if (k === 'ArrowLeft') move(sr, sc - 1);
    else if (k === 'ArrowRight') move(sr, sc + 1);
    else if (/^[1-9]$/.test(k) && Number(k) <= size) setCell(sr, sc, Number(k) as Cell);
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
    if (locked) return;
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
        ref={(el) => (tileRefs.current[r * size + c] = el)}
        type="button"
        className={`tile${given ? ' given' : ''}${selected ? ' selected' : ''}`}
        tabIndex={selected && !paused ? 0 : -1}
        aria-label={label}
        aria-pressed={selected}
        onClick={() => move(r, c)}
      >
        {v === 0 ? '' : v}
      </button>
    );
  };

  // Render box by box so the gap between boxes can be wider than the gap between tiles.
  const boxes = groupsFor('C', size, box).map((cells, b) => (
    <div className="box" key={b} style={{ gridTemplateColumns: `repeat(${box.cols}, minmax(0, 1fr))` }}>
      {cells.map(([r, c]) => tile(r, c))}
    </div>
  ));

  // Keep focus on the selected tile when tapping keypad buttons with a pointer.
  const keepFocus = (e: React.PointerEvent) => e.preventDefault();

  return (
    <>
      <div className="timer-row">
        <span className="timer" role="timer" aria-label={`Time ${formatTime(elapsed)}${paused ? ', paused' : ''}`}>
          {formatTime(elapsed)}
        </span>
        {!solved && (
          <button type="button" className="timer-btn" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      <section aria-label="Puzzle grid" className={`panel size-${size}${paused ? ' paused' : ''}`}>
        <div
          className="grid"
          role="group"
          aria-label={`${size} by ${size} grid`}
          aria-hidden={paused}
          style={{ gridTemplateColumns: `repeat(${size / box.cols}, minmax(0, 1fr))` }}
          onKeyDown={onGridKey}
        >
          {boxes}
        </div>
        {paused && (
          <div className="pause-overlay">
            <p className="pause-title">Paused</p>
            <p>The board stays hidden while the clock is stopped.</p>
            <button ref={resumeRef} type="button" className="key wide" onClick={() => setPaused(false)}>
              Resume
            </button>
          </div>
        )}
      </section>

      <section className="controls" aria-label="Number pad">
        <div className={`keypad size-${size}`} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {digitsFor(size).map((d) => (
            <button
              key={d}
              type="button"
              className="key"
              disabled={locked || selGiven}
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
            disabled={locked || selGiven}
            onPointerDown={keepFocus}
            onClick={() => setCell(sr, sc, 0)}
          >
            Erase
          </button>
          <button type="button" className="key wide" disabled={paused} onClick={reset}>
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
              disabled={paused}
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
        disabled={paused}
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

      <p className="keys-help">Keyboard: arrows move · 1–{size} type · Backspace erases</p>
    </>
  );
}
