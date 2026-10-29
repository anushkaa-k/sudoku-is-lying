import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface TourStep {
  /** Matches a `data-tour` attribute on a real element of the game screen. */
  target: string;
  text: ReactNode;
}

interface Props {
  steps: TourStep[];
  /** Last step's Next: the player moves on to the puzzle. */
  onDone: () => void;
  onSkip: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6; // breathing room around the highlighted element
const GAP = 14; // distance between the highlight and the instruction card
const MARGIN = 12; // keep the card this far from the viewport edges

const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * A coach-mark walkthrough over the live game screen: everything except the current
 * element is dimmed and blurred, the element gets a ring, and a card with an arrow
 * explains it. The page underneath is inert while it is open, and unmounting removes
 * every trace (overlay, inert, focus trap).
 */
export function Walkthrough({ steps, onDone, onSkip }: Props) {
  const [i, setI] = useState(0);
  const [hole, setHole] = useState<Box | null>(null);
  const [tip, setTip] = useState({ width: 320, height: 170 });
  const tipRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  // The game underneath can't be clicked, focused or read while the walkthrough is open.
  useEffect(() => {
    const main = document.querySelector('main');
    main?.setAttribute('inert', '');
    return () => main?.removeAttribute('inert');
  }, []);

  // Bring each step's element into view, leaving room for the card below it.
  useEffect(() => {
    const el = find(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const needed = r.height + 2 * PAD + GAP + tip.height;
    const offset = Math.max(MARGIN + PAD, (window.innerHeight - needed) / 2);
    window.scrollTo({ top: window.scrollY + r.top - offset, behavior: reducedMotion() ? 'auto' : 'smooth' });
    nextRef.current?.focus({ preventScroll: true });
  }, [i]);

  // Track the element every frame so the highlight follows scrolling, resizing and layout shifts.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = find(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        const next = { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD };
        setHole((h) =>
          h && Math.abs(h.top - next.top) < 0.5 && Math.abs(h.left - next.left) < 0.5 && Math.abs(h.width - next.width) < 0.5 && Math.abs(h.height - next.height) < 0.5
            ? h
            : next,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);

  useLayoutEffect(() => {
    const el = tipRef.current;
    if (el && (el.offsetWidth !== tip.width || el.offsetHeight !== tip.height)) {
      setTip({ width: el.offsetWidth, height: el.offsetHeight });
    }
  });

  const next = () => (last ? onDone() : setI(i + 1));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onSkip();
    } else if (e.key === 'Tab') {
      // Keep focus inside the card.
      e.preventDefault();
      (document.activeElement === nextRef.current ? skipRef : nextRef).current?.focus();
    }
  };

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Card placement: below the element if it fits, else above, else pinned to the bottom edge.
  let tipTop = vh - tip.height - MARGIN;
  let arrow: 'up' | 'down' = 'up';
  if (hole) {
    const below = hole.top + hole.height + GAP;
    const above = hole.top - GAP - tip.height;
    if (below + tip.height <= vh - MARGIN) tipTop = below;
    else if (above >= MARGIN) {
      tipTop = above;
      arrow = 'down';
    } else tipTop = Math.min(Math.max(MARGIN, below), vh - tip.height - MARGIN);
  }
  const centerX = hole ? hole.left + hole.width / 2 : vw / 2;
  const tipLeft = Math.min(Math.max(MARGIN, centerX - tip.width / 2), vw - tip.width - MARGIN);
  const arrowLeft = Math.min(Math.max(22, centerX - tipLeft), tip.width - 22);

  const h = hole ?? { top: vh / 2, left: vw / 2, width: 0, height: 0 };
  const shades: Box[] = [
    { top: 0, left: 0, width: vw, height: Math.max(0, h.top) },
    { top: h.top + h.height, left: 0, width: vw, height: Math.max(0, vh - h.top - h.height) },
    { top: h.top, left: 0, width: Math.max(0, h.left), height: h.height },
    { top: h.top, left: h.left + h.width, width: Math.max(0, vw - h.left - h.width), height: h.height },
  ];

  return createPortal(
    <div className="coach">
      {/* Swallows clicks everywhere, including on the highlighted element. */}
      <div className="coach-blocker" />
      {shades.map((s, k) => (
        <div key={k} className="coach-shade" style={s} />
      ))}
      {hole && <div className="coach-ring" style={hole} />}
      <div
        ref={tipRef}
        className={`coach-tip arrow-${arrow}`}
        style={{ top: tipTop, left: tipLeft }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-count"
        aria-describedby="coach-text"
        onKeyDown={onKey}
      >
        <span className="coach-arrow" style={{ left: arrowLeft }} aria-hidden="true" />
        <p id="coach-count" className="coach-count">
          Step {i + 1} of {steps.length}
        </p>
        <p id="coach-text" className="coach-text" aria-live="polite" key={i}>
          {step.text}
        </p>
        <div className="coach-actions">
          <button ref={skipRef} type="button" className="coach-skip" onClick={onSkip}>
            Skip
          </button>
          <button ref={nextRef} type="button" className="coach-next" onClick={next}>
            {last ? 'Next: try the puzzle' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
