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
