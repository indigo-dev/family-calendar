/* Paddle duel: two paddles, one ball. Field in units of 160 × 100; the canvas scales it. */

export const FIELD_W = 160;
export const FIELD_H = 100;
export const PADDLE_H = 20;
export const PADDLE_W = 2.6;
export const PADDLE_X = 6;
export const BALL_R = 1.8;
export const WIN_SCORE = 7;
const START_SPEED = 72;
const MAX_SPEED = 190;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Duel {
  ball: Ball;
  /** centre of the paddles */
  left: number;
  right: number;
  score: [number, number];
  /** seconds until the ball moves (after a point) */
  wait: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const clampPaddle = (y: number) => clamp(y, PADDLE_H / 2, FIELD_H - PADDLE_H / 2);

/** the ball in the middle, flying towards `dir` (1 = right) at a slight random angle */
export function serve(dir: 1 | -1, rnd = Math.random): Ball {
  const angle = (rnd() - 0.5) * 0.9;
  return { x: FIELD_W / 2, y: FIELD_H / 2, vx: Math.cos(angle) * START_SPEED * dir, vy: Math.sin(angle) * START_SPEED };
}

export const newDuel = (rnd = Math.random): Duel => ({
  ball: serve(rnd() < 0.5 ? 1 : -1, rnd),
  left: FIELD_H / 2,
  right: FIELD_H / 2,
  score: [0, 0],
  wait: 1,
});

export type DuelEvent = 'hit' | 'wall' | 'pointLeft' | 'pointRight' | null;

/** Moves the ball by `dt` seconds. The angle off a paddle depends on where the ball hits it. */
export function step(d: Duel, dt: number, rnd = Math.random): { duel: Duel; event: DuelEvent } {
  if (d.wait > 0) return { duel: { ...d, wait: Math.max(0, d.wait - dt) }, event: null };
  const b = { ...d.ball };
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  let event: DuelEvent = null;
  if (b.y < BALL_R || b.y > FIELD_H - BALL_R) {
    b.y = clamp(b.y, BALL_R, FIELD_H - BALL_R);
    b.vy = -b.vy;
    event = 'wall';
  }
  const hit = (paddleY: number, side: 1 | -1) => {
    const off = (b.y - paddleY) / (PADDLE_H / 2);
    if (Math.abs(off) > 1.15) return false;
    const speed = Math.min(MAX_SPEED, Math.hypot(b.vx, b.vy) * 1.06);
    const angle = clamp(off, -1, 1) * 1.0;
    b.vx = Math.cos(angle) * speed * side;
    b.vy = Math.sin(angle) * speed;
    return true;
  };
  if (b.vx < 0 && b.x - BALL_R <= PADDLE_X + PADDLE_W / 2 && b.x > PADDLE_X - PADDLE_W) {
    if (hit(d.left, 1)) {
      b.x = PADDLE_X + PADDLE_W / 2 + BALL_R;
      event = 'hit';
    }
  } else if (b.vx > 0 && b.x + BALL_R >= FIELD_W - PADDLE_X - PADDLE_W / 2 && b.x < FIELD_W - PADDLE_X + PADDLE_W) {
    if (hit(d.right, -1)) {
      b.x = FIELD_W - PADDLE_X - PADDLE_W / 2 - BALL_R;
      event = 'hit';
    }
  }
  if (b.x < -BALL_R * 2) {
    return { duel: { ...d, ball: serve(-1, rnd), score: [d.score[0], d.score[1] + 1], wait: 1 }, event: 'pointRight' };
  }
  if (b.x > FIELD_W + BALL_R * 2) {
    return { duel: { ...d, ball: serve(1, rnd), score: [d.score[0] + 1, d.score[1]], wait: 1 }, event: 'pointLeft' };
  }
  return { duel: { ...d, ball: b }, event };
}

/** the tablet's paddle: follows the ball with limited speed and a little lag, so it can be beaten */
export function aiMove(d: Duel, dt: number, skill = 0.75): number {
  const target = d.ball.vx > 0 ? d.ball.y : FIELD_H / 2;
  const maxStep = (55 + 50 * skill) * dt;
  return clampPaddle(d.right + clamp(target - d.right, -maxStep, maxStep));
}

export const winner = (d: Duel): 'left' | 'right' | null => (d.score[0] >= WIN_SCORE ? 'left' : d.score[1] >= WIN_SCORE ? 'right' : null);
