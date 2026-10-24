// The stickman rig, its named poses and pose arithmetic.
//
// The rig is the app's default "Walker" figure (src/demo.mjs), optionally with
// eyes. Joint angles are absolute screen angles in degrees: 0 points right, 90
// down, -90 up and 180 left. "right" and "left" name the side of the screen a
// limb is on in the rest pose, so a figure facing right swings its "right" leg
// forward. Poses face right; `flip` mirrors a pose to face left.

export const JOINTS = Object.freeze([
  'torso', 'head',
  'rightUpperArm', 'rightForearm', 'leftUpperArm', 'leftForearm',
  'rightThigh', 'rightShin', 'leftThigh', 'leftShin',
]);

// Each joint's parent bone; the torso and thighs hang from the hip.
const PARENT = Object.freeze({
  torso: null, head: 'torso', rightUpperArm: 'torso', rightForearm: 'rightUpperArm',
  leftUpperArm: 'torso', leftForearm: 'leftUpperArm', rightThigh: null, rightShin: 'rightThigh',
  leftThigh: null, leftShin: 'leftThigh',
});

/** Handles that `attach` can name: the end of a bone, plus friendly names for hands, feet and the hip. */
export const HANDLES = Object.freeze({
  hip: 0, neck: 1, headTop: 2, rightHand: 4, leftHand: 6, rightFoot: 8, leftFoot: 10,
  ...Object.fromEntries(JOINTS.map((joint, index) => [joint, index + 1])),
});

const pose = (torso, head, rua, rfa, lua, lfa, rth, rsh, lth, lsh) => Object.freeze({
  torso, head, rightUpperArm: rua, rightForearm: rfa, leftUpperArm: lua, leftForearm: lfa,
  rightThigh: rth, rightShin: rsh, leftThigh: lth, leftShin: lsh,
});

// Directional poses face right; flip them to face left.
export const POSES = Object.freeze({
  rest:           pose(-90, -90,  60,  76, 116,  95,  64,  87, 115,  96),
  stand:          pose(-90, -90,  78,  86, 102,  94,  84,  90,  96,  90),
  hands_on_hips:  pose(-90, -90,  40, 140, 140,  40,  80,  90, 100,  90),
  arms_crossed:   pose(-90, -90, 120, -10,  60, 190,  84,  90,  96,  90),
  wave_a:         pose(-90, -90, -25, -95, 102,  94,  84,  90,  96,  90),
  wave_b:         pose(-90, -90, -25, -45, 102,  94,  84,  90,  96,  90),
  point:          pose(-88, -88,   0,  -5, 105,  95,  80,  90, 100,  90),
  talk_a:         pose(-89, -88,  70,  15, 104,  96,  84,  90,  96,  90),
  talk_b:         pose(-89, -92,  80,  -5, 110, 160,  84,  90,  96,  90),
  nod:            pose(-88, -68,  78,  86, 102,  94,  84,  90,  96,  90),
  look_up:        pose(-93,-118,  80,  88, 100,  92,  84,  90,  96,  90),
  look_down:      pose(-86, -62,  80,  88, 100,  92,  84,  90,  96,  90),
  arms_up:        pose(-90, -90, -50, -65, 230, 245,  72,  82, 108,  98),
  shrug:          pose(-90, -84,  35, -40, 145, 220,  84,  90,  96,  90),
  think:          pose(-90, -82, 115, -75, 135,  45,  84,  90,  96,  90),
  facepalm:       pose(-95,-110, 130,-105, 105,  95,  84,  90,  96,  90),
  sad:            pose(-96, -55,  88,  90,  94,  92,  86,  90,  94,  90),
  angry:          pose(-82, -76,  40, 140, 140,  40,  74,  90, 106,  90),
  laugh:          pose(-102,-118, 115,  15,  65, 165,  80,  90, 100,  90),
  surprised:      pose(-92, -92,  20, -60, 160, 240,  75,  88, 105,  92),
  reach:          pose(-82, -80, -20, -25, 108,  96,  76,  92, 100,  90),
  hold_out:       pose(-88, -86,  12,   0,  22,   5,  84,  90,  96,  90),
  push:           pose(-70, -72,   5,   0,  15,   0,  60,  80, 125, 105),
  knock_a:        pose(-88, -88,  20, -80, 102,  94,  84,  90,  96,  90),
  knock_b:        pose(-88, -88,  20, -35, 102,  94,  84,  90,  96,  90),
  pick_up:        pose(-35, -25,  80,  88,  95, 100,  70, 100, 100,  98),
  bow:            pose(-45, -35,  88,  92,  92,  90,  86,  90,  94,  90),
  kneel:          pose(-90, -88,  78,  86, 102,  94,   0,  90, 100, 175),
  walk_contact_a: pose(-86, -86, 115, 105,  62,  45,  60,  78, 120, 102),
  walk_pass_a:    pose(-86, -86,  95,  85,  85,  70,  72, 115,  90,  90),
  walk_contact_b: pose(-86, -86,  62,  45, 115, 105, 120, 102,  60,  78),
  walk_pass_b:    pose(-86, -86,  85,  70,  95,  85,  90,  90,  72, 115),
  run_a:          pose(-68, -68, 150, 100,  25, -50,  25,  85, 135, 175),
  run_b:          pose(-68, -68,  25, -50, 150, 100, 135, 175,  25,  85),
  crouch:         pose(-80, -80,  65,  25, 115, 155,  25, 110, 155,  70),
  jump:           pose(-90, -90, -55, -70, 235, 250,  55, 115, 125,  65),
  sit:            pose(-95, -90,  75,  15, 105,  20,   0,  90,  10,  95),
  punch:          pose(-82, -82,   0,   0, 120, -40,  60,  82, 125, 100),
  kick:           pose(-115,-110, 150, 100, 200, 120, -15, -15, 100,  95),
  fall_back:      pose(-135,-150, 200, 230, 240, 260,  40,  70,  20,  50),
  lie:            pose( 180, 180, 170, 175, 185, 180,   0,   0,   5,   0),
});

