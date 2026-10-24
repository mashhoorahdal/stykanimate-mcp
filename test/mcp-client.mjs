// Drives the server over stdio the way an MCP client does: list tools, build with audio, preview, export,
// save and reopen. Needs ffmpeg (for the test tone and the MP4 with sound). Output goes to out/mcp.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const out = path.resolve(process.argv[2] ?? new URL('../out/mcp', import.meta.url).pathname);
await mkdir(out, {recursive: true});
const tone = spawnSync(process.env.STYK_FFMPEG || 'ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-ac', '1', path.join(out, 'tone.wav')]);
if (tone.status !== 0) throw new Error(`ffmpeg could not make the test tone: ${tone.error?.message ?? tone.stderr}`);
const client = new Client({name: 'smoke', version: '1.0.0'});
await client.connect(new StdioClientTransport({command: process.execPath, args: [new URL('../bin/stykanimate-mcp.mjs', import.meta.url).pathname], stderr: 'inherit'}));
const call = async (name, args = {}) => {
  const result = await client.callTool({name, arguments: args});
  if (result.isError) throw new Error(`${name}: ${result.content[0].text}`);
  return result;
};
try {
  const {tools} = await client.listTools();
  console.log('tools', tools.map(tool => tool.name).join(', '));
  assert.match((await call('stykanimate_guide')).content[0].text, /Pose library/);
  const spec = {title: 'Tone test', cast: [{id: 'floor', kind: 'rect', width: 540, height: 200}, {id: 'bob', kind: 'stickman', eyes: true},
    {id: 'bag', kind: 'rect', width: 40, height: 52, color: '#e9c79a'}],
    keyframes: [{hold: 12, figures: {floor: {x: 270, y: 860}, bob: {x: 150, ground: 760, pose: 'stand', scale: 1.3, face: 'front'},
      bag: {attach: {to: 'bob', at: 'rightHand'}}}},
      {walk: {figure: 'bob', to: 350, joints: {rightUpperArm: 80, rightForearm: 88}}, hold: 6},
      {hold: 12, figures: {bob: {pose: 'wave_a', face: 'front', overshoot: 0.2}}}],
    audio: [{path: path.join(out, 'tone.wav'), start: 0.5}]};
  const built = JSON.parse((await call('build_animation', {spec, saveProject: path.join(out, 'tone.styk')})).content[0].text);
  console.log('built', built);
  assert.ok(built.seconds >= 6.5, 'lengthened to the end of the audio');
  const preview = await call('preview_frames', {count: 4});
  assert.equal(preview.content[0].type, 'image');
  await writeFile(path.join(out, 'preview.png'), Buffer.from(preview.content[0].data, 'base64'));
  console.log('export', (await call('export_video', {out: path.join(out, 'tone.mp4'), preset: 'shorts'})).content[0].text);
  console.log('reopen', (await call('open_project', {path: path.join(out, 'tone.styk')})).content[0].text);
  console.log('info', (await call('project_info')).content[0].text);
  const bad = await client.callTool({name: 'build_animation', arguments: {spec: {cast: [{id: 'a', kind: 'stickman'}], keyframes: [{figures: {b: {}}}]}}});
  assert.ok(bad.isError && /not in the cast/.test(bad.content[0].text), 'a bad spec returns a readable error');
  console.log('PASS');
} finally { await client.close(); }
