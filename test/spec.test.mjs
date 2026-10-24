// The spec compiler (src/spec.mjs): spec → native document.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSpec, parseColor} from '../src/spec.mjs';
import {HANDLES, POSES, cycleAdvance, resolveAngles} from '../src/rig.mjs';

const cast = [{id: 'floor', kind: 'line', length: 540}, {id: 'bob', kind: 'stickman'}, {id: 'ball', kind: 'circle', radius: 20}];
const degrees = radians => Math.round(radians * 180 / Math.PI);

test('keyframes carry unspecified fields and keep one identity per cast member', () => {
  const {document, ticks} = compileSpec({cast, keyframes: [
    {hold: 10, figures: {floor: {x: 0, y: 700}, bob: {x: 100, ground: 700, pose: 'stand'}}},
    {hold: 5, figures: {bob: {x: 200}, ball: {x: 50, y: 50}}},
  ]});
  assert.equal(ticks, 15);
  const [first, second, closing] = document.keyframes;
  assert.equal(document.keyframes.length, 3, 'a closing key marks the end of the last hold');
  assert.deepEqual([first.duration_raw, second.duration_raw, closing.duration_raw], [10, 5, 1]);
  const bob = frame => frame.objects.find(object => object.figure_type_id === 2);
  assert.equal(bob(second).root_x, 200);
  assert.equal(bob(second).root_y, bob(first).root_y, 'ground placement carries over');
  assert.deepEqual(bob(second).angles, bob(first).angles, 'the pose carries over');
  assert.equal(bob(first).unique_id, bob(second).unique_id);
  assert.equal(first.objects.length, 2);
  assert.equal(second.objects.length, 3, 'a figure appears from the first keyframe that names it');
});

test('ground puts the lowest point of the pose on the floor', () => {
  const {document} = compileSpec({cast: [cast[1]], keyframes: [{figures: {bob: {x: 0, ground: 500, pose: 'stand', scale: 2}}}]});
  const object = document.keyframes[0].objects[0];
  // Standing legs (66 + 63 px, nearly vertical) plus half the shin thickness, doubled by scale.
  assert.ok(object.root_y < 500 - 2 * 120 && object.root_y > 500 - 2 * 135, `hip at ${object.root_y}`);
});

test('joints override a pose, joints alone adjust the previous pose, and flip mirrors', () => {
  const {document} = compileSpec({cast: [cast[1]], keyframes: [
    {figures: {bob: {pose: 'point', joints: {rightForearm: -45}}}},
    {figures: {bob: {joints: {leftThigh: 100}}}},
    {figures: {bob: {flip: true}}},
  ]});
  const angles = index => document.keyframes[index].objects[0].angles.map(degrees);
  assert.equal(angles(0)[3], -45);
  assert.equal(angles(1)[3], -45, 'the earlier override is kept');
  assert.equal(angles(1)[8], 100);
  assert.equal(angles(2)[3], 225, 'flip mirrors the adjusted pose: 180 - (-45)');
  assert.equal(angles(2)[8], 80);
});

test('hide removes a figure and camera and background apply per keyframe', () => {
  const {document} = compileSpec({width: 540, height: 960, background: '#fff', cast, keyframes: [
    {figures: {ball: {x: 10, y: 10}}, camera: {x: 370, y: 480, zoom: 2}},
    {figures: {ball: {hide: true}}, background: '#000'},
  ]});
  const [first, second] = document.keyframes;
  assert.deepEqual(first.camera, {is_default: false, x: 100, y: 0, scale: 0.5, angle_rad: 0});
  assert.deepEqual(second.camera, first.camera, 'the camera carries over');
  assert.equal(second.objects.length, 0);
  assert.notEqual(first.background_id, second.background_id);
  assert.equal(document.backgrounds.find(b => b.background_id === second.background_id).color, 0xff000000);
});

test('the circle is placed by its centre', () => {
  const {document} = compileSpec({cast: [cast[2]], keyframes: [{figures: {ball: {x: 50, y: 100}}}]});
  assert.equal(document.keyframes[0].objects[0].root_y, 120);
});

test('a rectangle is a square-capped line centred on its placement', () => {
  const {document} = compileSpec({cast: [{id: 'wide', kind: 'rect', width: 200, height: 50}, {id: 'tall', kind: 'rect', width: 40, height: 100}],
    keyframes: [{figures: {wide: {x: 300, y: 100}, tall: {x: 50, y: 400, scale: 2}}}]});
  const [wide, tall] = document.figure_types.map(figure => figure.segments[0]);
  assert.deepEqual([wide.segment_kind, wide.length, wide.thickness, wide.angle_rad], ['squareLine', 150, 50, 0]);
  assert.deepEqual([tall.length, tall.thickness, tall.angle_rad], [60, 40, Math.PI / 2]);
  const [first, second] = document.keyframes[0].objects;
  // The caps add half the thickness at each end, so the line runs from x 225 to 375 for a 200 px wide box.
  assert.deepEqual([first.root_x, first.root_y], [225, 100]);
  assert.deepEqual([second.root_x, second.root_y], [50, 400 - 60]);
});

