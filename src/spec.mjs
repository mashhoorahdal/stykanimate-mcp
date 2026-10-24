// Compiles an animation spec (a cast and a list of keyframes) into a native
// StykAnimate document, using the app's own document factories so the result
// is the same data the editor creates and opens.
import {appModules} from './app.mjs';
import {EASINGS} from './easing.mjs';
import {HANDLES, JOINTS, POSES, RUN_CYCLE, WALK_CYCLE, addEyes, cycleAdvance, handlePositions, lowestPoint, resolveAngles, segmentAngles} from './rig.mjs';

const {demo: {defaultFigure, createObject, createFrame, emptyDocument}, model: {validateScene}} = await appModules();

export {EASINGS};

export function parseColor(value, label = 'color') {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? ''));
  if (!match) throw new Error(`${label} must be a hex colour such as "#2b2b2b"`);
  const hex = match[1].length === 3 ? [...match[1]].map(digit => digit + digit).join('') : match[1];
  const rgb = Number.parseInt(hex, 16);
  return [rgb >> 16 & 255, rgb >> 8 & 255, rgb & 255];
}

const radians = degrees => degrees * Math.PI / 180;
const staticSegment = {aux_code: 1, flags: 256, is_static: true};
const segment = (length, angle, thickness, extra = {}) => ({
  segment_id: 1, parent_id: 0, length, angle_rad: angle, thickness, bend_rad: 0, primitive_code: 0, aux_code: 0,
  flags: 0, segment_type: 'line', segment_kind: 'line', color_rgb: [43, 43, 43], transparency: 0, visible: true, z_order: 1, ...extra,
});
const definition = (figure_type_id, name, segments) =>
  ({figure_type_id, name, segment_count: segments.length, segments, polyfills: [], image_assets: [], text_assets: []});

/** The offset from a rectangle's centre to its root (the start of its line), before scale and rotation. */
const rectAnchor = figure => {
  const {length, angle_rad} = figure.segments[0];
  return angle_rad ? {x: 0, y: -length / 2} : {x: -length / 2, y: 0};
};

/** A figure definition for one cast member; text and file figures come from `external`. */
function castDefinition(member, typeId, external) {
  const color = parseColor(member.color ?? '#2b2b2b', `${member.id}.color`);
  switch (member.kind) {
    case 'stickman': {
      const figure = defaultFigure(typeId), thickness = member.thickness ?? 1, head = member.headColor ? parseColor(member.headColor, `${member.id}.headColor`) : color;
      figure.name = member.id;
      for (const part of figure.segments) {
        part.color_rgb = part.segment_id === 2 ? [...head] : [...color];
        part.thickness = Math.max(1, Math.round(part.thickness * thickness));
      }
      if (member.headFilled) Object.assign(figure.segments[1], {primitive_code: 3, flags: 3, segment_kind: 'circleFill', thickness: 0});
      if (member.eyes) addEyes(figure, parseColor(member.eyeColor ?? (member.headFilled ? '#ffffff' : member.color ?? '#2b2b2b'), `${member.id}.eyeColor`));
      return figure;
    }
    case 'line':
      return definition(typeId, member.id, [segment(member.length ?? 400, 0, member.thickness ?? 4, {...staticSegment, color_rgb: color})]);
    case 'circle': {
      const filled = member.filled ?? true, diameter = 2 * (member.radius ?? 30);
      return definition(typeId, member.id, [segment(diameter, -Math.PI / 2, filled ? 0 : member.thickness ?? 4, {
        ...staticSegment, color_rgb: color, primitive_code: filled ? 3 : 1, flags: filled ? 259 : 257,
        segment_type: 'circle', segment_kind: filled ? 'circleFill' : 'circle'})]);
    }
    case 'rect': {
      // A square-capped line is a rectangle: its caps add half its thickness at each end.
      const width = member.width ?? 100, height = member.height ?? 100, wide = width >= height;
      return definition(typeId, member.id, [segment(Math.max(1, Math.abs(width - height)), wide ? 0 : Math.PI / 2, wide ? height : width,
        {...staticSegment, color_rgb: color, primitive_code: 6, flags: 262, segment_kind: 'squareLine'})]);
    }
    case 'text': case 'file': {
      const figure = external.get(member.id)?.figure;
      if (!figure) throw new Error(`${member.id}: its ${member.kind} figure was not prepared`);
      return {...structuredClone(figure), figure_type_id: typeId, name: member.id};
    }
    default:
      throw new Error(`${member.id}: unknown kind "${member.kind}"`);
  }
}

