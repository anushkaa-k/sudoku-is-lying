import type { Puzzle } from './types';

/**
 * Solved puzzles, stored locally only; the game works without storage.
 *
 * v2 records are `<id>@<fingerprint>`, where the fingerprint hashes the puzzle's
 * size, box shape, givens, solution and liar. If a puzzle's content ever changes,
 * its old record simply stops matching instead of carrying over wrongly.
 *
 * v1 (`lying-sudoku:solved:v1`) held bare ids from the 4x4-only pool. It is migrated
 * once, only for ids whose puzzle is still the same 4x4 content, and the v1 key is
 * left in place untouched rather than wiped.
 */
const KEY_V1 = 'lying-sudoku:solved:v1';
const KEY_V2 = 'lying-sudoku:solved:v2';

/** FNV-1a over the puzzle's identity-defining content, base 36. */
export function fingerprint(p: Puzzle): string {
  const text = JSON.stringify([p.size, p.box.rows, p.box.cols, p.givens, p.solution, p.falseRuleId]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export const recordKey = (p: Puzzle) => `${p.id}@${fingerprint(p)}`;

const readList = (key: string): string[] => {
  const raw = localStorage.getItem(key);
  const list = raw ? JSON.parse(raw) : [];
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
};

/** Record keys of solved puzzles, migrating v1 progress the first time. */
export function loadSolved(pool: Puzzle[]): Set<string> {
  try {
    if (localStorage.getItem(KEY_V2) !== null) return new Set(readList(KEY_V2));
    const v1 = readList(KEY_V1);
    const migrated = v1.flatMap((id) => {
      const p = pool.find((q) => q.id === id);
      // Every v1 record came from a 4x4 puzzle; only carry it over if that is still what the id names.
      return p && p.size === 4 ? [recordKey(p)] : [];
    });
    const solved = new Set(migrated);
    if (v1.length) saveSolved(solved);
    return solved;
  } catch {
    return new Set();
  }
}

export function saveSolved(solved: Set<string>): void {
  try {
    localStorage.setItem(KEY_V2, JSON.stringify([...solved]));
  } catch {
    // Private mode or blocked storage: progress just won't survive a refresh.
  }
}

/** One-off yes/no flags, e.g. "the tutorial suggestion was dismissed". */
export function loadFlag(name: string): boolean {
  try {
    return localStorage.getItem(`lying-sudoku:${name}`) === '1';
  } catch {
    return false;
  }
}

export function saveFlag(name: string): void {
  try {
    localStorage.setItem(`lying-sudoku:${name}`, '1');
  } catch {
    // Storage blocked: the flag just won't survive a refresh.
  }
}

/** Set once this device has finished or skipped the tutorial, so it stops opening by itself. */
export const TUTORIAL_DONE_FLAG = 'tutorial-done';
/** Set by earlier versions when the tutorial suggestion was dismissed or any puzzle was solved. */
const LEGACY_SUGGESTION_FLAG = 'tutorial-suggestion-dismissed';

/**
 * Whether the tutorial should no longer open automatically: it was finished or skipped,
 * or this device already has progress beyond the tutorial (an existing player).
 */
export function tutorialSettled(solved: Set<string>, tutorialKeys: string[]): boolean {
  return (
    loadFlag(TUTORIAL_DONE_FLAG) ||
    loadFlag(LEGACY_SUGGESTION_FLAG) ||
    [...solved].some((k) => !tutorialKeys.includes(k))
  );
}
