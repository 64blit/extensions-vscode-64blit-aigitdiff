// One-off: build a standalone browser harness for media/map.js so the
// orbital renderer can be eyeballed/screenshotted outside VS Code.
// Output: one-off-scripts/harness-map.html (serve the repo root over http —
// ES modules will not load from file://).
const path = require('path');
const fs = require('fs');
const repo = path.join(__dirname, '..');
const { buildArchMap } = require(path.join(repo, 'out', 'archMap.js'));
const { getWebviewHtml } = require(path.join(repo, 'out', 'webview.js'));

// Synthetic repo: nested folders, varied churn, one clear hub.
const files = [];
const dirsSpec = ['src/core', 'src/core/utils', 'src/ui/components', 'src/ui/hooks', 'src/api', 'test/unit', 'test/e2e', 'docs', 'scripts', 'src/deep/a/b/c'];
let i = 0;
for (const d of dirsSpec) for (let k = 0; k < 45; k++) files.push(`${d}/f${(i++).toString().padStart(3, '0')}.ts`);
for (let k = 0; k < 30; k++) files.push(`root${k}.ts`);
const changes = new Map();
const statuses = ['M', 'M', 'M', 'A', 'D', 'R'];
for (let k = 0; k < 40; k++) {
    changes.set(files[k * 11], { additions: (k * 37) % 400 + 3, deletions: (k * 13) % 90, status: statuses[k % statuses.length], untracked: k % 9 === 0 });
}
const importSpecs = new Map();
for (let k = 1; k <= 30; k++) importSpecs.set(`src/core/f${k.toString().padStart(3, '0')}.ts`, ['./f000']);
importSpecs.set('src/ui/components/f090.ts', ['../../core/f000', '../hooks/f135']);
importSpecs.set('src/api/f180.ts', ['../core/f000', '../core/f001']);
const viewed = new Set([files[11], files[22]]);
const payload = buildArchMap({
    files, changes, viewed, comments: new Map([[files[33], 2]]), contents: new Map(),
    importSpecs, root: '', exclude: [],
});

// Steal the real CSS so the harness looks like the shipped webview.
const html = getWebviewHtml({
    cspSource: 'http://localhost:8123',
    hlJsUri: 'x', hlCssUri: 'x', xtermJsUri: 'x', xtermCssUri: 'x', xtermFitUri: 'x',
    gridstackJsUri: 'x', gridstackCssUri: 'x', threeUri: 'x', mapJsUri: 'x',
    editor: { fontFamily: 'Menlo', fontSize: 12, lineHeight: 18, tabSize: 4, insertSpaces: true },
});
const cssBlocks = [];
const styleRe = /<style>([\s\S]*?)<\/style>/g;
let sm;
while ((sm = styleRe.exec(html)) !== null) cssBlocks.push(sm[1]);

const synthDiff = [
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -10,6 +10,9 @@ function demo()',
    ' const a = 1;',
    '-const b = compute(a);',
    '+const b = computeFast(a);',
    '+const c = validate(b);',
    '+log(c);',
    ' return b;',
    '@@ -40,4 +43,3 @@',
    ' more();',
    '-legacy();',
    ' done();',
].join('\n');