/** Places one cast member for one keyframe from its state; returns the object and, for a stickman, its handles. */
function placeObject(member, figure, uid, state, anchor) {
  const object = createObject(figure, uid, state.x ?? 0, state.y ?? 0);
  object.scale = state.scale ?? 1;
  if (state.opacity !== undefined) object.field28 = Math.round((1 - Math.min(1, Math.max(0, state.opacity))) * 255);
  if (member.kind === 'stickman') {
    const angles = segmentAngles(figure, state.angles, {flip: state.flip, face: state.face});
    object.angles = angles;
    if (state.ground !== undefined) object.root_y = state.ground - lowestPoint(figure, angles) * object.scale;
    return {object, handles: handlePositions(figure, angles, {x: object.root_x, y: object.root_y}, object.scale)};
  }
  const turn = radians(state.rotate ?? 0);
  object.angles = figure.segments.map(part => (state.flip ? Math.PI - part.angle_rad : part.angle_rad) + turn);
  if (state.flip) object.image_text_flags = 1;
  // A circle's root is its bottom; the spec places its centre.
  if (member.kind === 'circle') object.root_y += figure.segments[0].length / 2 * object.scale;
  // Text and rectangle roots are not their centres; the spec places the centre, which rotation turns around.
  if (anchor) {
    const ax = (state.flip ? -anchor.x : anchor.x) * object.scale, ay = anchor.y * object.scale;
    object.root_x += ax * Math.cos(turn) - ay * Math.sin(turn);
    object.root_y += ax * Math.sin(turn) + ay * Math.cos(turn);
  }
  return {object, handles: new Map([[0, {x: object.root_x, y: object.root_y}]])};
}

const PLACEMENT_KEYS = ['x', 'y', 'ground', 'scale', 'rotate', 'flip', 'opacity', 'face'];
const NUMERIC_KEYS = ['x', 'y', 'ground', 'scale', 'rotate', 'opacity'];

/** The next state of a cast member: unspecified fields carry over from the previous keyframe. */
function nextState(member, previous, change) {
  const state = {...previous};
  for (const key of PLACEMENT_KEYS) if (change[key] !== undefined) state[key] = change[key];
  if (change.y !== undefined && change.ground === undefined) delete state.ground;
  if (change.ground !== undefined && change.y === undefined) delete state.y;
  if ('attach' in change) state.attach = change.attach ?? null;
  if (member.kind !== 'stickman') return state;
  const adjust = {joints: change.joints, bend: change.bend, turn: change.turn, lean: change.lean};
  // A new pose starts from its library angles; joints, bend, turn and lean alone adjust the previous pose.
  if (change.pose !== undefined || !previous.angles) state.angles = resolveAngles({pose: change.pose ?? 'stand', ...adjust});
  else if (adjust.joints || adjust.bend || adjust.turn || adjust.lean) state.angles = resolveAngles({pose: null, ...adjust}, previous.angles);
  return state;
}

