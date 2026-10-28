/** Which puzzles this browser has solved. Stored locally only; the game works without it. */
const KEY = 'lying-sudoku:solved:v1';

export function loadSolved(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveSolved(solved: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...solved]));
  } catch {
    // Private mode or blocked storage: progress just won't survive a refresh.
  }
}
