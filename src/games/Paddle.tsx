import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { t } from '../i18n';
import { useSize } from '../lib/hooks';
import {
  BALL_R,
  FIELD_H,
  FIELD_W,
  PADDLE_H,
  PADDLE_W,
  PADDLE_X,
  aiMove,
  clampPaddle,
  newDuel,
  step,
  winner,
  type Duel,
} from './logic/paddle';
import { submitResult, useRecords } from './store';
import { Result } from './shared';

type Mode = 'duo' | 'solo';

/** Paddle duel: two players (one side of the tablet each, multi-touch) or against the tablet. */
export function Paddle({ player }: { player: string }) {
  const [mode, setMode] = useState<Mode>('duo');
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready');
  const [won, setWon] = useState<'left' | 'right' | null>(null);
  const [record, setRecord] = useState(false);
  const [final, setFinal] = useState<[number, number]>([0, 0]);
  const [wrapRef, size] = useSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const duel = useRef<Duel>(newDuel());
  const wins = useRecords().paddle?.[player] ?? 0;

  /** field → screen: uniform scale, centred */
  const geometry = () => {
    const s = Math.min(size.width / FIELD_W, size.height / FIELD_H);
    return { s, ox: (size.width - FIELD_W * s) / 2, oy: (size.height - FIELD_H * s) / 2 };
  };

  const draw = () => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(size.width * dpr)) {
      c.width = Math.round(size.width * dpr);
      c.height = Math.round(size.height * dpr);
    }
    const css = getComputedStyle(c);
    const { s, ox, oy } = geometry();
    const d = duel.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    // field
    ctx.fillStyle = css.getPropertyValue('--field').trim() || '#1e1b4b';
    ctx.beginPath();
    ctx.roundRect(0, 0, FIELD_W, FIELD_H, 5);
    ctx.fill();
    ctx.strokeStyle = css.getPropertyValue('--field-line').trim() || 'rgba(255,255,255,.15)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    ctx.moveTo(FIELD_W / 2, 3);
    ctx.lineTo(FIELD_W / 2, FIELD_H - 3);
    ctx.stroke();
    ctx.setLineDash([]);
    // score, large and faint in the background
    ctx.fillStyle = css.getPropertyValue('--field-score').trim() || 'rgba(255,255,255,.12)';
    ctx.font = `800 26px ${css.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(d.score[0]), FIELD_W / 4, FIELD_H / 2);
    ctx.fillText(String(d.score[1]), (FIELD_W * 3) / 4, FIELD_H / 2);
    // paddles
    const paddle = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(x - PADDLE_W / 2, y - PADDLE_H / 2, PADDLE_W, PADDLE_H, PADDLE_W / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };
    paddle(PADDLE_X, d.left, '#fb923c');
    paddle(FIELD_W - PADDLE_X, d.right, '#0ea5e9');
    // ball
    ctx.fillStyle = css.getPropertyValue('--ball').trim() || '#fff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(d.ball.x, d.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  // the game loop – only while playing and visible
  useEffect(() => {
    if (phase !== 'play') {
      draw();
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      if (document.visibilityState === 'visible') {
        let d = duel.current;
        if (mode === 'solo') d = { ...d, right: aiMove(d, dt) };
        const r = step(d, dt);
        duel.current = r.duel;
        if (r.event === 'hit') navigator.vibrate?.(8);
        const w = winner(r.duel);
        if (w) {
          setWon(w);
          setFinal(r.duel.score);
          setPhase('over');
          setRecord(mode === 'solo' && w === 'left' ? submitResult('paddle', player, wins + 1, false) : false);
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // draw() reads the latest refs; restarting the loop on every render is not wanted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, size.width, size.height]);

  // fingers: the left half moves the left paddle, the right half the right one (solo: everything moves left)
  const onPointer = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown' && phase !== 'play') return;
    const r = e.currentTarget.getBoundingClientRect();
    const { s, oy } = geometry();
    const y = clampPaddle((e.clientY - r.top - oy) / s);
    const right = mode === 'duo' && e.clientX - r.left > r.width / 2;
    duel.current = right ? { ...duel.current, right: y } : { ...duel.current, left: y };
    if (phase !== 'play') draw();
  };

  const start = (m = mode) => {
    setMode(m);
    duel.current = newDuel();
    setWon(null);
    setRecord(false);
    setPhase('play');
  };

  const text =
    won === null
      ? ''
      : mode === 'duo'
        ? won === 'left'
          ? t('games.paddle.leftWins')
          : t('games.paddle.rightWins')
        : won === 'left'
          ? t('games.paddle.youWin')
          : t('games.paddle.tabletWins');

  return (
    <div className="game paddle">
      <div className="game-bar">
        <div className="segmented small" role="tablist">
          {(['duo', 'solo'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'active' : ''}
              onClick={() => (setMode(m), setPhase('ready'))}
            >
              {t(`games.paddle.${m}`)}
            </button>
          ))}
        </div>
        <span className="game-spacer" />
        {mode === 'solo' && <span className="game-stat muted">{t('games.paddle.wins', { n: wins })}</span>}
      </div>
      <div
        className="game-stage paddle-stage"
        ref={wrapRef}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onClick={() => phase === 'ready' && start()}
      >
        <canvas
          ref={canvas}
          className="paddle-canvas"
          style={{ width: size.width, height: size.height }}
          aria-label={t('games.paddle.name')}
        />
        {phase === 'ready' && (
          <div className="paddle-start">
            <span>{t('games.paddle.tap')}</span>
            <small>{mode === 'duo' ? t('games.paddle.hint') : t('games.paddle.hintSolo')}</small>
          </div>
        )}
        {phase === 'over' && (
          <Result
            won={mode === 'duo' || won === 'left'}
            title={text}
            text={`${final[0]} : ${final[1]}`}
            record={record}
            onAgain={() => start()}
          />
        )}
      </div>
    </div>
  );
}
