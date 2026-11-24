import { flushSync } from 'react-dom';
/** The app always cross-fades – between the areas and inside them ("Bewegung reduzieren" switches it off). */

interface VT {
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  finished: Promise<void>;
}
type VTDocument = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT };
let current: VT | null = null;

/** waits (max. ~400 ms) until a lazily loaded module has replaced its loading placeholder */
function moduleReady(): Promise<void> {
  return new Promise((resolve) => {
    const until = performance.now() + 400;
    const check = () => {
      if (!document.querySelector('.module-loading') || performance.now() > until) resolve();
      // no requestAnimationFrame: rendering (and with it rAF) is paused while the transition waits
      else window.setTimeout(check, 16);
    };
    check();
  });
}

/**
 * What moves:
 * - 'module'  the whole area (switching between calendar, weather, …)
 * - 'section' the element marked `data-vt-section` (another calendar view, another day, a filter)
 * - 'items'   single elements marked `vt-item` with a `--vtn` name (a to-do is ticked off: it leaves,
 *             the others glide to their new places)
 */
type Scope = 'module' | 'section' | 'items';

interface Options {
  scope: Scope;
  dir?: 1 | -1;
  /** direction of 'slide': down the rail (y, default) or sideways (x, e.g. the next week) */
  axis?: 'x' | 'y';
  /** async part of the update (a module that is still loading) */
  wait?: () => Promise<void>;
}

function run(update: () => void, { scope, dir = 1, axis = 'y', wait }: Options): boolean {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const doc = document as VTDocument;
  // hidden page (screen off, other tab): nobody sees it, and the browser would stall the transition.
  // A transition that is still running is not interrupted by a small one inside the area.
  if (reduce || document.visibilityState !== 'visible' || !doc.startViewTransition) return false;
  if (current && scope !== 'module') return false;
  const root = document.documentElement;
  root.dataset.vt = 'fade';
  root.dataset.vtDir = dir > 0 ? 'fwd' : 'back';
  root.dataset.vtAxis = axis;
  if (scope === 'module') delete root.dataset.vtScope;
  else root.dataset.vtScope = scope;
  const vt = doc.startViewTransition(async () => {
    flushSync(update);
    await wait?.();
  });
  // a quick second tap skips the running transition – that is fine, not an error
  vt.ready.catch(() => {});
  vt.updateCallbackDone.catch(() => {});
  vt.finished
    .catch(() => {})
    .finally(() => {
      // a newer transition may already have set its own kind
      if (current === vt) {
        current = null;
        delete root.dataset.vt;
        delete root.dataset.vtDir;
        delete root.dataset.vtAxis;
        delete root.dataset.vtScope;
      }
    });
  current = vt;
  return true;
}

/**
 * Runs `update` (the module switch) with the chosen animation. Uses the View Transitions API
 * (old and new page cross over); older browsers get a short fade-in of the new page.
 */
export function switchModule(update: () => void, dir: 1 | -1) {
  if (run(update, { scope: 'module', dir, wait: moduleReady })) return;
  update();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const app = document.querySelector<HTMLElement>('.shell > .app');
  app?.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 280,
    easing: 'cubic-bezier(.2,.8,.2,1)',
  });
}

/**
 * A change inside an area with the chosen animation: the part marked `data-vt-section` (default) or
 * the single elements marked `vt-item` (`items: true`). Without support it simply happens.
 */
export function softly(update: () => void, opts: { items?: boolean; dir?: 1 | -1; axis?: 'x' | 'y' } = {}) {
  if (!run(update, { scope: opts.items ? 'items' : 'section', dir: opts.dir, axis: opts.axis })) update();
}

/** style for an element that animates on its own in `softly(…, { items: true })` (name must be unique) */
export const vtItem = (name: string) => ({ ['--vtn' as string]: `vt-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}` });
