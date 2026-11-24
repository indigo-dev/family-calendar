import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '../i18n';
import { LEVELS, emptyField, isLost, isWon, layMines, open, type Field, type Level } from './logic/mines';
import { clockTime, submitResult, useRecords } from './store';
import { Result } from './shared';
import { nowMs } from './time';
import { useSize } from '../lib/hooks';

const HOLD_MS = 420;

/** Minefield: tap opens, a long press (or the flag switch) sets a flag. Record = best time per level. */
export function Minefield({ player }: { player: string }) {
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [fields, setFields] = useState<Field[]>(() => emptyField(LEVELS[0].w, LEVELS[0].h));
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(() => nowMs());
  const [flagMode, setFlagMode] = useState(false);
  const [end, setEnd] = useState<{ won: boolean; seconds: number; record: boolean } | null>(null);
  const hold = useRef<{ timer: number; fired: boolean } | null>(null);
  const records = useRecords();
  const [stageRef, stage] = useSize<HTMLDivElement>();
  /** size of the running game (fixed at the first tap, so turning the device never breaks a game) */
  const [gameDims, setGameDims] = useState({ w: LEVELS[0].w, h: LEVELS[0].h });
  // on a portrait screen a wide field is turned upright: the same fields, but much larger to tap
  const portrait = stage.height > stage.width * 1.15;
  const want = portrait && level.w > level.h ? { w: level.h, h: level.w } : { w: level.w, h: level.h };
  // before the first tap all fields are alike (same count either way), so the field may follow the screen
  const dims = started === null ? want : gameDims;
  const key = `mines:${level.id}`;
  const best = records[key]?.[player];

  const reset = (l = level) => {
    setLevel(l);
    setFields(emptyField(l.w, l.h));
    setStarted(null);
    setEnd(null);
  };

  // the clock runs while playing
  useEffect(() => {
    if (started === null || end) return;
    const id = window.setInterval(() => setNow(nowMs()), 250);
    return () => window.clearInterval(id);
  }, [started, end]);
  const seconds = started === null ? 0 : Math.max(0, Math.floor((now - started) / 1000));

  const finish = (next: Field[]) => {
    if (isLost(next)) {
      setFields(next.map((f) => (f.mine ? { ...f, open: true } : f)));
      setEnd({ won: false, seconds, record: false });
    } else if (isWon(next)) {
      const s = Math.max(1, Math.round((nowMs() - (started ?? nowMs())) / 1000));
      setFields(next.map((f) => (f.mine ? { ...f, flag: true } : f)));
      setEnd({ won: true, seconds: s, record: submitResult(key, player, s, true) });
    } else setFields(next);
    setNow(nowMs());
  };

  const tap = (i: number) => {
    if (end) return;
    const f = fields[i];
    if (flagMode) return toggleFlag(i);
    if (f.flag || f.open) return;
    if (started === null) {
      // the first tap is always safe: the mines are laid now
      const laid = layMines(dims.w, dims.h, level.mines, i);
      setGameDims(dims);
      setStarted(nowMs());
      return finish(open(laid, dims.w, dims.h, i));
    }
    finish(open(fields, dims.w, dims.h, i));
  };

  const toggleFlag = (i: number) => {
    if (end || fields[i].open || started === null) return;
    navigator.vibrate?.(15);
    setFields((cur) => cur.map((f, j) => (j === i ? { ...f, flag: !f.flag } : f)));
  };

  const flags = fields.filter((f) => f.flag).length;

  return (
    <div className="game mines">
      <div className="game-bar">
        <div className="segmented small" role="tablist">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={l.id === level.id}
              className={l.id === level.id ? 'active' : ''}
              onClick={() => reset(l)}
            >
              {t(`games.mines.${l.id}`)}
            </button>
          ))}
        </div>
        <button className={`chip game-flag ${flagMode ? 'on' : ''}`} aria-pressed={flagMode} onClick={() => setFlagMode((m) => !m)}>
          ⚑ {t('games.mines.flag')}
        </button>
        <span className="game-spacer" />
        <span className="game-stat">💣 {level.mines - flags}</span>
        <span className="game-stat">⏱ {clockTime(seconds)}</span>
        {best !== undefined && <span className="game-stat muted">{t('games.bestTime', { time: clockTime(best) })}</span>}
      </div>
      <div className="game-stage" ref={stageRef}>
        <div
          className="mines-grid"
          style={{ '--w': dims.w, '--h': dims.h } as CSSProperties}
          role="grid"
          aria-label={t('games.mines.name')}
          onContextMenu={(e) => e.preventDefault()}
        >
          {fields.map((f, i) => (
            <button
              key={i}
              className={`mines-cell ${f.open ? 'open' : ''} ${f.open && f.mine ? 'mine' : ''} ${f.flag ? 'flag' : ''} n${f.n}`}
              onPointerDown={() => {
                const h = { fired: false, timer: 0 };
                h.timer = window.setTimeout(() => {
                  h.fired = true;
                  toggleFlag(i);
                }, HOLD_MS);
                hold.current = h;
              }}
              onPointerUp={() => window.clearTimeout(hold.current?.timer)}
              onPointerLeave={() => window.clearTimeout(hold.current?.timer)}
              onClick={() => {
                if (hold.current?.fired) return;
                tap(i);
              }}
              aria-label={f.open ? (f.mine ? '💣' : String(f.n)) : f.flag ? '⚑' : ''}
            >
              {f.open ? (f.mine ? '💣' : f.n || '') : f.flag ? '⚑' : ''}
            </button>
          ))}
        </div>
        {end && (
          <Result
            won={end.won}
            title={end.won ? t('games.won') : t('games.lost')}
            text={end.won ? t('games.mines.time', { time: clockTime(end.seconds) }) : t('games.mines.boom')}
            record={end.record}
            onAgain={() => reset()}
          />
        )}
      </div>
      <p className="game-hint">{t('games.mines.hint')}</p>
    </div>
  );
}
