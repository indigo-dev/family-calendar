import { flushSync } from 'react-dom';

/** How the app animates when switching between the main areas (modules). */
export type ModuleTransition = 'none' | 'fade' | 'slide' | 'zoom' | 'push';

export const MODULE_TRANSITIONS: { id: ModuleTransition; label: string; note: string }[] = [
  { id: 'none', label: 'Sofort', note: 'ohne Animation' },
  { id: 'fade', label: 'Überblenden', note: 'ruhig und weich' },
  { id: 'slide', label: 'Gleiten', note: 'folgt der Leiste' },
  { id: 'zoom', label: 'Zoomen', note: 'wie beim iPad' },
  { id: 'push', label: 'Blättern', note: 'ganze Seite schiebt' },
];

export const isModuleTransition = (v: unknown): v is ModuleTransition => MODULE_TRANSITIONS.some((t) => t.id === v);

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
 * Runs `update` (the module switch) with the chosen animation. Uses the View Transitions API
 * (old and new page cross over); older browsers get a short fade-in of the new page.
 */
export function switchModule(update: () => void, kind: ModuleTransition, dir: 1 | -1) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // hidden page (screen off, other tab): nobody sees it, and the browser would stall the transition
  if (kind === 'none' || reduce || document.visibilityState !== 'visible') return update();
  const root = document.documentElement;
  const doc = document as VTDocument;
  if (doc.startViewTransition) {
    root.dataset.vt = kind;
    root.dataset.vtDir = dir > 0 ? 'fwd' : 'back';
    const t = doc.startViewTransition(async () => {
      flushSync(update);
      await moduleReady();
    });
    // a quick second tap skips the running transition – that is fine, not an error
    t.ready.catch(() => {});
    t.updateCallbackDone.catch(() => {});
    t.finished
      .catch(() => {})
      .finally(() => {
        // a newer transition may already have set its own kind
        if (current === t) {
          delete root.dataset.vt;
          delete root.dataset.vtDir;
        }
      });
    current = t;
    return;
  }
  update();
  const app = document.querySelector<HTMLElement>('.shell > .app');
  const from = kind === 'zoom' ? 'scale(0.97)' : kind === 'fade' ? 'none' : `translateY(${dir * 24}px)`;
  app?.animate(
    [
      { opacity: 0, transform: from },
      { opacity: 1, transform: 'none' },
    ],
    {
      duration: 280,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    },
  );
}
