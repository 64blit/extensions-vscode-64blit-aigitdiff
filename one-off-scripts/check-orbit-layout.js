// One-off: sanity-check the v2 orbital layout in archMap.ts.
// Invariants:
//  1. every file sphere sits exactly on its folder's ring circumference
//  2. neighbouring spheres on a ring do not overlap
//  3. a folder's ring fits inside its packed boundary circle
//  4. layout is deterministic (two builds byte-identical)
//  5. hubs = files with inDeg >= 4
//  6. every dir on a distinct z plane per depth band, files share dir z
const path = require('path');
const { execFileSync } = require('child_process');
const { buildArchMap, extractImportSpecs } = require(path.join(__dirname, '..', 'out', 'archMap.js'));
const fs = require('fs');

const repo = path.join(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);

// Fake changes: mark a handful of real files changed with varied churn.
const changes = new Map([
    ['src/webview.ts', { additions: 900, deletions: 300, status: 'M', untracked: false }],
    ['src/archMap.ts', { additions: 200, deletions: 120, status: 'M', untracked: false }],
    ['src/extension.ts', { additions: 12, deletions: 2, status: 'M', untracked: false }],
    ['package.json', { additions: 3, deletions: 1, status: 'M', untracked: false }],
]);
const importSpecs = new Map();
for (const f of files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) || f.startsWith('node_modules')) continue;
    try { importSpecs.set(f, extractImportSpecs(fs.readFileSync(path.join(repo, f), 'utf8'))); } catch { /* skip */ }
}

const input = {
    files, changes, viewed: new Set(), comments: new Map(), contents: new Map(),
    importSpecs, root: '', exclude: ['node_modules', 'out', '.git'],
};
const p1 = buildArchMap(input);
const p2 = buildArchMap(input);

let fail = 0;
const err = (m) => { console.error('FAIL:', m); fail++; };

// 4. determinism
if (JSON.stringify(p1) !== JSON.stringify(p2)) err('layout not deterministic');

const nodes = p1.nodes;
const dirs = new Map(nodes.filter((n) => n.dir).map((n) => [n.path, n]));
const filesN = nodes.filter((n) => !n.dir && n.path);

// 1 + 6: sphere on ring, file z == dir z
const parentDir = (fp) => {
    let p = fp;
    for (;;) {
        const cut = p.lastIndexOf('/');
        p = cut === -1 ? '' : p.slice(0, cut);
        if (dirs.has(p)) return dirs.get(p);
        if (p === '') return dirs.get('');
    }
};
let onRing = 0, offRing = 0;
for (const f of filesN) {
    const d = parentDir(f.path);
    if (!d || !d.r) { offRing++; continue; }
    const dist = Math.hypot(f.x - d.x, f.y - d.y);
    if (Math.abs(dist - d.r) > 0.6) { err(`${f.path} off ring: dist ${dist.toFixed(2)} vs ringR ${d.r}`); if (fail > 5) break; }
    else onRing++;
    if (Math.abs(f.z - d.z) > 0.01) err(`${f.path} z ${f.z} != dir z ${d.z}`);
}
console.log(`on-ring files: ${onRing}, unmatched-parent: ${offRing}`);

// 2. neighbour overlap on each ring
const byDir = new Map();
for (const f of filesN) {
    const d = parentDir(f.path);
    if (!d) continue;
    if (!byDir.has(d.path)) byDir.set(d.path, []);
    byDir.get(d.path).push(f);
}
let worstGap = 1e9;
for (const [dp, list] of byDir) {
    const d = dirs.get(dp);
    if (!d || !d.r) continue;
    const withA = list.map((f) => ({ f, a: Math.atan2(f.y - d.y, f.x - d.x) })).sort((x, y) => x.a - y.a);
    for (let i = 0; i < withA.length; i++) {
        const a = withA[i], b = withA[(i + 1) % withA.length];
        if (withA.length === 1) break;
        const cd = Math.hypot(a.f.x - b.f.x, a.f.y - b.f.y);
        const need = a.f.r + b.f.r;
        worstGap = Math.min(worstGap, cd - need);
        if (cd + 0.01 < need) err(`overlap on ring ${dp}: ${a.f.name}+${b.f.name} dist ${cd.toFixed(2)} < ${need.toFixed(2)}`);
    }
}
console.log('worst neighbour clearance:', worstGap === 1e9 ? 'n/a' : worstGap.toFixed(2));

// 3. ring inside boundary
for (const [, d] of dirs) {
    if (!d.r || d.br === undefined) continue;
    const off = Math.hypot(d.x - d.bx, d.y - d.by);
    if (off + d.r > d.br + 0.6) err(`ring of ${d.path || '(root)'} pokes out of boundary: ${(off + d.r).toFixed(1)} > ${d.br}`);
}

