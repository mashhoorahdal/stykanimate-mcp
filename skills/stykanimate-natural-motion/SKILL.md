---
name: stykanimate-natural-motion
description: Make StykAnimate stick figures move and act like real people when building animations with the stykanimate MCP tools (build_animation, preview_frames, export_video). Use it whenever you animate characters with StykAnimate — a YouTube Short, a story, a script, a gag, a tutorial — including walking, talking, reacting, gesturing, picking things up, handing objects over, sitting or turning around, even when the request is just "make a video of a man who…" or "animate this script".
---

# Natural, human-like motion in StykAnimate

People believe a stick figure when it moves the way a body does: weight shifts before a step, a hand pulls
back before it points, the head arrives a beat after the body, and nothing ever stops dead. The
stykanimate MCP gives you the controls for all of this; this skill is about using them so the result
reads as acting rather than poses sliding into each other. For gravity, jumps, throws and bounces, also
use the **stykanimate-physics** skill.

Call `stykanimate_guide` once before your first spec: it is the reference for every field used below.

## Workflow

1. **Beat sheet first.** Write the story as beats with a duration each (at 24 fps, seconds × 24 =
   frames): who does what, what the viewer should feel, and any caption. A Short of 20–40 s is usually
   8–15 beats. Decide the shots (cuts and camera pushes) here, not later.
2. **Block the storytelling poses.** One clear pose per beat, held with `still` long enough to read
   (8–14 frames; longer for a punchline). If you squint at the pose and can't tell what is happening,
   change it: arms away from the torso, a clear lean, the face turned (`face`) where the attention is.
3. **Add the motion between poses**: anticipation, overshoot, overlap and timing (below).
4. **Build and look.** `build_animation`, then `preview_frames` at the frames that matter — the middle of
   each action and a few frames after each arrival, not just evenly spaced frames. Check the list at the
   end of this skill, fix, rebuild. Two or three rounds is normal.
5. **Export** with `export_video` (`preset: "shorts"` for a vertical Short) and `save_project` so the
   `.styk` can be polished by hand.

## How a keyframe's time works

`hold` is the time spent **moving** to the next keyframe — a figure starts changing the moment it
arrives. To pause on a pose, add `still` (frames to stay put first). Forgetting this is the most common
reason motion looks rushed or a fade starts too early. Everything a keyframe doesn't mention carries
over, including `opacity`, `flip`, `face`, `attach` and the camera.

## Timing (frames at 24 fps)

| Action | Frames | Notes |
| --- | --- | --- |
| Quick gesture, snap of the head | 4–6 | |
| Ordinary gesture, reach, turn of the head | 8–12 | |
| Big full-body move (sit, stand, bow) | 16–24 | lean first |
| Hold a pose so it reads | `still` 8–14 | punchline or emotional beat: 18–30 |
| Reaction after its cause | 3–6 frames later | instant reactions look mechanical |
| Walk step (`walk.step`) | 5 normal, 4 brisk, 6–7 stroll or tired | |
| Run step | 3–4 | |
| Talking gesture swap | 6–8 | small, alternating |
| Caption on screen | 0.4 s per word, at least 30 frames | |
| Nobody fully frozen | longer than ~36 frames | add a breath or weight shift |

Fast is light and urgent; slow is heavy, tired or sad. Vary timing: equal holds everywhere feel robotic.

## The principles, mapped to the spec

- **Anticipation**: before every big action, a small move the opposite way, 4–6 frames. Pull the arm
  back (`turn: {"rightUpperArm": 25}`) before pointing; lean back (`lean: -8`) before throwing; crouch
  before jumping; lean forward (`lean: 6`) before the first step of a walk.
- **Slow in and slow out**: the default `ease: "auto"` already eases. Use `"ease-out"` for snappy
  arrivals and `"ease-in"` for departures and things starting to fall; keep `"linear"` for cycles and
  machines. `"constant"` is a cut.
- **Overshoot and settle**: big gestures arrive past the pose and come back — `overshoot: 0.15–0.3` on
  waves, points, arms thrown up, stopping after a walk or run. Not on tiny moves (it looks jittery).
- **Overlap and follow-through**: body parts don't stop together. Let the hips and torso arrive on one
  keyframe, then the head and hands finish 2–4 frames later with a small `bend` or `turn` on the next
  keyframe. Lead with the body, then the head, then the hands.