const out = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>map.js harness</title>
<style>${cssBlocks.join('\n')}</style>
<style>
  html, body { height: 100%; margin: 0; }
  body { background: #14181c; color: #f0f6fc; font-family: system-ui, sans-serif; }
  #map-view { display: flex !important; flex-direction: column; height: 100vh; }
</style>
</head>
<body class="vscode-dark map-mode">
<div id="map-view" aria-label="Code Map">
  <div class="map-topbar">
    <input type="search" id="map-filter" placeholder="Filter" />
    <label><input type="checkbox" id="map-all-cb"> All files</label>
    <button id="map-frame">⤢ Frame</button>
    <button id="map-next">▶ Next</button>
    <span class="map-progress" id="map-progress"></span>
    <span id="map-quality" class="map-quality"></span>
  </div>
  <div id="map-canvas-wrap">
    <div id="map-tooltip"></div>
    <div id="map-card"></div>
    <div id="map-legend">
      <div class="lg-row" style="opacity:.75">ring = folder orbit · sphere = file · height = depth</div>
      <div class="lg-row"><span class="lg-dot" style="background:#3fb950"></span> added <span class="lg-dot" style="background:#d29922"></span> modified <span class="lg-dot" style="background:#f85149"></span> deleted</div>
      <div class="lg-row"><span class="lg-dot" style="border:2px solid #c678dd; width:5px; height:5px; background:transparent"></span> hub — imported by many</div>
    </div>
    <div id="map-empty"></div>
    <svg id="map-connector" aria-hidden="true"><line id="map-connector-line" /></svg>
    <div id="map-panel">
      <div class="mp-bar">
        <span class="mp-path" id="map-panel-path"></span>
        <span class="mp-actions">
          <button id="map-panel-viewed">✓ Reviewed</button>
          <button id="map-panel-close">✕</button>
        </span>
      </div>
      <div class="mp-body files" id="map-panel-body"></div>
      <div class="mp-notes">
        <div class="mp-notes-list" id="map-panel-notes-list"><div class="mp-note"><span class="n-line">file</span><span class="n-body">check the retry loop here</span><button class="n-del">✕</button></div></div>
        <div class="mp-note-compose">
          <textarea id="map-note-input" rows="2" placeholder="Note for the AI review…"></textarea>
          <div class="mp-note-actions"><button id="map-note-save">💬 Add note</button><button id="map-note-ai">🔍 Analyze with notes</button></div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
window.__harnessLog = [];
window.__gdvMapBridge = {
  getChange: (p) => ({ diff: ${JSON.stringify(synthDiff)}, lines: 60, binary: false }),
  showDiff: (p) => {
    window.__harnessLog.push('showDiff:' + p);
    const panel = document.getElementById('map-panel');
    document.getElementById('map-panel-path').textContent = p;
    document.getElementById('map-panel-body').innerHTML =
      '<div class="file expanded" data-path="' + p + '" style="padding:8px; font-family:monospace; font-size:11px">' +
      '<div style="opacity:.7">@@ -10,6 +10,9 @@</div>' +
      '<div style="background:rgba(248,81,73,.18); color:#ffa198">-const b = compute(a);</div>' +
      '<div style="background:rgba(46,160,67,.18); color:#7ee787">+const b = computeFast(a);</div>' +
      '<div style="background:rgba(46,160,67,.18); color:#7ee787">+const c = validate(b);</div>' +
      '</div>';
    panel.classList.add('open');
    if (window.GitMap && window.GitMap.anchorPanel) window.GitMap.anchorPanel(p);
  },
  hidePanel: () => {
    document.getElementById('map-panel').classList.remove('open');
    if (window.GitMap && window.GitMap.anchorPanel) window.GitMap.anchorPanel(null);
  },
  jumpToDiff: (p) => window.__harnessLog.push('jumpToDiff:' + p),
  openFile: (p) => window.__harnessLog.push('openFile:' + p),
  setViewed: (p, v) => window.__harnessLog.push('setViewed:' + p + ':' + v),
  analyze: (p) => window.__harnessLog.push('analyze:' + p),
  setRoot: (p) => window.__harnessLog.push('setRoot:' + p),
};
window.__payload = ${JSON.stringify(payload)};
window.addEventListener('gitmap-ready', () => {
  window.GitMap.setData(window.__payload);
  window.GitMap.analysis('${files[0]}', { word: 'refactor', risk: 'medium', quality: 'review', summary: 'Rework of the core pipeline entry.' });
  window.GitMap.analysis('${files[11]}', { word: 'bugfix', risk: 'low', quality: 'clean', summary: 'Off-by-one fix in pagination.' });
  window.__ready = true;
});
document.getElementById('map-panel-close').addEventListener('click', () => window.__gdvMapBridge.hidePanel());
</script>
<script type="importmap">{ "imports": { "three": "/node_modules/three/build/three.module.js" } }</script>
<script type="module" src="/media/map.js"></script>
</body>
</html>`;
fs.writeFileSync(path.join(__dirname, 'harness-map.html'), out);
console.log('wrote one-off-scripts/harness-map.html · payload nodes:', payload.nodes.length, 'edges:', payload.edges.length);