test('invalid specs explain the problem', () => {
  assert.throws(() => compileSpec({cast, keyframes: [{figures: {nobody: {}}}]}), /not in the cast/);
  assert.throws(() => compileSpec({cast, keyframes: [{figures: {bob: {pose: 'moonwalk'}}}]}), /Unknown pose/);
  assert.throws(() => compileSpec({cast, keyframes: [{hold: 0}]}), /hold/);
  assert.throws(() => compileSpec({cast: [...cast, {id: 'bob', kind: 'line'}], keyframes: [{}]}), /unique/);
  assert.throws(() => parseColor('red'), /hex colour/);
  assert.deepEqual(parseColor('#f80'), [255, 136, 0]);
});

test('every library pose resolves every joint', () => {
  for (const name of Object.keys(POSES)) assert.equal(Object.values(resolveAngles({pose: name})).filter(Number.isFinite).length, 10, name);
});

const stickmanAt = (frame, uid = 2) => frame.objects.find(object => object.unique_id === uid);

test('walk expands into a stride-matched cycle that faces the way it goes and ends standing', () => {
  const {document, ticks} = compileSpec({cast, keyframes: [
    {hold: 10, figures: {bob: {x: 400, ground: 700, pose: 'stand', scale: 1.2}}},
    {walk: {figure: 'bob', to: 100, step: 5}, hold: 7, figures: {ball: {x: 10, y: 10}}},
  ]});
  const steps = Math.round(300 / cycleAdvance(document.figure_types[1], 'walk_contact_a', 1.2));
  assert.equal(document.keyframes.length, 1 + steps + 1 + 1, 'start, one key per step, the stand and the closing key');
  assert.equal(ticks, 10 + steps * 5 + 7);
  const last = stickmanAt(document.keyframes[steps]), stand = stickmanAt(document.keyframes[steps + 1]);
  assert.equal(last.root_x, 100, 'the last step lands exactly on the target');
  assert.ok(Math.abs(Math.sin(stand.angles[0]) + 1) < 1e-9, 'it ends standing: the torso points straight up');
  assert.equal(degrees(stickmanAt(document.keyframes[1]).angles[6]), 180 - 72, 'walking left mirrors the cycle (walk_pass_a thigh)');
  assert.equal(document.keyframes[1].objects.length, 2, 'other figures change at the first step');
  assert.equal(document.keyframes[1]._styk.easing.interpolation, 'linear');
});

test('bend sets an angle relative to the parent and carries the bones below; turn rotates a branch', () => {
  const angles = resolveAngles({pose: 'stand', bend: {rightForearm: -90}, turn: {rightUpperArm: -30}});
  assert.equal(angles.rightUpperArm, POSES.stand.rightUpperArm - 30);
  assert.equal(angles.rightForearm, angles.rightUpperArm - 90, 'the forearm keeps its bend when the upper arm turns');
  const leaned = resolveAngles({pose: 'stand', lean: 10});
  assert.equal(leaned.head, POSES.stand.head + 10);
  assert.equal(leaned.rightShin, POSES.stand.rightShin, 'legs do not lean');
});

test('attach joins a prop to a stickman handle in every keyframe until it lets go', () => {
  const {document} = compileSpec({cast: [cast[1], {id: 'bag', kind: 'rect', width: 40, height: 50}], keyframes: [
    {figures: {bob: {x: 100, y: 300}, bag: {attach: {to: 'bob', at: 'leftHand'}}}},
    {figures: {bob: {x: 200}}},
    {figures: {bag: {attach: null, x: 50, y: 60}}},
  ]});
  const bag = frame => frame.objects.find(object => object.unique_id === 2);
  assert.deepEqual(bag(document.keyframes[0]).join, {target_object_slot: 0, target_unique_id: 1, target_handle_id: HANDLES.leftHand});
  assert.ok(bag(document.keyframes[1]).join, 'the attachment carries over');
  assert.equal(bag(document.keyframes[2]).join, null);
  assert.throws(() => compileSpec({cast: [cast[1], {id: 'bag', kind: 'rect'}], keyframes: [
    {figures: {bob: {x: 1, y: 1}, bag: {attach: {to: 'bob'}}}}, {figures: {bob: {hide: true}}}]}), /not on stage/);
});

test('overshoot passes the new pose, then settles while other figures keep moving', () => {
  const {document, ticks} = compileSpec({cast, keyframes: [
    {hold: 10, figures: {bob: {x: 100, y: 300, pose: 'stand'}, ball: {x: 0, y: 0}}},
    {hold: 12, settle: 3, figures: {bob: {pose: 'arms_up', overshoot: 0.5}}},
    {hold: 6, figures: {ball: {x: 120, y: 0}}},
  ]});
  assert.equal(ticks, 28, 'overshoot does not change the length');
  const [, passed, settled] = document.keyframes;
  assert.deepEqual([passed.duration_raw, settled.duration_raw], [3, 9]);
  const arm = frame => degrees(stickmanAt(frame).angles[2]);
  assert.equal(arm(passed), Math.round(POSES.arms_up.rightUpperArm + (POSES.arms_up.rightUpperArm - POSES.stand.rightUpperArm) * 0.5));
  assert.equal(arm(settled), POSES.arms_up.rightUpperArm);
  const ball = frame => frame.objects.find(object => object.figure_type_id === 3);
  assert.equal(ball(settled).root_x, 30, 'the ball is a quarter of the way to its next key after 3 of 12 frames');
});

