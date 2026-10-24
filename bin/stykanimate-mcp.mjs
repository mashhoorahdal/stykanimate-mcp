#!/usr/bin/env node
// stykanimate-mcp            run the MCP server over stdio (what MCP clients start)
// stykanimate-mcp install …  register the server with coding agents (see --help)
// stykanimate-mcp prepare    download StykAnimate and a browser now instead of on first use
const [command, ...rest] = process.argv.slice(2);

if (command === 'install') {
  const {main} = await import('../src/install.mjs');
  process.exitCode = await main(rest);
} else if (command === 'remove') {
  const {main} = await import('../src/install.mjs');
  process.exitCode = await main([...rest, '--remove']);
} else if (command === 'prepare') {
  const {ensureApp} = await import('../src/app.mjs');
  const {launchBrowser} = await import('../src/browser.mjs');
  console.log(`StykAnimate: ${await ensureApp()}`);
  await (await launchBrowser()).close();
  console.log('Browser: ready');
} else if (command === '--help' || command === '-h' || command === 'help') {
  console.log(`stykanimate-mcp: StykAnimate animation and video MCP server

  npx -y github:mashhoorahdal/stykanimate-mcp                         run the server (stdio)
  npx -y github:mashhoorahdal/stykanimate-mcp install <agent…|all>     register it with coding agents
  npx -y github:mashhoorahdal/stykanimate-mcp remove <agent…|all>      unregister it
  npx -y github:mashhoorahdal/stykanimate-mcp prepare                  download the app and a browser now`);
} else if (command) {
  console.error(`Unknown command "${command}". Try --help.`);
  process.exitCode = 1;
} else await import('../src/index.mjs');