/** Expands a walk or run keyframe into one keyframe per pose of the cycle, ending on a stand. */
function expandWalk(key, index, cast, figures, states) {
  const {figure: id, to, run = false, step = run ? 4 : 5, stop = true, joints, bend, turn, face = 'side'} = key.walk;
  const member = cast.find(entry => entry.id === id), state = states.get(id);
  if (member?.kind !== 'stickman') throw new Error(`keyframes[${index}].walk.figure must name a stickman in the cast`);
  if (state?.x === undefined) throw new Error(`keyframes[${index}]: place "${id}" in an earlier keyframe before it walks`);
  if (!Number.isFinite(to)) throw new Error(`keyframes[${index}].walk.to must be an x position`);
  if (!Number.isInteger(step) || step < 1) throw new Error(`keyframes[${index}].walk.step must be a whole number of frames`);
  const cycle = run ? RUN_CYCLE : WALK_CYCLE, distance = to - state.x;
  const advance = cycleAdvance(figures.get(id), cycle[0], state.scale ?? 1);
  const count = Math.max(1, Math.round(Math.abs(distance) / advance)), flip = distance === 0 ? state.flip : distance < 0;
  const keys = Array.from({length: count}, (_, i) => ({hold: step, ease: 'linear',
    figures: {...(i === 0 ? key.figures : {}), [id]: {x: state.x + distance * (i + 1) / count, pose: cycle[(i + 1) % cycle.length], flip, joints, bend, turn, face}},
    ...(i === 0 ? {camera: key.camera, background: key.background} : {})}));
  if (stop) keys.push({hold: key.hold ?? 6, ease: key.ease, figures: {[id]: {pose: 'stand', joints, bend, turn}}});
  return keys;
}