- **Arcs**: joints already swing in arcs. Keep big moves going *through* a pose rather than straight to
  it: a breakdown keyframe halfway (e.g. the arm raised higher than both ends) turns a slide into a swing.
- **Secondary action and life**: while someone listens, nod every 24–36 frames; while someone waits,
  shift weight (`stand` ↔ `rest`, or `lean` ±3) over 24–36 frames. Breathing is a tiny `lean` of 1–2.
- **Staging**: one important action at a time. Others keep small idle motion but don't compete. Turn
  characters toward each other (`face: "side"`, `flip`) when they talk, toward the viewer
  (`face: "front"`) when they address the audience or react big.
- **Exaggeration**: push key poses a little further than real life (a deeper lean, higher arms); the
  small figures on a phone screen need it.

## Acting recipes

- **Talking**: alternate `talk_a` / `talk_b` every 6–8 frames, add a `nod` on stressed words, and
  `point` or `hold_out` for the important line. The listener nods and keeps `face: "side"`.
- **Thinking**: `think` with `still` 12, then `look_up`; for an idea, `point` with overshoot 0.25.
- **Surprise**: a 3-frame lean back (`lean: -10`), then `surprised` with `overshoot: 0.25`, `still` 10.
- **Sad / tired**: `sad` or `look_down`, slow holds (18+), walk `step` 7, no overshoot.
- **Angry**: `angry` with a forward lean, quick small moves (4–6 frames), `overshoot` 0.15.
- **Happy**: `arms_up` with `overshoot` 0.25, or a small jump (physics skill).
- **Waving**: `wave_a` with overshoot 0.2, then `wave_b` / `wave_a` every 6 frames, two or three times.
- **Knocking**: `knock_a` / `knock_b` every 4 frames, three knocks, then `still` 10 waiting.
- **Picking something up**: walk up, `pick_up` over 10–14 frames (`ease-in-out`), set `attach` on the
  keyframe where the hand reaches it, rise over 10 frames keeping the arm low (`joints` for a carry).
- **Handing over**: the giver reaches `hold_out` and holds (`still` 6); the receiver reaches to the same
  point; switch the prop's `attach` to the receiver on the keyframe where the hands meet; both settle.
- **Sitting down**: back to the seat, `sit` over 18 frames with `ease-in-out`, `overshoot` 0.1.
  **Standing up**: lean forward first (`lean: 25` on `sit`, 8 frames), then `stand` over 12 frames.
- **Turning around**: pass through the front view — `face: "front"` for 3–4 frames, then `flip` and
  `face: "side"`. A flip with no in-between pops.

## Walking and props

- Use `walk` keyframes; they keep the feet from sliding and face the direction of travel. Add a forward
  lean of 4–6 on brisk walks and `stop` with an `overshoot` of 0.1 on the stand.
- Arms carrying something don't swing: pass `joints` (e.g. `{"rightUpperArm": 80, "rightForearm": 88}`)
  to the walk so that arm stays down.
- Props live in hands with `attach`, so they never drift. Hide or detach a prop before its holder is
  hidden. Give props a colour that stands out from what is behind them.
- When something is thrown, dropped or bounces, use `physics_plan` (stykanimate-physics).

## Camera and shots for Shorts

- Cut between places (`ease: "constant"`), and reset the camera at each cut — it carries over otherwise.
- Push in (`zoom` 1.2–1.4) on the emotional beat, back out after; ease the move.
- Change something every 2–3 s: a cut, a push, a new action.
- Keep captions inside the shot (zoomed shots show less of the canvas) and away from the bottom fifth and
  the right edge, where the Shorts interface sits.

## Review checklist (look at the preview frames)

- Can you tell what each key pose means from its silhouette?
- Feet on the floor (`ground`), and no sliding during walks?
- Props in hands, visible against the background, never floating?
- Does every big move have anticipation before and a settle after?
- Do reactions come a few frames after their cause, not on the same frame?
- Is anyone frozen for more than ~1.5 s?
- Are the poses held long enough to read, and the captions long enough to read?
- During camera pushes, are the characters and captions fully in the shot?
- Did a fade, `flip` or camera move carry over somewhere you didn't intend?