// 5. hubs
for (const f of filesN) {
    const should = (f.inDeg || 0) >= 4;
    if (!!f.hub !== should) err(`hub flag wrong on ${f.path}: inDeg ${f.inDeg}, hub ${f.hub}`);
}
const hubs = filesN.filter((f) => f.hub).map((f) => `${f.path}(${f.inDeg})`);
console.log('hubs:', hubs.length ? hubs.join(', ') : 'none');
console.log('nodes:', nodes.length, 'edges:', p1.edges.length, 'maxDepth:', p1.maxDepth, 'v:', p1.v);
console.log(fail ? `${fail} FAILURES` : 'ALL OK');
if (fail) process.exitCode = 1;

// --- Stress: synthetic 500-file nested repo with imports ------------------
(() => {
    const sf = [];
    const dirsSpec = ['src/core', 'src/core/utils', 'src/ui/components', 'src/ui/hooks', 'src/api', 'test/unit', 'test/e2e', 'docs', 'scripts', 'src/deep/a/b/c'];
    let i = 0;
    for (const d of dirsSpec) for (let k = 0; k < 45; k++) sf.push(`${d}/f${(i++).toString().padStart(3, '0')}.ts`);
    for (let k = 0; k < 30; k++) sf.push(`root${k}.ts`);
    const sChanges = new Map();
    for (let k = 0; k < 40; k++) sChanges.set(sf[k * 11], { additions: (k * 37) % 400, deletions: (k * 13) % 90, status: 'M', untracked: false });
    const sSpecs = new Map();
    // f000 gets imported by 30 files -> definite hub
    for (let k = 1; k <= 30; k++) sSpecs.set(`src/core/f${k.toString().padStart(3, '0')}.ts`, ['./f000']);
    const sIn = { files: sf, changes: sChanges, viewed: new Set(), comments: new Map(), contents: new Map(), importSpecs: sSpecs, root: '', exclude: [] };
    const P = buildArchMap(sIn);
    const N = P.nodes, D = new Map(N.filter((n) => n.dir).map((n) => [n.path, n]));
    const F = N.filter((n) => !n.dir && n.path);
    let bad = 0;
    const pd = (fp) => { let p = fp; for (;;) { const c = p.lastIndexOf('/'); p = c === -1 ? '' : p.slice(0, c); if (D.has(p)) return D.get(p); if (!p) return D.get(''); } };
    for (const f of F) {
        const d = pd(f.path);
        const dist = Math.hypot(f.x - d.x, f.y - d.y);
        if (Math.abs(dist - d.r) > 0.6) { console.error('STRESS off-ring', f.path, dist.toFixed(2), d.r); bad++; }
    }
    const byD = new Map();
    for (const f of F) { const d = pd(f.path); (byD.get(d.path) || byD.set(d.path, []).get(d.path)).push(f); }
    let worst = 1e9;
    for (const [dp, list] of byD) {
        const d = D.get(dp); if (!d || !d.r || list.length < 2) continue;
        const wa = list.map((f) => ({ f, a: Math.atan2(f.y - d.y, f.x - d.x) })).sort((x, y) => x.a - y.a);
        for (let j = 0; j < wa.length; j++) {
            const a = wa[j], b = wa[(j + 1) % wa.length];
            const cd = Math.hypot(a.f.x - b.f.x, a.f.y - b.f.y), need = a.f.r + b.f.r;
            worst = Math.min(worst, cd - need);
            if (cd + 0.01 < need) { console.error('STRESS overlap', dp, a.f.name, b.f.name, cd.toFixed(2), need.toFixed(2)); bad++; }
        }
    }
    const hub = F.find((f) => f.path === 'src/core/f000.ts');
    if (!hub || !hub.hub || hub.inDeg !== 30) { console.error('STRESS hub wrong:', hub && hub.inDeg, hub && hub.hub); bad++; }
    // z bands: deeper dirs sit higher
    const deep = D.get('src/deep/a/b/c'), shallow = D.get('docs');
    if (deep && shallow && deep.z <= shallow.z) { console.error('STRESS z bands wrong', deep.z, shallow.z); bad++; }
    console.log('STRESS files:', F.length, 'worst clearance:', worst.toFixed(2), 'hub inDeg:', hub && hub.inDeg, 'deep z:', deep && deep.z, 'shallow z:', shallow && shallow.z);
    console.log(bad ? 'STRESS FAIL ' + bad : 'STRESS OK');
    if (bad) process.exitCode = 1;
})();