const shortest = degrees => ((degrees + 540) % 360) - 180;
/** A state between two states of the same figure: numbers and joint angles interpolate, everything else holds. */
function lerpState(a, b, t) {
  if (!b) return a;
  const state = {...a};
  for (const key of NUMERIC_KEYS) if (Number.isFinite(a[key]) && Number.isFinite(b[key])) state[key] = a[key] + (b[key] - a[key]) * t;
  if (a.angles && b.angles && a.flip === b.flip)
    state.angles = Object.fromEntries(JOINTS.map(joint => [joint, a.angles[joint] + shortest(b.angles[joint] - a.angles[joint]) * t]));
  return state;
}
const lerpCamera = (a, b, t) => a && b ? Object.fromEntries(['x', 'y', 'zoom', 'rotate'].map(key => [key, (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * t])) : a;

/**
 * Compiles a spec into a document. `external` maps a text or file cast id to {figure, anchor?}: its prepared
 * definition and, for text, the offset from the placed centre to the figure's root before scale.
 * Returns {document, ticks, seconds}.
 */
export function compileSpec(spec, external = new Map()) {
  const width = spec.width ?? 540, height = spec.height ?? 960, fps = spec.fps ?? 24;
  const cast = spec.cast ?? [];
  if (!cast.length) throw new Error('The cast is empty: add at least one figure');
  if (!spec.keyframes?.length) throw new Error('Add at least one keyframe');
  const ids = new Set();
  for (const member of cast) {
    if (!member.id || ids.has(member.id)) throw new Error(`Cast ids must be unique and non-empty (problem: "${member.id}")`);
    ids.add(member.id);
  }

  const document = emptyDocument();
  Object.assign(document, {canvas_width: width, canvas_height: height, fps});
  document._styk.name = spec.title ?? 'Untitled animation';
  document.figure_types = cast.map((member, index) => castDefinition(member, index + 1, external));
  const figures = new Map(cast.map((member, index) => [member.id, document.figure_types[index]]));
  const members = new Map(cast.map(member => [member.id, member]));
  const uids = new Map(cast.map((member, index) => [member.id, index + 1]));
  const anchors = new Map(cast.map(member => [member.id, member.kind === 'rect' ? rectAnchor(figures.get(member.id)) : external.get(member.id)?.anchor]));

  // 1. Resolve every keyframe (walks expanded) into the full state of each visible figure.
  const states = new Map(), visible = new Set(), records = [];
  let background = spec.background ?? '#ffffff', camera = null;
  const resolve = (key, index) => {
    const hold = key.hold ?? 12;
    if (!Number.isInteger(hold) || hold < 1 || hold > 65535) throw new Error(`keyframes[${index}].hold must be a whole number of frames from 1 to 65535`);
    const overshoot = new Map(), arcs = new Map();
    for (const [id, change] of Object.entries(key.figures ?? {})) {
      const member = members.get(id);
      if (!member) throw new Error(`keyframes[${index}] names "${id}", which is not in the cast`);
      if (change.hide) { visible.delete(id); continue; }
      states.set(id, nextState(member, states.get(id) ?? {}, change));
      visible.add(id);
      if (change.overshoot) {
        if (member.kind !== 'stickman') throw new Error(`keyframes[${index}].figures.${id}.overshoot applies to stickmen`);
        overshoot.set(id, change.overshoot);
      }
      if (change.arc !== undefined) {
        if (!Number.isFinite(change.arc) || change.arc < 0) throw new Error(`keyframes[${index}].figures.${id}.arc must be a height in pixels, 0 or more`);
        arcs.set(id, change.arc);
      }
    }
    if (key.background) background = key.background;
    if (key.camera) camera = {x: width / 2, y: height / 2, zoom: 1, rotate: 0, ...camera, ...key.camera};
    const ease = key.ease ?? spec.ease ?? 'auto';
    if (!EASINGS[ease]) throw new Error(`keyframes[${index}].ease must be one of ${Object.keys(EASINGS).join(', ')}`);
    const record = {index, hold, ease, background, camera, overshoot, arcs, settle: key.settle,
      states: new Map([...visible].map(id => [id, states.get(id)]))};
    const still = key.still ?? 0;
    if (!Number.isInteger(still) || still < 0 || still > 65535) throw new Error(`keyframes[${index}].still must be a whole number of frames`);
    // Staying still is a copy of the pose that the move to the next keyframe starts from.
    if (still) records.push({...record, hold: still}, {...record, overshoot: new Map(), arcs: new Map(), settle: undefined});
    else records.push(record);
  };
  spec.keyframes.forEach((key, index) => {
    if (key.walk) for (const expanded of expandWalk(key, index, cast, figures, states)) resolve(expanded, index);
    else resolve(key, index);
  });

  // 2. Turn records into frames. Overshoot passes the pose and settles back, while everything else keeps moving.
  const backgrounds = new Map();
  const backgroundId = color => {
    const [r, g, b] = parseColor(color, 'background');
    const argb = (0xff000000 | r << 16 | g << 8 | b) >>> 0;
    if (!backgrounds.has(argb)) backgrounds.set(argb, {background_id: backgrounds.size + 1, kind: 2, color: argb, name: `Color ${color}`});
    return backgrounds.get(argb).background_id;
  };
  const frame = (record, stateMap, cameraState, hold, ease = record.ease) => {
    const placed = cast.filter(member => stateMap.has(member.id)).map(member =>
      ({member, ...placeObject(member, figures.get(member.id), uids.get(member.id), stateMap.get(member.id), anchors.get(member.id))}));
    const slots = new Map(placed.map((entry, slot) => [entry.member.id, slot]));
    for (const {member, object} of placed) {
      const attach = stateMap.get(member.id).attach;
      if (!attach) continue;
      const target = placed[slots.get(attach.to)];
      if (!target) throw new Error(`keyframes[${record.index}]: "${member.id}" is attached to "${attach.to}", which is not on stage`);
      if (attach.to === member.id) throw new Error(`keyframes[${record.index}]: "${member.id}" cannot attach to itself`);
      const handle = target.member.kind === 'stickman' ? HANDLES[attach.at ?? 'rightHand'] : 0;
      if (handle === undefined) throw new Error(`keyframes[${record.index}]: unknown attach point "${attach.at}". Use ${Object.keys(HANDLES).join(', ')}`);
      // The app evaluates a joined figure's root at the target's handle on every frame.
      object.join = {target_object_slot: slots.get(attach.to), target_unique_id: target.object.unique_id, target_handle_id: handle};
      ({x: object.root_x, y: object.root_y} = target.handles.get(handle));
    }
    const result = createFrame(placed.map(entry => entry.object), hold);
    result._styk = {easing: structuredClone(EASINGS[ease])};
    result.background_id = backgroundId(record.background);
    if (cameraState) result.camera = {is_default: false, x: cameraState.x - width / 2, y: cameraState.y - height / 2,
      scale: 1 / cameraState.zoom, angle_rad: radians(cameraState.rotate)};
    return result;
  };
  const frames = [];
  let ticks = 0;
  // The move from `record` to `next`, starting at fraction `from` of it. A figure arriving with an arc follows a
  // parabola (even speed across, gravity up and down) sampled every two frames; the rest move evenly with it.
  const transition = (record, next, states, cameraState, from, hold) => {
    if (!next?.arcs.size || hold < 2) { frames.push(frame(record, states, cameraState, hold)); return; }
    const steps = Math.max(1, Math.round(hold / 2));
    let used = 0;
    for (let step = 0; step < steps; step++) {
      const t = from + (1 - from) * step / steps, sampled = new Map();
      for (const [id, state] of (step ? record.states : states)) sampled.set(id, step ? lerpState(state, next.states.get(id), t) : state);
      for (const [id, peak] of next.arcs) {
        const start = record.states.get(id), end = next.states.get(id);
        if (!start || !end) throw new Error(`keyframes[${next.index}]: "${id}" needs a position in the keyframe before its arc`);
        const key = end.ground !== undefined ? 'ground' : 'y';
        if (!Number.isFinite(start[key])) throw new Error(`keyframes[${next.index}]: "${id}" arcs on ${key}, so it needs ${key} in the keyframe before too`);
        // y(t) = apex + (s + r)²(t − tApex)²: through both ends, `peak` pixels above the higher one.
        const apex = Math.min(start[key], end[key]) - peak, s = Math.sqrt(start[key] - apex), r = Math.sqrt(end[key] - apex);
        const tApex = s + r ? s / (s + r) : 0;
        sampled.set(id, {...lerpState(start, end, t), [key]: apex + (s + r) ** 2 * (t - tApex) ** 2});
      }
      const length = step === steps - 1 ? hold - used : Math.round(hold / steps);
      used += length;
      frames.push(frame(record, sampled, step ? lerpCamera(record.camera, next.camera, t) : cameraState, length, 'linear'));
    }
  };
  records.forEach((record, i) => {
    ticks += record.hold;
    const previous = records[i - 1], next = records[i + 1], settle = Math.min(record.settle ?? 4, record.hold - 1);
    if (!record.overshoot.size || settle < 1) { transition(record, next, record.states, record.camera, 0, record.hold); return; }
    const passed = new Map(record.states);
    for (const [id, amount] of record.overshoot) {
      const target = record.states.get(id), before = previous?.states.get(id);
      if (!before?.angles || before.flip !== target.flip) continue;
      passed.set(id, {...target, angles: Object.fromEntries(JOINTS.map(joint =>
        [joint, target.angles[joint] + shortest(target.angles[joint] - before.angles[joint]) * amount]))});
    }
    frames.push(frame(record, passed, record.camera, settle));
    const t = settle / record.hold, settled = new Map([...record.states].map(([id, state]) => [id, lerpState(state, next?.states.get(id), next ? t : 0)]));
    transition(record, next, settled, next ? lerpCamera(record.camera, next.camera, t) : record.camera, t, record.hold - settle);
  });
  // The last keyframe holds for its own length: a closing copy marks where it ends.
  const closing = structuredClone(frames.at(-1));
  closing.duration_raw = 1; closing._styk = {easing: {interpolation: 'constant'}};
  frames.push(closing);
  document.keyframes = frames;
  document.backgrounds = [...backgrounds.values()];
  validateScene(document);
  return {document, ticks, seconds: ticks / fps};
}

export const poseNames = () => Object.keys(POSES);
