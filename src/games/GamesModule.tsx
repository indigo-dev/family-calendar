import { useEffect, useState, type ComponentType } from 'react';
import { t } from '../i18n';
import { useMinute } from '../lib/clock';
import { softly } from '../lib/transition';
import { useStore } from '../store';
import { Minefield } from './Minefield';
import { TilePairs } from './TilePairs';
import { Gems } from './Gems';
import { Paddle } from './Paddle';
import { PlayerPicker } from './shared';
import { GUEST, addPlaySeconds, clockTime, gate, useGamesSettings, usePlayedToday, usePlayer, useRecords, type GameId } from './store';
import './games.css';

const GAMES: {
  id: GameId;
  Comp: ComponentType<{ player: string }>;
  record: (r: Record<string, Record<string, number>>, p: string) => string | null;
}[] = [
  {
    id: 'mines',
    Comp: Minefield,
    record: (r, p) => (r['mines:easy']?.[p] !== undefined ? t('games.bestTime', { time: clockTime(r['mines:easy'][p]) }) : null),
  },
  {
    id: 'tiles',
    Comp: TilePairs,
    record: (r, p) => (r.tiles?.[p] !== undefined ? t('games.bestTime', { time: clockTime(r.tiles[p]) }) : null),
  },
  { id: 'gems', Comp: Gems, record: (r, p) => (r.gems?.[p] !== undefined ? t('games.bestScore', { n: r.gems[p] }) : null) },
  { id: 'paddle', Comp: Paddle, record: (r, p) => (r.paddle?.[p] ? t('games.paddle.wins', { n: r.paddle[p] }) : null) },
];

/** The games corner: pick a game, who plays, play – within the limits set for this device. */
export function GamesModule() {
  const now = useMinute();
  const cfg = useGamesSettings();
  const played = usePlayedToday(now);
  const open = gate(cfg, now, played);
  const { members } = useStore();
  const stored = usePlayer();
  // a player who was removed from the family plays as guest
  const player = stored === GUEST || members.some((m) => m.id === stored) ? stored : GUEST;
  const records = useRecords();
  const [game, setGame] = useState<GameId | null>(null);

  // play time counts while a game is open and the screen is visible
  useEffect(() => {
    if (!game || !open.open) return;
    const id = window.setInterval(() => document.visibilityState === 'visible' && addPlaySeconds(10), 10_000);
    return () => window.clearInterval(id);
  }, [game, open.open]);

  if (!open.open) {
    return (
      <main className="view games-locked">
        <div className="games-locked-box">
          <span className="games-locked-icon" aria-hidden>
            {open.reason === 'hours' ? '🌙' : '⏳'}
          </span>
          <h2>{open.reason === 'hours' ? t('games.locked.hours', { from: cfg.from, to: cfg.to }) : t('games.locked.time')}</h2>
          <p className="muted">{open.reason === 'hours' ? t('games.locked.hoursHint') : t('games.locked.timeHint')}</p>
        </div>
      </main>
    );
  }

  const current = GAMES.find((g) => g.id === game);
  if (current) {
    const { Comp } = current;
    return (
      <main className="view games-view" data-vt-section>
        <div className="games-head">
          <button className="btn" onClick={() => softly(() => setGame(null), { dir: -1, axis: 'x' })}>
            ‹ {t('games.back')}
          </button>
          <h2>{t(`games.${current.id}.name`)}</h2>
          <span className="game-spacer" />
          {open.minutesLeft !== null && <span className="game-stat muted">{t('games.left', { n: open.minutesLeft })}</span>}
        </div>
        <Comp key={`${current.id}:${player}`} player={player} />
      </main>
    );
  }

  return (
    <main className="view games-view" data-vt-section>
      <div className="games-pick-head">
        <h2>{t('games.pick')}</h2>
        {open.minutesLeft !== null && <span className="game-stat muted">{t('games.left', { n: open.minutesLeft })}</span>}
      </div>
      <PlayerPicker player={player} />
      <div className="games-grid">
        {GAMES.map((g) => (
          <button key={g.id} className={`game-card game-card-${g.id}`} onClick={() => softly(() => setGame(g.id), { dir: 1, axis: 'x' })}>
            <span className={`game-art art-${g.id}`} aria-hidden>
              <GameArt id={g.id} />
            </span>
            <span className="game-card-name">{t(`games.${g.id}.name`)}</span>
            <span className="game-card-note">{t(`games.${g.id}.note`)}</span>
            <span className="game-card-best">{g.record(records, player) ?? t('games.noBest')}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

/** small drawn previews of the games (own artwork in the spectrum colours) */
function GameArt({ id }: { id: GameId }) {
  if (id === 'mines')
    return (
      <svg viewBox="0 0 120 80">
        {Array.from({ length: 24 }, (_, i) => {
          const x = (i % 6) * 19 + 4;
          const y = Math.floor(i / 6) * 19 + 2;
          const open = [0, 1, 2, 6, 7, 12, 13, 14, 18, 19].includes(i);
          return <rect key={i} x={x} y={y} width="17" height="17" rx="4" className={open ? 'a-open' : 'a-closed'} />;
        })}
        <text x="31.5" y="33" className="a-n1">
          1
        </text>
        <text x="50.5" y="52" className="a-n2">
          2
        </text>
        <text x="88.5" y="14" className="a-flag">
          ⚑
        </text>
      </svg>
    );
  if (id === 'tiles')
    return (
      <svg viewBox="0 0 120 80">
        {[
          [14, 20, 0],
          [38, 20, 0],
          [62, 20, 0],
          [86, 20, 0],
          [26, 12, 1],
          [50, 12, 1],
          [74, 12, 1],
          [38, 4, 2],
          [62, 4, 2],
        ].map(([x, y, z], i) => (
          <g key={i}>
            <rect x={x + 2} y={y + 4} width="22" height="30" rx="4" className="a-tile-side" />
            <rect x={x} y={y} width="22" height="30" rx="4" className={`a-tile z${z}`} />
            <circle cx={x + 11} cy={y + 15} r="5" className={`a-dot d${i % 5}`} />
          </g>
        ))}
      </svg>
    );
  if (id === 'gems')
    return (
      <svg viewBox="0 0 120 80">
        {Array.from({ length: 15 }, (_, i) => (
          <circle key={i} cx={(i % 5) * 22 + 16} cy={Math.floor(i / 5) * 24 + 16} r="8" className={`a-gem g${(i * 7) % 6}`} />
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 120 80">
      <rect x="2" y="2" width="116" height="76" rx="8" className="a-field" />
      <line x1="60" y1="8" x2="60" y2="72" className="a-net" />
      <rect x="10" y="22" width="4" height="22" rx="2" className="a-left" />
      <rect x="106" y="38" width="4" height="22" rx="2" className="a-right" />
      <circle cx="74" cy="34" r="3.5" className="a-ball" />
    </svg>
  );
}
