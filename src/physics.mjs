// Physically timed keyframes for jumps, throws, drops and bounces. Gravity is scaled from the figures'
// size: a stickman at scale 1 is about 250 px tall, so with a 1.75 m person one metre is 250 / 1.75 px.
// The keyframes use `arc` for the airborne part, so the compiler draws a true parabola while everything
// else on stage keeps moving.

const STICKMAN_HEIGHT_PX = 250, PERSON_HEIGHT_M = 1.75, EARTH_GRAVITY = 9.81;

/** Gravity in pixels per second squared for figures drawn at `scale`. */
export const gravity = (scale = 1.2) => EARTH_GRAVITY * STICKMAN_HEIGHT_PX * scale / PERSON_HEIGHT_M;

/** Frames to rise `up` pixels and fall `down` pixels under gravity (at least 2). */
export function flightFrames(up, down, {scale = 1.2, fps = 24} = {}) {
  const g = gravity(scale), seconds = Math.sqrt(2 * Math.max(0, up) / g) + Math.sqrt(2 * Math.max(0, down) / g);
  return Math.max(2, Math.round(seconds * fps));
}

const need = (value, label) => { if (!Number.isFinite(value)) throw new Error(`${label} is required and must be a number`); return value; };

/** Crouch, push off, fly along an arc, land absorbing the impact, recover. */
export function jump({figure, x, ground, height = 60, distance = 0, scale = 1.2, fps = 24, flip}) {
  need(x, 'x'); need(ground, 'ground');
  const air = flightFrames(height, height, {scale, fps});
  return {frames: 3 + air + 6 + 6, airFrames: air, keyframes: [
    {hold: 3, figures: {[figure]: {x, ground, pose: 'crouch', ...(flip === undefined ? {} : {flip})}}},
    {hold: air, figures: {[figure]: {pose: 'jump'}}},
    {hold: 6, figures: {[figure]: {x: x + distance, ground, pose: 'crouch', arc: height}}},
    {hold: 6, figures: {[figure]: {pose: 'stand', overshoot: 0.15}}},
  ], notes: `Reach the crouch over 5–8 frames from the keyframe before (that is anticipation). ${air} frames in the air for a ${height}px jump at scale ${scale}.`};
}

/** Let go of a prop at `from` and land it at `to`, peaking `peak` px above the higher end. */
export function toss({figure, from, to, peak = 80, spin = 0, scale = 1.2, fps = 24}) {
  need(from?.x, 'from.x'); need(from?.y, 'from.y'); need(to?.x, 'to.x'); need(to?.y, 'to.y');
  const apex = Math.min(from.y, to.y) - peak, air = flightFrames(from.y - apex, to.y - apex, {scale, fps});
  return {frames: air + 6, airFrames: air, keyframes: [
    {hold: air, figures: {[figure]: {attach: null, x: from.x, y: from.y, rotate: 0}}},
    {hold: 6, figures: {[figure]: {x: to.x, y: to.y, arc: peak, rotate: spin}}},
  ], notes: `Release from the thrower's hand position. ${air} frames of flight; start the throwing arm's follow-through on the release keyframe.`};
}

/** Fall from rest at `from` to `to` (both y), speeding up all the way. */
export function drop({figure, x, from, to, scale = 1.2, fps = 24}) {
  need(x, 'x'); need(from, 'from'); need(to, 'to');
  const air = flightFrames(0, to - from, {scale, fps});
  return {frames: air + 6, airFrames: air, keyframes: [
    {hold: air, figures: {[figure]: {attach: null, x, y: from}}},
    {hold: 6, figures: {[figure]: {x, y: to, arc: 0}}},
  ], notes: `${air} frames to fall ${to - from}px.`};
}

/** Drop from `y` and bounce on `rest` (the centre's y when touching the floor), losing energy each time. */
export function bounce({figure, x, y, rest, restitution = 0.55, bounces = 4, drift = 0, scale = 1.2, fps = 24}) {
  need(x, 'x'); need(y, 'y'); need(rest, 'rest');
  if (!(restitution > 0 && restitution < 1)) throw new Error('restitution must be between 0 and 1 (0.5–0.7 for a ball)');
  const keyframes = [], fall = flightFrames(0, rest - y, {scale, fps});
  keyframes.push({hold: fall, figures: {[figure]: {attach: null, x, y}}});
  let height = rest - y, position = x, hop = 0;
  // Each bounce keeps restitution² of the height: speed scales by the restitution, height by its square.
  for (let i = 0; i < bounces; i++) {
    const next = height * restitution ** 2;
    if (next < 3) break;
    const air = flightFrames(next, next, {scale, fps});
    keyframes.push({hold: air, figures: {[figure]: {x: position, y: rest, arc: hop}}});
    position += drift; hop = Math.round(next * 10) / 10; height = next;
  }
  keyframes.push({hold: 8, figures: {[figure]: {x: position, y: rest, arc: hop}}});
  return {frames: keyframes.reduce((sum, key) => sum + key.hold, 0), keyframes,
    notes: `Each contact keyframe lands the ${figure} on the floor; the arc on it is the height of the hop that ends there.`};
}

export const PHYSICS = Object.freeze({jump, toss, drop, bounce});
