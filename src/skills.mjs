// The animation skills in skills/: served as MCP prompts, so every client can use them, and copied into
// agents' skill folders (Claude Code, Codex, opencode and other agents that read ~/.agents/skills).
import {existsSync} from 'node:fs';
import {cp, readdir, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';

const SKILLS = fileURLToPath(new URL('../skills/', import.meta.url));

/** Every skill: its folder, name, description and instructions (SKILL.md without its front matter). */
export async function loadSkills() {
  const skills = [];
  for (const entry of await readdir(SKILLS, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const text = await readFile(path.join(SKILLS, entry.name, 'SKILL.md'), 'utf8');
    const [, header = '', body = text] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text) ?? [];
    const field = name => /^\s*["']?(.*?)["']?\s*$/.exec(new RegExp(`^${name}:(.*)$`, 'm').exec(header)?.[1] ?? '')?.[1] ?? '';
    skills.push({folder: path.join(SKILLS, entry.name), name: field('name') || entry.name, description: field('description'), body: body.trim()});
  }
  return skills;
}

/** One prompt per skill; its optional `task` argument is appended to the instructions. */
export async function registerSkillPrompts(server) {
  for (const skill of await loadSkills()) {
    server.registerPrompt(skill.name.replace(/^stykanimate-/, ''), {
      title: skill.name, description: skill.description,
      argsSchema: {task: z.string().optional().describe('What to animate')},
    }, ({task}) => ({messages: [{role: 'user', content: {type: 'text', text: task ? `${skill.body}\n\n# Task\n\n${task}` : skill.body}}]}));
  }
}

const TARGETS = {
  claude: {label: 'Claude Code (~/.claude/skills; opencode reads it too)', directory: () => path.join(os.homedir(), '.claude', 'skills')},
  agents: {label: 'Codex, opencode and other agents (~/.agents/skills)', directory: () => path.join(os.homedir(), '.agents', 'skills')},
};

/** `skills [claude|agents|all] [--dir <path>] [--remove]`: copies (or removes) the skill folders. */
export async function installSkills(argv) {
  const args = [...argv], remove = args.includes('--remove'), at = args.indexOf('--dir');
  const custom = at >= 0 ? path.resolve(args[at + 1] ?? '.') : null;
  const names = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--dir');
  if (!custom && !names.length) {
    console.log('Usage: npx -y github:mashhoorahdal/stykanimate-mcp skills <claude|agents|all> [--dir <path>] [--remove]\n');
    for (const [id, target] of Object.entries(TARGETS)) console.log(`  ${id.padEnd(7)} ${target.label}`);
    return 0;
  }
  const unknown = names.filter(name => name !== 'all' && !TARGETS[name]);
  if (unknown.length) { console.error(`Unknown target: ${unknown.join(', ')}. Use ${Object.keys(TARGETS).join(', ')}, all or --dir.`); return 1; }
  const directories = [...(names.includes('all') ? Object.values(TARGETS) : names.map(name => TARGETS[name])).map(target => target.directory()), ...(custom ? [custom] : [])];
  for (const skill of await loadSkills()) for (const directory of directories) {
    const target = path.join(directory, path.basename(skill.folder));
    if (remove) { if (existsSync(target)) { await rm(target, {recursive: true}); console.log(`removed ${target}`); } continue; }
    await rm(target, {recursive: true, force: true});
    await cp(skill.folder, target, {recursive: true});
    console.log(`installed ${skill.name} → ${target}`);
  }
  if (!remove) console.log('\nStart a new agent session to load the skills. Every MCP client also gets them as prompts.');
  return 0;
}
