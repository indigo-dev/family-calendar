/**
 * Turns a path relative to the page into a full URL.
 *
 * Needed for `url()` values handed to CSS through custom properties (mask images of the one-colour symbol
 * styles): the browser resolves a relative url() against the stylesheet that uses the variable. In the
 * built app that stylesheet lives in /assets/, so "symbols/x.svg" became "/assets/symbols/x.svg" (404)
 * and the symbols stayed empty – only in the build, never on the dev server.
 */
export function absoluteUrl(path: string, base = document.baseURI): string {
  return new URL(path, base).href;
}
