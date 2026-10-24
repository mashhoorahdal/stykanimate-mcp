# StykAnimate MCP

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant make stick-figure animations
with [StykAnimate](https://stykanimate.com) and export them as video — for example a 1080 × 1920 YouTube
Short — from a plain scene description. It runs the real StykAnimate app headless, so every frame comes
from the app's own renderer and exporter, and the saved `.styk` project opens in the app for hand editing.

## Install

Claude Code:

```sh
claude mcp add stykanimate -- npx -y github:mashhoorahdal/stykanimate-mcp
```

Any other agent, or several at once:

```sh
npx -y github:mashhoorahdal/stykanimate-mcp install            # list agents and which are installed
npx -y github:mashhoorahdal/stykanimate-mcp install all        # every agent found
npx -y github:mashhoorahdal/stykanimate-mcp install codex cursor
```

| Agent | id | Registered with |
| --- | --- | --- |
| Claude Code | `claude` | `claude mcp add --scope user` |
| Codex CLI | `codex` | `codex mcp add` |
| Gemini CLI | `gemini` | `gemini mcp add --scope user`, or `~/.gemini/settings.json` |
| VS Code | `vscode` | `code --add-mcp` |
| Cursor | `cursor` | `~/.cursor/mcp.json` |
| opencode | `opencode` | `~/.config/opencode/opencode.json` |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json` |
| Claude Desktop | `claude-desktop` | `claude_desktop_config.json` |

Options: `--output <dir>` for videos (default `~/styk-videos`), `--name <name>`, `--dry-run`, and `remove`
instead of `install` to unregister. Config files are edited in place, keeping their other entries.

Any MCP client can also run `npx -y github:mashhoorahdal/stykanimate-mcp` as a stdio server.

## Requirements

- **Node.js 22** or newer.
- **Python 3.11** or newer, which runs StykAnimate's codec service (`STYK_PYTHON` picks the interpreter).
- **Google Chrome** for direct MP4 export. Without it, Playwright's Chromium is downloaded once (about
  150 MB) and MP4s are made from WebM with ffmpeg.
- **ffmpeg** for MP4 with sound, and for MP4 without Chrome. WebM and GIF never need it.

The first start downloads StykAnimate's source (about 16 MB) into your cache folder. To do that ahead of
time, together with the browser check: `npx -y github:mashhoorahdal/stykanimate-mcp prepare`.

## What it can do

| Tool | What it does |
| --- | --- |
| `stykanimate_guide` | How to write a spec: coordinates, the rig, poses, timing, tips and an example |
| `build_animation` | Spec → animation in the headless editor, optionally saved as `.styk` |
| `preview_frames` | A contact sheet of chosen frames, drawn by the exporter |
| `export_video` | MP4, WebM or GIF; presets `shorts`, `youtube`, `tiktok`, `instagram`, `x`, `gif`, `best` |
| `save_project` | Save as `.styk` |
| `open_project` | Open a `.styk`, `.piv`, `.stk` or Stick Nodes file to preview or export it |
| `project_info` | Canvas, frame rate, length, figures and sound |

A spec lists the cast once (stickmen with optional eyes, rectangles, lines, circles, captions and Pivot
`.stk` figures), then keyframes that only say what changes. Motion between keyframes tweens with the app's
easing. Natural motion is built in:

- `walk` keyframes expand into a stride-matched walk or run cycle that faces the way it goes.
- `attach` holds a prop in a hand with an app join, so it follows every frame and can be handed over.
- `bend` and `turn` pose joints relative to their parent bone (forward kinematics).
- `overshoot` swings past a pose and settles; `still` pauses on a pose before the next move.
- `face` turns the eyes to the viewer or sideways; about forty named poses cover talking, reaching,
  knocking, picking up, sitting and more.
- Voiceover and music files can be placed on the timeline, and the animation stretches to fit them.

[`examples/grocery-run.json`](examples/grocery-run.json) is a complete 24-second Short: a man walks to a
shop, orders, pays and carries his groceries home.

## Configuration

| Variable | Meaning |
| --- | --- |
| `STYK_OUTPUT_DIR` | Where relative output paths go (default: the client's working directory) |
| `STYK_APP_ROOT` | Use this StykAnimate-App checkout instead of downloading one |
| `STYK_APP_REF`, `STYK_APP_REPOSITORY` | Which app commit and repository to download |
| `STYK_CACHE_DIR` | Where downloads are kept |
| `STYK_BROWSER_PATH`, `STYK_BROWSER_CHANNEL` | Which browser to use |
| `STYK_FFMPEG`, `STYK_PYTHON` | ffmpeg and Python executables |
| `STYK_HEADED=1` | Show the browser window while debugging |

## How it works

`src/spec.mjs` compiles a spec into a native StykAnimate document with the app's own document factories
and validates it with the app's scene validator. `src/session.mjs` starts the app's codec service and a
headless browser on the app, loads the document into the editor and drives the app's export dialog and Save
As, so exports match what the app produces. `src/app.mjs` downloads the pinned app source once;
`src/browser.mjs` finds or installs a browser. The server answers its client's handshake immediately and
loads the app on the first tool call.

## Development

```sh
npm ci
npm test            # spec compiler unit tests (downloads the app on first run)
npm run smoke       # build, preview, save and export examples/hello-short.json into out/smoke
npm run test:mcp    # a full stdio round trip with sound; needs ffmpeg
```

## License

GPL-3.0-or-later. This server runs and builds on [StykAnimate](https://github.com/filippocalippo/StykAnimate-App)
(GPL-3.0-or-later), which it downloads at run time; it is not affiliated with the StykAnimate project.
