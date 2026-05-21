# 64blit AI Git Diff

VS Code extension scaffold for the **64blit AI Git Diff** tool.

> Status: pre-release. The repository currently contains the build scaffold (TypeScript, ESLint, packaging) without user-facing features yet. Commands and providers will land in upcoming releases.

## Requirements

- VS Code `1.95.0` or newer.
- Node.js `20.x`.

## Development

```bash
npm install
npm run watch
```

Press `F5` in VS Code to launch an Extension Development Host.

Run lint and tests:

```bash
npm run lint
npm test
```

Build a `.vsix` for local install:

```bash
npm run package
code --install-extension 64blit-aigitdiff-<version>.vsix
```

## Roadmap

- AI-assisted review of staged git diffs from the Source Control view.
- Inline summaries and risk flags for changed hunks.

## License

MIT — see [LICENSE](./LICENSE).
