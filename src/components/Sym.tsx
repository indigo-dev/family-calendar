import type { CSSProperties } from 'react';
import { useStore } from '../store';
import { resolveSymbol, type SymbolSet } from '../lib/symbols';
import { absoluteUrl } from '../lib/absoluteUrl';

/**
 * An emoji drawn in the chosen symbol style. Size follows the font size (1em box).
 * One-colour styles take `--sym-tint` (falls back to the text colour).
 */
export function Sym({ emoji, fallback, set, className = '' }: { emoji: string; fallback?: string; set?: SymbolSet; className?: string }) {
  const { settings } = useStore();
  const r = resolveSymbol(set ?? settings.symbols, emoji, fallback);
  if (r.mode === 'native') {
    return (
      <span className={`sym sym-native ${className}`} aria-hidden>
        {r.text}
      </span>
    );
  }
  if (r.mode === 'image') {
    return <img className={`sym sym-image ${className}`} src={r.src} alt="" aria-hidden draggable={false} loading="lazy" />;
  }
  const style = { ['--sym-src' as string]: `url("${absoluteUrl(r.src)}")` } as CSSProperties;
  return <span className={`sym sym-mask ${className}`} style={style} aria-hidden />;
}
