// Starts the browser the editor runs in: Google Chrome when installed (it can encode MP4), otherwise
// Playwright's Chromium, which is downloaded once if missing.
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const log = message => process.stderr.write(`[stykanimate-mcp] ${message}\n`);
const missing = error => /Executable doesn't exist|distribution '.+' is not found|ENOENT/i.test(String(error?.message ?? error));

function installChromium() {
  const cli = createRequire(import.meta.url).resolve('playwright/cli');
  log('Chrome was not found; downloading Playwright Chromium once (about 150 MB)…');
  return new Promise((resolve, reject) => {
    // stdout belongs to the MCP connection, so the installer's progress goes to stderr.
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {stdio: ['ignore', process.stderr, process.stderr]});
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Installing Chromium failed (${code}). Run: npx playwright install chromium`)));
  });
}

export async function launchBrowser() {
  const headless = process.env.STYK_HEADED !== '1';
  const channel = process.env.STYK_BROWSER_CHANNEL || 'chrome';
  if (process.env.STYK_BROWSER_PATH) return chromium.launch({executablePath: process.env.STYK_BROWSER_PATH, headless});
  try { return await chromium.launch({channel, headless}); }
  catch (error) { if (!missing(error)) throw error; }
  try { return await chromium.launch({headless}); }
  catch (error) { if (!missing(error)) throw error; }
  await installChromium();
  return chromium.launch({headless});
}
