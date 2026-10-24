// The StykAnimate app this server runs. With STYK_APP_ROOT it uses that checkout; otherwise it downloads a
// pinned source tarball once into a user cache. The app runs from its own source files and Python codec
// service, so the download needs no npm install.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, rename, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const REPOSITORY = process.env.STYK_APP_REPOSITORY || 'filippocalippo/StykAnimate-App';
const REF = process.env.STYK_APP_REF || 'def97214c2b491fbce82647f625a73f78416c6d8';

export function cacheDirectory() {
  if (process.env.STYK_CACHE_DIR) return path.resolve(process.env.STYK_CACHE_DIR);
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'stykanimate-mcp');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'stykanimate-mcp');
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'stykanimate-mcp');
}

const log = message => process.stderr.write(`[stykanimate-mcp] ${message}\n`);
const tar = (archive, into) => new Promise((resolve, reject) => {
  const child = spawn('tar', ['-xzf', archive, '-C', into, '--strip-components=1'], {stdio: ['ignore', 'ignore', 'pipe']});
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve() : reject(new Error(`tar failed (${code}): ${errors.trim()}`)));
});

async function download(target) {
  const url = `https://codeload.github.com/${REPOSITORY}/tar.gz/${REF}`;
  log(`Downloading StykAnimate (${REPOSITORY}@${REF.slice(0, 8)}, about 16 MB) into ${target}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download StykAnimate from ${url}: HTTP ${response.status}`);
  const staging = `${target}.${process.pid}.partial`, archive = `${staging}.tar.gz`;
  await rm(staging, {recursive: true, force: true});
  await mkdir(staging, {recursive: true});
  try {
    await writeFile(archive, Buffer.from(await response.arrayBuffer()));
    await tar(archive, staging);
    if (!existsSync(path.join(staging, 'src', 'editor.mjs'))) throw new Error('The download does not look like StykAnimate');
    // Another process may have finished first; either copy is complete.
    await rename(staging, target).catch(error => { if (!existsSync(target)) throw error; });
    log('StykAnimate is ready.');
  } finally {
    await rm(archive, {force: true});
    await rm(staging, {recursive: true, force: true});
  }
}

let ready = null;
/** The app's root directory, downloading it on first use. */
export function ensureApp() {
  ready ??= (async () => {
    if (process.env.STYK_APP_ROOT) {
      const root = path.resolve(process.env.STYK_APP_ROOT);
      if (!existsSync(path.join(root, 'src', 'editor.mjs'))) throw new Error(`STYK_APP_ROOT (${root}) is not a StykAnimate-App checkout`);
      return root;
    }
    const root = path.join(cacheDirectory(), `app-${REF.slice(0, 12)}`);
    if (!existsSync(path.join(root, 'src', 'editor.mjs'))) await download(root);
    return root;
  })().catch(error => { ready = null; throw error; });
  return ready;
}

let modules = null;
/**
 * The app modules this server uses, imported once and one after another: concurrent dynamic imports of
 * overlapping module graphs that use top-level await fail in Node's loader ("module not been linked").
 */
export function appModules() {
  modules ??= (async () => {
    const root = await ensureApp(), load = relative => import(pathToFileURL(path.join(root, relative)).href);
    const demo = await load('src/demo.mjs'), model = await load('src/pivot/model.mjs');
    const exportRequest = await load('src/export-request.mjs'), {default: backend} = await load('desktop/backend.cjs');
    return {demo, model, exportRequest, backend};
  })().catch(error => { modules = null; throw error; });
  return modules;
}
