# Changelog

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
