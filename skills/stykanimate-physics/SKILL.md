---
name: stykanimate-physics
description: Make StykAnimate animations obey physics — gravity, weight, momentum, balance and contact — with the stykanimate MCP tools (physics_plan, the arc keyframe field, build_animation). Use it for jumps, falls, trips, throws, catches, bouncing balls, dropped objects, carrying or pushing heavy things, running starts and stops, impacts, and whenever motion should feel grounded or realistic rather than floaty, even if the user just says "make it look real".
---

# Physics in StykAnimate

Viewers judge weight and gravity from timing and spacing alone. Gravity has one fixed rhythm: something
in the air slows to a hang at the top and speeds up on the way down, and the higher it goes, the longer
it stays up — in a predictable way. Get that rhythm wrong and everything looks floaty or weightless. This
skill uses two tools that do the maths for you, plus the rules a body follows when it pushes, carries,
lands and balances. Combine it with **stykanimate-natural-motion** for acting and timing.

## The tools

- **`arc`** (a keyframe field): the figure travels *into* this keyframe along a gravity parabola that
  peaks `arc` pixels above the higher of its start and end positions; `arc: 0` is a fall from rest. The
  keyframe before it is the take-off, and that keyframe's `hold` is the time in the air. The compiler
  samples the curve every two frames, and every other figure keeps moving evenly through it. Works on
  `y` (props) and on `ground` (a jumping stickman's feet).
- **`physics_plan`**: returns ready-made keyframes with gravity-correct holds and arcs for
  - `jump` — crouch (anticipation), push off, flight, landing crouch (absorbs the impact), recover with
    overshoot;
  - `toss` — a prop leaves the hand (`attach: null`) and lands at a point, with optional `spin`;
  - `drop` — a fall from rest;
  - `bounce` — falls and bounces, each bounce lower (`restitution`), with optional sideways `drift`.

  Pass `scale` (the stickmen's scale, default 1.2): it sets how strong gravity is, so that a 60 px jump
  of a 300 px tall figure takes as long as a real 35 cm jump.

Paste the returned keyframes into your spec in order. Other figures' changes go into those keyframes'
`figures`; don't add keyframes between a take-off and its `arc` landing, because the arc starts from the
keyframe right before it.

Reference at scale 1.2 (1 m ≈ 171 px, 24 fps):

| Height of the arc | Up and down | Fall only |
| --- | --- | --- |
| 15 px (hop) | 6 frames | 3 |
| 30 px | 9 | 5 |
| 60 px (jump) | 13 | 6 |
| 120 px | 18 | 9 |
| 200 px (big leap or high toss) | 23 | 12 |
| 600 px drop | — | 20 |

## Rules a body follows

1. **Gravity.** Vertical motion through the air is never linear and never eased both ways: use `arc`.
   Rising slows, falling speeds up, and most of the time is spent near the top. A fall that should feel
   heavy is just a longer drop, not a slower one.
2. **Weight.** Heavy things take longer to start and to stop. Light object: lift in ~8 frames with no
   strain. Heavy object: lean back (`lean: -8`) with bent knees (`bend` on the shins), held (`still` 8–12) before it moves, lift
   over 18–24 frames, carry with a backward lean, shorter steps (`walk.step` 6–7) and the carrying arm
   straight. Pushing something heavy: lean forward 25–35°, `push`, short slow steps.
3. **Momentum.** Moving things keep moving. Starting a run: lean into it (`lean: 15`) before the feet go.
   Stopping: the body overshoots forward (`overshoot: 0.3` on the stand, `lean` forward for a few frames)
   and settles back. Turning while running: lean into the turn.
4. **Balance.** The body's weight sits over the supporting foot. A forward lean needs a foot forward; a
   long reach is balanced by the other arm or leg going back. If a pose would fall over, it reads as
   wrong even when nobody can say why.
5. **Contact.** Feet stay on the floor (`ground`) unless the figure is in the air; landings absorb the
   impact with a crouch (2–4 frames down, 6 back up). Props resting on a surface sit on it: a
   rectangle's centre is half its height above the surface, a circle's centre one radius above.
6. **Action and reaction.** Throwing pushes the thrower back slightly (`lean: -5` on the release).
   Catching moves the hands back with the object for 3–4 frames. A hit target reacts 1–2 frames after
   contact and moves away from the hit, faster the harder it was.
7. **Bounce and material.** Restitution says how much a bounce keeps: rubber 0.75–0.85, ball 0.55–0.7,
   bag or beanbag 0.1–0.2 (a thud), a person landing 0 (absorbed by the legs). `physics_plan bounce`
   does the shrinking heights and quickening rhythm for you.
8. **Air resistance.** Light, flat things (paper, a leaf, a feather) don't follow gravity's arc: drift
   them down with `ease-in` over a long hold and sway them with `rotate` ±15° alternating every 8–12
   frames instead of using `drop`.

## Recipes

- **Jump onto a box**: `physics_plan jump` with `height` = box top − floor + 20–30 px of clearance and
  `distance` to the box; on the landing keyframe use the box top as `ground`.
- **Throw and catch between two people**: the thrower winds up (`lean: -8`, arm back) and releases on the
  `toss` release keyframe with a forward follow-through; land the toss at the catcher's hand, have the
  catcher's `reach` arrive 2 frames earlier, set `attach` to the catcher on the landing keyframe, and pull
  the catcher's hands back a little over the next 4 frames.
- **Dropping the shopping**: `physics_plan drop` for the bag, then `bounce` with `restitution: 0.15` and a
  couple of items bouncing higher (0.6) with some `drift`.
- **Tripping**: the foot stops, the body keeps going: lean 30 forward over 4 frames, a fast catch step,
  and either recover with overshoot or fall (`fall_back` from behind, or a forward drop into `lie`).
- **Falling over**: `fall_back` over 6–8 frames with `ease-in` (gravity takes over), a small rebound with
  `overshoot: 0.15` on `lie`, then stay still — something that just fell doesn't move straight away.
- **Bouncing ball in the background**: `physics_plan bounce` with `drift` for a ball rolling away.

## Checking it

Preview the frames of a flight every 2–3 frames (`preview_frames` with explicit `frames`). The spacing
should bunch up near the top and spread out near the floor; landings should show the crouch; nothing
should hang still in the air or speed up on the way up. When a jump or toss feels slow, lower the height
rather than shortening the hold — the hold is what gravity says it is.
