import {HANDLES, JOINTS, POSES} from './rig.mjs';
import {EASINGS} from './easing.mjs';

export const GUIDE = `# Writing a StykAnimate animation spec

Workflow: build_animation → preview_frames (look, fix, rebuild) → export_video {preset:"shorts"} → save_project.

## Canvas and time
- Default canvas 540×960 (vertical 9:16). Export preset "shorts" scales it to 1080×1920 without loss (vectors).
- Coordinates are canvas pixels; x grows right, y grows DOWN. Centre of the default canvas is (270, 480).
- fps defaults to 24. A keyframe's "hold" is the number of frames spent MOVING to the next keyframe (12 = 0.5 s):
  figures start changing as soon as they arrive. To pause on a pose, add "still": frames to stay put first.
  The last keyframe holds for its own "hold". Total length = sum of holds and stills.
- Motion between keyframes tweens automatically ("ease": ${Object.keys(EASINGS).join(', ')}; default auto).
  Use "constant" for an instant cut, "ease-out" for a snappy arrival.

## Cast
Declare every figure once in "cast"; keyframes then say where each one is. Later members draw on top.
- stickman: color, thickness (weight multiplier), headColor, headFilled, eyes (true draws eyes; see face),
  eyeColor. About 250 px tall at scale 1 (hip to head top ≈ 122 px, hip to feet ≈ 125 px); scale 1.2–1.3 suits 540×960.
- rect: width, height, color. Placed by its centre, square corners: walls, floors, doors, windows, boxes, bags.
- line: length, thickness, color. Placed by its start point; thick lines have round ends.
- circle: radius, color, filled (default true). Placed by its centre.
- text: text, fontSize, bold, italic, align, color, outline, outlineColor. Placed by its centre.
  Text cannot change; use one cast member per caption and hide/show them.
- file: path to a Pivot .stk figure (e.g. from the community library); placed by its root.

## Keyframes
"figures" maps a cast id to changes. Anything left out carries over from the previous keyframe (including
opacity, flip, face and attach), so a keyframe only lists what changes. A figure appears from the first keyframe
that names it; {"hide": true} removes it.
- x, y, scale, rotate (non-stickmen), opacity, flip (face left; carries over), hide.
- ground: stand the stickman on this y (feet on the floor whatever the pose). Use the floor's top edge.
- pose: a library pose (below). Poses face RIGHT; flip mirrors them.
- joints: absolute angles in degrees over the pose: 0 = right, 90 = down, -90 = up, 180 = left.
  Joints: ${JOINTS.join(', ')}. "right"/"left" = screen side in the rest pose.
- bend: angle relative to the parent bone, and the bones below follow (forward kinematics). 0 = straight on.
  {"rightForearm": -90} bends the elbow up 90°; {"leftShin": 60} bends the knee. Best for elbows, knees, head.
- turn: rotate a joint by this many degrees, carrying its children: {"rightUpperArm": -40} lifts the whole arm.
- lean: tilt the upper body forward (positive) or back (negative).
- face: "front" (two eyes, looking at the viewer) or "side" (one eye toward the facing side). Needs eyes.
- overshoot: 0.15–0.3 swings past the new pose and settles back over "settle" frames (default 4). Use it on
  arrivals: arms thrown up, a turn, a stop. Other figures keep moving smoothly through the settle.
- attach: {"to": "bob", "at": "rightHand"} holds this figure on that handle every frame, so props never drift.
  Handles: ${Object.keys(HANDLES).join(', ')}. A tall rect hangs from its top centre (a bag); a circle sits on
  the handle (a ball); a line starts there (a stick). {"attach": null, "x": .., "y": ..} puts it down.
  Hide or detach a prop before its holder is hidden.
- arc: arrive at this keyframe along a gravity parabola peaking this many px above the higher end (0 = a fall).
  The keyframe before is the take-off and its hold is the flight time; physics_plan computes both for jumps,
  tosses, drops and bounces. Works on y (props) and ground (a jumping stickman).
- camera (per keyframe, carries over): {x, y, zoom, rotate}; x/y is the canvas point at the centre of the shot.
  zoom 1.3 = closer. Tweens like figures. Reset with {"x":270,"y":480,"zoom":1}.
- background: a hex colour from this keyframe on.

## Walking and running
{"walk": {"figure": "bob", "to": 420}} replaces hand-made walk keys: it expands into a stride-matched cycle
(feet don't slide), faces the way it goes, looks sideways, and ends on a stand that lasts the keyframe's
"hold" (default 6). Options: run (true for a run cycle), step (frames per pose: 5 walking, 4 running; 6–7 is a
stroll), stop (false to keep going into the next keyframe), joints/bend/turn kept on every step (e.g.
{"rightUpperArm": 80, "rightForearm": 88} for an arm carrying a bag), face. Changes for other figures go in
the same keyframe's "figures" and apply at the first step.

## Pose library
${Object.keys(POSES).join(', ')}

## Making it feel natural
The prompts natural-motion and physics (the skills stykanimate-natural-motion and stykanimate-physics) hold
the full guidance; the short version:
- Anticipate: before a big action, a small opposite move (crouch before jump, lean back before a throw), 4–6 frames.
- Arrive with overshoot 0.2 on big gestures; never on tiny ones.
- Let key poses read: "still" 8–14 frames on important poses, and before a fade or a cut. Keep tiny moves
  (talk_a ↔ talk_b, nod) going while a figure speaks.
- Overlap: let figures react a few frames after each other, not all on the same keyframe.
- Reading time: captions stay ~0.4 s per word, at least 1.2 s. Keep text inside the shot, and on Shorts away
  from the bottom 20% and the right edge (interface buttons).
- Contrast: props must differ in colour from what is behind them.
- Talking: alternate talk_a/talk_b every 6–8 frames, face "front" for the viewer, "side" toward another figure.
- Jump: crouch (6) → jump with ground 80–120 px higher (8, ease-out) → crouch (5) → stand with overshoot.
- Use cuts (ease "constant", and reset the camera) between places rather than walking across empty space.

## Audio
"audio": [{"path": "/abs/voice.mp3", "start": 0}] adds voiceover or music; the animation is lengthened to the
end of the audio unless "extendToAudio": false. At 24 fps, seconds × 24 = frames.

## Example
{"title":"Hi","background":"#f4f1ea",
 "cast":[{"id":"floor","kind":"rect","width":540,"height":200,"color":"#9bd17c"},
         {"id":"bob","kind":"stickman","eyes":true},{"id":"bag","kind":"rect","width":40,"height":52,"color":"#e9c79a"},
         {"id":"cap","kind":"text","text":"Hello!","fontSize":64,"bold":true,"color":"#1c7ed6"}],
 "keyframes":[
  {"hold":12,"figures":{"floor":{"x":270,"y":860},"bob":{"x":80,"ground":760,"pose":"stand","scale":1.3,"face":"front"},
                        "bag":{"attach":{"to":"bob","at":"rightHand"}}}},
  {"walk":{"figure":"bob","to":300,"joints":{"rightUpperArm":80,"rightForearm":88}},"hold":8},
  {"hold":6,"figures":{"bob":{"pose":"wave_a","face":"front"},"cap":{"x":270,"y":300}}},
  {"hold":14,"figures":{"bob":{"pose":"arms_up","overshoot":0.2}},"camera":{"x":280,"y":600,"zoom":1.3}}]}
`;