export const WALK_CYCLE = Object.freeze(['walk_contact_a', 'walk_pass_a', 'walk_contact_b', 'walk_pass_b']);
export const RUN_CYCLE = Object.freeze(['run_a', 'run_b']);

const relative = angles => Object.fromEntries(JOINTS.map(joint => [joint, angles[joint] - (PARENT[joint] ? angles[PARENT[joint]] : 0)]));
function absolute(rel) {
  const angles = {};
  for (const joint of JOINTS) angles[joint] = rel[joint] + (PARENT[joint] ? angles[PARENT[joint]] : 0);
  return angles;
}
function checkJoints(map, label) {
  for (const [joint, value] of Object.entries(map ?? {})) {
    if (!JOINTS.includes(joint)) throw new Error(`Unknown joint "${joint}" in ${label}. Joints: ${JOINTS.join(', ')}`);
    if (!Number.isFinite(value)) throw new Error(`${label}.${joint} needs a number of degrees`);
  }
}

/**
 * The unflipped joint angles in degrees for a change, starting from a library pose or, without one, from the
 * previous angles. Order: pose, `joints` (absolute), `bend` (relative to the parent bone), `turn` (rotate a
 * joint and everything hanging from it), `lean` (the upper body).
 */
export function resolveAngles({pose: name, joints, bend, turn, lean = 0} = {}, previous = null) {
  let base;
  if (name === undefined || name === null) base = previous ?? POSES.stand;
  else if (!(base = POSES[name])) throw new Error(`Unknown pose "${name}". Known poses: ${Object.keys(POSES).join(', ')}`);
  checkJoints(joints, 'joints'); checkJoints(bend, 'bend'); checkJoints(turn, 'turn');
  const rel = relative({...base, ...joints});
  for (const [joint, value] of Object.entries(bend ?? {})) rel[joint] = value;
  for (const [joint, value] of Object.entries(turn ?? {})) rel[joint] += value;
  if (lean) rel.torso += lean;
  return absolute(rel);
}

// Eyes sit on a 20 px circle around the top of the head, in the rest pose (head pointing up).
const EYE_REACH = 20, EYE_RADIUS = 3.5;
const EYE_ANGLES = Object.freeze({front: [70, 110], side: [55, 55]});

/** Adds two eyes to a stickman definition: an invisible static anchor and a dot for each. */
export function addEyes(figure, color) {
  const dot = (id, parent) => ({segment_id: id, parent_id: parent, length: 2 * EYE_RADIUS, angle_rad: -Math.PI / 2, thickness: 0,
    bend_rad: 0, primitive_code: 3, aux_code: 1, flags: 259, is_static: true, segment_type: 'circle', segment_kind: 'circleFill',
    color_rgb: [...color], transparency: 0, visible: true, z_order: id});
  const anchor = (id, degrees) => ({...dot(id, 2), length: EYE_REACH, angle_rad: degrees * Math.PI / 180, thickness: 1,
    primitive_code: 0, flags: 256, segment_type: 'line', segment_kind: 'line', visible: false});
  const [a, b] = EYE_ANGLES.front;
  figure.segments.push(anchor(11, a), dot(12, 11), anchor(13, b), dot(14, 13));
  figure.segment_count = figure.segments.length;
  return figure;
}

/** Every segment's absolute angle in radians, mirrored when flipped. `face` places the eyes: front or side. */
export function segmentAngles(figure, angles, {flip = false, face = 'side'} = {}) {
  const head = angles.head, eyes = EYE_ANGLES[face] ?? EYE_ANGLES.side;
  const degrees = figure.segments.map((segment, index) => {
    if (index < JOINTS.length) return angles[JOINTS[index]];
    // Eye anchors turn with the head; the dots are circles, so their angle only sets which way they are drawn.
    if (segment.segment_id === 11) return head + 90 + eyes[0];
    if (segment.segment_id === 13) return head + 90 + eyes[1];
    return segment.angle_rad * 180 / Math.PI;
  });
  return degrees.map(value => (flip ? 180 - value : value) * Math.PI / 180);
}

/** World positions of every handle for a placement: handle id → {x, y}. */
export function handlePositions(figure, radians, root, scale = 1) {
  const ends = new Map([[0, root]]);
  figure.segments.forEach((segment, index) => {
    const start = ends.get(segment.parent_id) ?? root, angle = radians[index];
    ends.set(segment.segment_id, {x: start.x + segment.length * scale * Math.cos(angle), y: start.y + segment.length * scale * Math.sin(angle)});
  });
  return ends;
}

/** The lowest point the figure reaches below its root (the hip), in canvas pixels before scale. */
export function lowestPoint(figure, radians) {
  const ends = handlePositions(figure, radians, {x: 0, y: 0});
  return Math.max(0, ...figure.segments.map(segment => ends.get(segment.segment_id).y + segment.thickness / 2));
}

/** How far the hip travels per keyframe of a walk or run cycle: half the distance between the feet. */
export function cycleAdvance(figure, poseName, scale = 1) {
  const ends = handlePositions(figure, segmentAngles(figure, POSES[poseName]), {x: 0, y: 0}, scale);
  return Math.abs(ends.get(HANDLES.rightFoot).x - ends.get(HANDLES.leftFoot).x) / 2;
}