test('eyes follow the head and the face direction, and mirror with flip', () => {
  const eyed = {id: 'eve', kind: 'stickman', eyes: true};
  const {document} = compileSpec({cast: [eyed], keyframes: [
    {figures: {eve: {x: 0, y: 0, pose: 'stand', face: 'front'}}},
    {figures: {eve: {face: 'side'}}},
    {figures: {eve: {pose: 'nod', flip: true}}},
  ]});
  assert.equal(document.figure_types[0].segments.length, 14);
  const eyes = frame => [10, 12].map(index => degrees(frame.objects[0].angles[index]));
  assert.deepEqual(eyes(document.keyframes[0]), [70, 110], 'front: symmetric about the head');
  assert.deepEqual(eyes(document.keyframes[1]), [55, 55], 'side: both on the facing side');
  assert.deepEqual(eyes(document.keyframes[2]), [180 - (POSES.nod.head + 145), 180 - (POSES.nod.head + 145)], 'nodding turns them; flip mirrors');
});

test('still keeps a pose before the move to the next keyframe starts', () => {
  const {document, ticks} = compileSpec({cast, keyframes: [
    {hold: 10, still: 6, figures: {bob: {x: 100, y: 300, pose: 'stand'}}},
    {hold: 4, figures: {bob: {x: 200}}},
  ]});
  assert.equal(ticks, 20);
  const [arrive, leave, next] = document.keyframes;
  assert.deepEqual([arrive.duration_raw, leave.duration_raw], [6, 10]);
  assert.deepEqual(stickmanAt(arrive).angles, stickmanAt(leave).angles);
  assert.equal(stickmanAt(leave).root_x, 100);
  assert.equal(stickmanAt(next).root_x, 200);
});

test('arc samples a gravity parabola into the keyframe while other figures keep moving evenly', () => {
  const {document} = compileSpec({cast, keyframes: [
    {hold: 8, figures: {ball: {x: 0, y: 500}, bob: {x: 0, y: 300}}},
    {hold: 4, figures: {ball: {x: 80, y: 500, arc: 100}, bob: {x: 80}}},
  ]});
  const samples = document.keyframes.slice(0, 4);
  assert.deepEqual(samples.map(frame => frame.duration_raw), [2, 2, 2, 2]);
  assert.ok(samples.every(frame => frame._styk.easing.interpolation === 'linear'));
  const ball = frame => frame.objects.find(object => object.figure_type_id === 3), bob = frame => stickmanAt(frame);
  // A circle's root is its bottom: centre y + radius 20.
  const heights = samples.map(frame => 500 - (ball(frame).root_y - 20));
  assert.deepEqual(heights.map(Math.round), [0, 75, 100, 75], 'a symmetric arc peaking 100 px up half way');
  assert.deepEqual(samples.map(frame => ball(frame).root_x), [0, 20, 40, 60], 'even speed across');
  assert.deepEqual(samples.map(frame => bob(frame).root_x), [0, 20, 40, 60], 'others keep moving through the samples');
  assert.equal(ball(document.keyframes[4]).root_y - 20, 500, 'it lands on the keyframe');
});

test('physics plans use gravity scaled to the figures and land where asked', async () => {
  const {flightFrames, jump, bounce, toss} = await import('../src/physics.mjs');
  assert.ok(flightFrames(120, 120) > flightFrames(30, 30), 'higher stays up longer');
  assert.equal(flightFrames(120, 120), 2 * flightFrames(30, 30), 'four times the height, twice the time');
  assert.ok(flightFrames(60, 60, {scale: 2.4}) < flightFrames(60, 60, {scale: 1.2}), 'the same pixels are a smaller real jump for a bigger figure');
  const leap = jump({figure: 'bob', x: 100, ground: 700, height: 80, distance: 60});
  const {document} = compileSpec({cast, keyframes: [{figures: {bob: {x: 100, ground: 700, pose: 'stand'}}}, ...leap.keyframes]});
  const landing = document.keyframes.filter(frame => stickmanAt(frame)?.root_x === 160);
  assert.ok(landing.length, 'it lands at x + distance');
  const hops = bounce({figure: 'ball', x: 0, y: 200, rest: 700}).keyframes.map(key => key.figures.ball.arc).filter(Boolean);
  assert.ok(hops.every((height, i) => i === 0 || height < hops[i - 1]), 'each bounce is lower');
  assert.equal(toss({figure: 'ball', from: {x: 0, y: 500}, to: {x: 200, y: 500}, peak: 60}).keyframes[0].figures.ball.attach, null, 'a toss lets go');
});
