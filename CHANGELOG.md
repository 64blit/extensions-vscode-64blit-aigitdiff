# Changelog

## 0.33.0

- Code Map redesigned as an **orbital board** (v2 layout):
  - Every folder is a horizontal **ring (orbit)** floating at a height set by its depth; the folder's files are **spheres resting on the ring**, spaced by size. Child folders pack inside the parent's boundary circle — orbits within orbits, connected by faint vertical stems.
  - Sphere hue = git status (green added, amber modified, red deleted, blue renamed); changed files float above their orbit and carry name + churn pill labels.
  - **Hubs**: files imported by 4+ others get a violet halo and an "imported by N" count — the load-bearing walls of the repo stand out.
  - Import paths render as directional arcs (cyan → purple = importer → imported); hovering or selecting a sphere draws its own arcs bright — outgoing cyan/purple, incoming amber — while the rest stays ambient.
  - **Hover = diff peek**: the tooltip shows the file's first hunk with +/− coloring, straight from the working diff.
  - **Click = anchored diff window**: a floating panel opens next to the sphere (connector line included, follows the camera) with the full interactive diff — hunk approve/reject, stage/unstage, inline comments all work inside it.
  - **Notes for the AI**: the panel has a notes strip + composer; saved notes ride along with "Analyze with notes" so the AI review addresses what you asked. Notes are stored as file-level comments.
- Architecture: the three.js renderer moved out of the webview template literal into `media/map.js` (real ES module, loaded via importmap) — editable, lintable, testable.
- Fixed: opening a diff from the map crashed (`gridMode` const reassignment) — the map diff panel now renders through `renderFile(change, flat)`.
- Fixed: fast mouse movement could leave the hover stuck on a passed-through node (trailing re-pick added).
- Camera: unchanged — fixed isometric, drag pan, wheel zoom, Q/E snap rotation.

## 0.32.0

- New: **Code Map** (experimental, `gitDiffViewer.experimentalMap`) — a zoomable, circle-packed bubble view of the whole repo rendered with three.js. Toolbar `◉ Map` toggles between the map and the diff grid.
  - Deterministic d3 circle-packing layout: directories nest, positions never jump between refreshes (spatial memory preserved).
  - Fixed-tilt 2.5D camera — changed files float up by churn; zoom (wheel) and pan (drag) only, no orbit.
  - Bubble encoding: size + color heat = churn, ring = quality (clean/review/concern from AI analysis) or green when reviewed, one-word AI label above each changed file.
  - Import edges between changed JS/TS files, drawn as center-bundled curves; clicking a bubble highlights its transitive blast radius.
  - Review workflow: mark bubbles ✓ reviewed (persisted per repo), progress counter, "unreviewed only" filter, path filter (`/`), keyboard: Enter = diff, v = viewed, Esc = clear.
  - Hover tooltip (path, +/-, risk, summary, missing-test hint, comment count) and click card with Diff / Open / Reviewed / Analyze actions.
  - Analysis streams onto the map live from the Architect Doc pipeline; map dims while a run is stale.
- Per-file analysis now also returns a one-word change category and a 3-bucket quality rating; both feed the map.
- Repo tree capped at 3000 files for huge repos (changed files always shown), with truncation note.

## 0.31.0

- New: Architect Doc — an expandable "Change Review" section at the top of the panel. Analyzes every changed file asynchronously (diffs render instantly, analysis streams in) and synthesizes an ultra-compact architecture overview: TL;DR, architecture bullets, risk list, verdict.
- New: per-file one-line AI summaries with risk badges (🔴/🟡/🟢), shown both in the review section and inline in each file panel header. Click a row to jump to that diff.
- New: any file change cancels the in-flight analysis run and restarts it. Per-file results are cached by diff hash, so restarts only re-analyze files that actually changed.
- New: local static analysis via the [fallow](https://github.com/fallow-rs/fallow) CLI (`fallow audit --changed-since HEAD`), merged into the review doc. Skipped gracefully when not installed. `gitDiffViewer.analysisMode` chooses local / remote / both.
- Changed: the AI model is now configurable (`gitDiffViewer.model`, default `deepseek/deepseek-v4-flash`) with optional per-task overrides (`analysisModel`, `reviewModel`, `commitModel`). Previously hardcoded to Grok.
- New settings: `autoAnalyze`, `analysisMode`, `fallowPath`, `analysisConcurrency`.
- Fixed: agent binary is now shell-quoted when injecting prompts into the embedded terminal.

## 0.30.10

- First public release on the marketplace.
- Single-window view of all local git changes with side-by-side diffs.
- Optional AI commit message generation via OpenRouter.
- Embedded terminal tab.
- Configurable grid sizes and auto-open behavior.
