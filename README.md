# Git Diff Viewer

I built this because the built-in source control panel makes me click through files one at a time when I just want to see what I changed. This opens every changed file in one window with side-by-side diffs you can scroll through.

Works in VS Code and Antigravity.

## What it does

- Shows every changed file in your repo on a single page
- Side-by-side diff per file with syntax highlighting
- Staged, unstaged, and untracked files all in one view
- Collapse files you've already looked at
- A grid layout you can resize (small / medium / large columns)
- Draft commit messages and per-file comments that stick around between sessions
- Optional AI commit message generation using OpenRouter (Grok 4.1 fast)
- An embedded terminal tab for running git commands without leaving the panel

## Code Map (3D)

Toolbar `◉ Map` switches to an orbital view of the repo:

- Every folder is a ring (orbit) floating at a height set by its depth; its files are spheres sitting on the ring. Subfolders nest inside — orbits within orbits.
- Sphere color = git status (green added, amber modified, red deleted, blue renamed). Changed files float above their orbit with name + churn labels.
- Violet halo = hub: a file imported by 4 or more others.
- Import paths draw as arcs. Hover a sphere to light up its own arcs — cyan/purple outgoing, amber incoming — and to peek at its first diff hunk right in the tooltip.
- Click a changed sphere to open the diff in a floating window anchored to it. Approve/reject hunks, stage, comment — all without leaving the map.
- Add notes in the panel and hit "Analyze with notes" — the AI review reads them and responds to each one.
- Controls: drag = pan, wheel = zoom, Q/E = rotate 90°, double-click a folder = focus it, `f` = frame the changeset, `n`/`p` = next/previous unreviewed, `v` = mark reviewed, Esc = close.

## Install

From the VS Code marketplace: search for "Git Diff Viewer" by `64blit`.

Or grab the `.vsix` from the [releases page](https://github.com/64blit/vscode-ext-AIGitDiffery/releases) and run:

```
code --install-extension git-diff-viewer-0.30.10.vsix
```

## Usage

- Open the panel: `Cmd+Alt+G` (Mac) or `Ctrl+Alt+G` (Win/Linux)
- Or run "Git Diff Viewer: Open Local Changes" from the command palette
- The panel opens automatically when you start the editor inside a git repo. Turn that off in settings if you don't want it.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `gitDiffViewer.autoOpenOnStartup` | `true` | Open the panel when the editor starts in a repo |
| `gitDiffViewer.autoOpenFocus` | `false` | Steal focus on auto-open. Off by default so it opens beside what you're working on |
| `gitDiffViewer.gridSize` | `md` | Column width preset: `sm`, `md`, or `lg` |
| `gitDiffViewer.openRouterApiKey` | `""` | API key for AI commit messages. You can also set `OPENROUTER_API_KEY` in `~/.env` |

## AI commit messages

This is optional. If you want it, drop an OpenRouter key in settings or in `~/.env` and the "generate commit" button starts working. It uses Grok 4.1 fast. Without a key, every other feature still works.

Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).

## Build from source

```
npm install
npm run compile
npm run package
```

That produces a `.vsix` you can install locally.

## Known rough edges

- The native PTY for the embedded terminal is loaded lazily. If the prebuilt binary doesn't exist for your platform the terminal tab won't work, but the rest of the extension still loads.
- Files larger than 256 KB don't get syntax highlighting on either side of the diff. The diff still renders.
- I've used this daily for months on macOS. Windows and Linux are tested but get less mileage.

## License

MIT. See [LICENSE](LICENSE).
