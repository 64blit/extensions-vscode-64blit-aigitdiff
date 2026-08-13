// === Code Map renderer — "orbital" design ================================
// Every folder is a horizontal ring (an orbit) floating at a height set by
// its depth; the folder's files are spheres resting on the ring. Child
// folders pack inside the parent's boundary circle, so nesting reads as
// orbits within orbits. Visual channels:
//   position   = where the file lives (its folder's orbit)
//   height     = folder depth (deeper = higher) — changed files float above
//   hue        = what git says happened (added/modified/deleted/renamed)
//   halo       = violet ring: imported often (a hub) · colored ring: verdict
//   lines      = import paths, importer → imported (bright on hover/select)
// Rendering is on-demand: frames draw only while something moves.
// Data + analysis arrive via window.GitMap.* calls from the main script;
// user intents go back through window.__gdvMapBridge. The anchored diff
// panel (#map-panel) is filled by the main script; this module only keeps
// it glued to its sphere on screen. ===
import * as THREE from 'three';

const bridge = window.__gdvMapBridge || {};
const wrap = document.getElementById('map-canvas-wrap');
const tooltipEl = document.getElementById('map-tooltip');
const cardEl = document.getElementById('map-card');
const progressEl = document.getElementById('map-progress');
const mapViewEl = document.getElementById('map-view');
const panelEl = document.getElementById('map-panel');
const connectorEl = document.getElementById('map-connector');
const connectorLine = document.getElementById('map-connector-line');
const isLight = document.body.classList.contains('vscode-light');

const PAL = isLight ? {
    dir: 0x9aa1a9, file: 0xb6bcc2, bgMix: 0xf3f3f3,
    viewed: 0x57ab5a, edge: 0x0969da, edgeTo: 0x8250df, hub: 0x8250df, linkIn: 0xbc4c00,
    label: '#1f2328', labelAccent: '#0969da', labelDim: '#6e7781', pill: 'rgba(255,255,255,0.9)',
    addTxt: '#1a7f37', delTxt: '#cf222e',
} : {
    dir: 0x343b44, file: 0x4b545e, bgMix: 0x14181c,
    viewed: 0x2ea043, edge: 0x39c5cf, edgeTo: 0xc678dd, hub: 0xc678dd, linkIn: 0xffa657,
    label: '#f0f6fc', labelAccent: '#7ee2eb', labelDim: '#8b949e', pill: 'rgba(8,12,16,0.78)',
    addTxt: '#7ee787', delTxt: '#ffa198',
};
// Sphere hue by git status. Untracked reads as added.
const STATUS_COL = { A: 0x3fb950, '?': 0x3fb950, D: 0xf85149, R: 0x58a6ff, C: 0x58a6ff, M: 0xd29922 };
const QUALITY = { clean: 0x2ea043, review: 0xd29922, concern: 0xf85149 };
const LINK_IN = PAL.linkIn; // incoming "imported by" arcs
// Additive glow saturates to invisible white on a light background — use
// normal blending there, with stronger opacity to compensate.
const GLOW_BLEND = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;

// Height tuning: payload z is layout units (depth * 30 ± jitter); scale to
// world so orbit planes separate clearly. Changed files float above their
// orbit so the changeset reads as one raised constellation.
const ZSCALE = 1.6;
const RAISE = 10;

let renderer = null, scene = null, camera = null, raycaster = null;
let changedMesh = null, baseMesh = null, ringMeshI = null, discMesh = null, rootGroup = null;
let verdictMesh = null, hubMesh = null, hubNodes = [];
let labelGroup = null, dirLabelGroup = null, quietLabelGroup = null, dirNodes = [];
let nodes = [], fileNodes = [], changedNodes = [], baseNodes = [];
let lastPayloadStored = null;
let showAllFiles = true, showAllUserSet = false, framedOnce = false;
let camAnim = null;
let selRing = null, hoverRing = null, hoverPath = null;
let lastPickAt = 0;
let byPath = new Map(), adj = new Map(), analysisByPath = new Map(), labelByPath = new Map();
// Directed import graph: outAdj = "this file imports", inAdj = "imported by".
let outAdj = new Map(), inAdj = new Map();
let linkLines = null;
let quietLabelCache = new Map(); // path -> lazy mini label for unchanged files
let prunedSet = new Set();
let viewedSet = new Set();
let verdictIndexByPath = new Map();
let filter = { text: '', unreviewedOnly: false, dimUnchanged: true, quality: null };
let selectedPath = null, blastSet = null;
let layoutSize = 1200;
let anchorPath = null; // sphere the diff panel is glued to

// Render-on-demand bookkeeping.
let needsRender = true, labelDirty = true, lastCamMoveAt = 0, pulseStart = 0, entranceStart = 0;

function W() { return wrap.clientWidth || 800; }
function H() { return wrap.clientHeight || 500; }
function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function churnOf(n) { return (n.add || 0) + (n.del || 0); }
function isChanged(n) { return n.add !== undefined || n.del !== undefined; }
function statusColor(n) {
    const s = String(n.status || 'M').charAt(0).toUpperCase();
    return STATUS_COL[s] !== undefined ? STATUS_COL[s] : STATUS_COL.M;
}

function worldPos(n) {
    const half = layoutSize / 2;
    const z = n.z * ZSCALE + (!n.dir && isChanged(n) ? RAISE : 0);
    return new THREE.Vector3(n.x - half, half - n.y, z);
}
function boundaryPos(n) {
    const half = layoutSize / 2;
    return new THREE.Vector3((n.bx !== undefined ? n.bx : n.x) - half, half - (n.by !== undefined ? n.by : n.y), n.z * ZSCALE);
}

// === Diff peek =============================================================
// Unified diff -> hunks with their new-file line ranges and body text. Used
// by the hover window so the code at the change is visible without a click.
function parseHunks(diff) {
    const out = [];
    const lines = String(diff || '').split('\n');
    let cur = null, newLn = 0;
    for (const raw of lines) {
        const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(raw);
        if (m) {
            newLn = parseInt(m[1], 10) || 1;
            cur = { start: newLn, end: newLn, adds: 0, dels: 0, head: (m[3] || '').trim(), body: [] };
            out.push(cur);
            continue;
        }
        if (!cur) continue;
        const c = raw.charAt(0);
        if (c === '+') { cur.adds++; cur.body.push({ t: '+', s: raw.slice(1) }); cur.end = newLn; newLn++; }
        else if (c === '-') { cur.dels++; cur.body.push({ t: '-', s: raw.slice(1) }); cur.end = newLn; }
        else if (c === ' ') { cur.body.push({ t: ' ', s: raw.slice(1) }); newLn++; }
        else if (c === '\\') { /* "\ No newline at end of file" */ }
        else if (raw.startsWith('diff --git')) { cur = null; }
    }
    return out;
}

let diffCache = new Map(); // path -> { hunks }
function diffModelFor(path) {
    const hit = diffCache.get(path);
    if (hit) return hit;
    const raw = bridge.getChange ? bridge.getChange(path) : null;
    const model = { hunks: raw && !raw.binary ? parseHunks(raw.diff) : [] };
    diffCache.set(path, model);
    return model;
}

const HUNK_WINDOW_LINES = 12;

// Compact +/- coloured window over the file's first hunk, centred on its
// first changed line — a peek, not the full diff (that's the click).
function hunkWindowHtml(path) {
    const model = diffModelFor(path);
    const h = model.hunks[0];
    if (!h || !h.body.length) return '';
    let first = h.body.findIndex((l) => l.t !== ' ');
    if (first < 0) first = 0;
    let from = Math.max(0, first - 3);
    let to = Math.min(h.body.length, from + HUNK_WINDOW_LINES);
    from = Math.max(0, to - HUNK_WINDOW_LINES);
    let html = '<div class="t-hunk"><div class="th-head">@@ line ' + h.start
        + ' · <span style="color:' + PAL.addTxt + '">+' + h.adds + '</span> <span style="color:' + PAL.delTxt + '">−' + h.dels + '</span>'
        + (model.hunks.length > 1 ? ' · 1/' + model.hunks.length + ' hunks' : '')
        + (h.head ? ' · ' + esc(h.head.slice(0, 36)) : '') + '</div>';
    for (let i = from; i < to; i++) {
        const l = h.body[i];
        const cls = l.t === '+' ? 'th-add' : l.t === '-' ? 'th-del' : 'th-ctx';
        html += '<div class="th-line ' + cls + '">' + esc(l.t + l.s.slice(0, 78)) + '</div>';
    }
    const rest = h.body.length - to;
    if (rest > 0) html += '<div class="th-more">+' + rest + ' more lines — click the sphere for the full diff</div>';
    return html + '</div>';
}

// === Camera ================================================================
// Fixed-isometric: tilt is constant, yaw only sits on 4 snap angles, so the
// board never ends up at an attitude the user has to fight out of.
// Drag pans, wheel zooms, Q/E rotate.
const ISO_PHI = 0.95;
let camTheta = 0, camPhi = ISO_PHI, camDist = 1500;
const camTarget = new THREE.Vector3(0, 0, 0);

function applyCamera() {
    if (!camera) return;
    const sp = Math.sin(camPhi), cp = Math.cos(camPhi);
    camera.position.set(
        camTarget.x + camDist * sp * Math.sin(camTheta),
        camTarget.y - camDist * sp * Math.cos(camTheta),
        camTarget.z + camDist * cp
    );
    camera.up.set(0, 0, 1);
    camera.lookAt(camTarget);
    lastCamMoveAt = performance.now();
    labelDirty = true;
    needsRender = true;
}

function flyTo(to, dur) {
    camAnim = {
        from: { theta: camTheta, phi: camPhi, dist: camDist, x: camTarget.x, y: camTarget.y, z: camTarget.z },
        to,
        start: performance.now(),
        dur: dur || 550,
    };
    needsRender = true;
}

function stepCamAnim(now) {
    if (!camAnim) return;
    const k = Math.min(1, (now - camAnim.start) / camAnim.dur);
    const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k; // ease in-out
    const f = camAnim.from, t = camAnim.to;
    camTheta = f.theta + ((t.theta !== undefined ? t.theta : f.theta) - f.theta) * e;
    camPhi = f.phi + ((t.phi !== undefined ? t.phi : f.phi) - f.phi) * e;
    camDist = f.dist + ((t.dist !== undefined ? t.dist : f.dist) - f.dist) * e;
    camTarget.set(
        f.x + ((t.x !== undefined ? t.x : f.x) - f.x) * e,
        f.y + ((t.y !== undefined ? t.y : f.y) - f.y) * e,
        f.z + ((t.z !== undefined ? t.z : f.z) - f.z) * e
    );
    applyCamera();
    if (k >= 1) camAnim = null;
}

// Frame the changeset (or everything when the tree is clean).
function frameChangeset() {
    const pool = changedNodes.length ? changedNodes : fileNodes;
    if (!pool.length || !camera) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, sumZ = 0, maxR = 0;
    for (const n of pool) {
        const p = worldPos(n);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        sumZ += p.z;
        if (n.r > maxR) maxR = n.r;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = sumZ / pool.length;
    const span = Math.max(maxX - minX, maxY - minY) / 2 + maxR * 3 + 40;
    const dist = Math.max(280, Math.min(6500, span / Math.tan(camera.fov * Math.PI / 360) * 1.15));
    flyTo({ theta: camTheta, phi: ISO_PHI, dist, x: cx, y: cy, z: cz * 0.7 }, 650);
}

function flyToNode(n) {
    const p = worldPos(n);
    select(n);
    flyTo({ theta: camTheta, phi: ISO_PHI, dist: Math.max(240, Math.min(900, n.r * 16)), x: p.x, y: p.y, z: p.z * 0.6 }, 500);
}

// Snap yaw 90° at a time — the only rotation the user gets.
function rotateSnap(dir) {
    const step = Math.PI / 2;
    const target = Math.round(camTheta / step) * step + (dir >= 0 ? step : -step);
    flyTo({ theta: target, phi: ISO_PHI, dist: camDist, x: camTarget.x, y: camTarget.y, z: camTarget.z }, 380);
}

// Fly to the next (dir=1) / previous (dir=-1) unreviewed changed file.
function nextUnreviewed(dir) {
    if (!changedNodes.length) return;
    let pool = changedNodes.filter((n) => !viewedSet.has(n.path));
    if (!pool.length) pool = changedNodes.slice();
    pool.sort((a, b) => a.path.localeCompare(b.path));
    let idx = pool.findIndex((n) => n.path === selectedPath);
    idx = idx === -1 ? (dir > 0 ? 0 : pool.length - 1) : (idx + dir + pool.length) % pool.length;
    flyToNode(pool[idx]);
}

// === Labels ================================================================
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// High-res pill label: bold name on top, accent word/stats underneath.
// plain=true drops the pill (stroked text only) — used for folder names so
// they read as background wayfinding, not content.
function drawLabel(canvas, line1, line2, accent, plain) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    const t1 = String(line1 || '').slice(0, 24);
    const t2 = String(line2 || '').slice(0, 24);
    if (!t1 && !t2) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (plain) {
        ctx.lineWidth = 9;
        ctx.strokeStyle = PAL.pill;
        ctx.font = '700 42px system-ui, sans-serif';
        if (t2) {
            ctx.strokeText(t1, 256, 42);
            ctx.fillStyle = PAL.label;
            ctx.fillText(t1, 256, 42);
            ctx.font = '600 30px system-ui, sans-serif';
            ctx.strokeText(t2, 256, 90);
            ctx.fillStyle = accent || PAL.labelAccent;
            ctx.fillText(t2, 256, 90);
        } else {
            ctx.strokeText(t1, 256, 66);
            ctx.fillStyle = PAL.label;
            ctx.fillText(t1, 256, 66);
        }
        return;
    }
    ctx.fillStyle = PAL.pill;
    roundRect(ctx, 2, 2, 508, 124, 30);
    ctx.fill();
    if (t2) {
        ctx.font = '700 44px system-ui, sans-serif';
        ctx.fillStyle = PAL.label;
        ctx.fillText(t1, 256, 42);
        ctx.font = '600 34px system-ui, sans-serif';
        ctx.fillStyle = accent || PAL.labelAccent;
        ctx.fillText(t2, 256, 91);
    } else {
        ctx.font = '700 48px system-ui, sans-serif';
        ctx.fillStyle = PAL.label;
        ctx.fillText(t1, 256, 66);
    }
}

function qualityAccent(a) {
    if (!a || !a.quality) return PAL.labelAccent;
    if (a.quality === 'clean') return '#2ea043';
    if (a.quality === 'review') return '#d29922';
    if (a.quality === 'concern') return '#f85149';
    return PAL.labelAccent;
}

function makeLabelSprite(line1, line2, accent, plain) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    drawLabel(canvas, line1, line2, accent, plain);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 20;
    sprite.userData.canvas = canvas;
    return sprite;
}

// Small stroked name for unchanged files — appears only when zoomed close.
function makeMiniLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = PAL.pill;
    ctx.font = '600 26px system-ui, sans-serif';
    const t = String(text || '').slice(0, 20);
    ctx.strokeText(t, 128, 32);
    ctx.fillStyle = PAL.labelDim;
    ctx.fillText(t, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0.85 });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 18;
    return sprite;
}

// Screen-space label pass: LOD (hide labels whose node is tiny on screen),
// lazily build names for unchanged files when zoomed close, then greedily
// suppress overlaps by priority. Runs only when the camera settles.
function updateLabelVisibility() {
    if (!camera || !renderer) return;
    camera.updateMatrixWorld();
    const halfH = H() / 2, halfW = W() / 2;
    const tanF = Math.tan(camera.fov * Math.PI / 360);
    const camP = camera.position;
    const v = new THREE.Vector3();
    const items = [];
    const measure = (p, r, minPx) => {
        const dist = camP.distanceTo(p);
        if (dist <= 1) return null;
        const screenR = (r * halfH) / (dist * tanF);
        if (screenR < minPx) return null;
        v.set(p.x, p.y, p.z).project(camera);
        if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) return null;
        return { sx: v.x * halfW + halfW, sy: -v.y * halfH + halfH, screenR };
    };
    const collect = (sprite, minPx, priBase) => {
        const n = sprite.userData.node;
        if (!n || sprite.userData.wOk === false) { sprite.visible = false; return; }
        const m = measure(sprite.position, Math.max(n.r, 6), minPx);
        if (!m) { sprite.visible = false; return; }
        const w = Math.max(62, Math.min(280, m.screenR * 2.8));
        const pri = (blastSet && blastSet.has(n.path) ? 1000 : 0) + priBase
            + (n.dir ? -n.depth * 12 : Math.min(99, churnOf(n)))
            + m.screenR * 0.01;
        items.push({ sprite, sx: m.sx, sy: m.sy, w, h: 26, pri });
    };
    if (labelGroup) for (const s of labelGroup.children) collect(s, 10, 220);
    if (dirLabelGroup) for (const s of dirLabelGroup.children) collect(s, 15, 100);

    // Unchanged files: name appears once the node is comfortably readable.
    const usedQuiet = new Set();
    if (quietLabelGroup) {
        for (const n of baseNodes) {
            // 0.15: below every filter-miss weight (0.1/0.12/0.13) but above
            // the plain dim-unchanged 0.2 — dimmed files still get names
            // when zoomed close, filtered-out files never do.
            if (prunedSet.has(n.path) || weightOf(n) < 0.15) continue;
            const p = worldPos(n);
            const m = measure(p, Math.max(n.r, 6), 16);
            if (!m) continue;
            let sprite = quietLabelCache.get(n.path);
            if (!sprite) {
                sprite = makeMiniLabel(n.name);
                sprite.userData.node = n;
                sprite.position.set(p.x, p.y, p.z + n.r + 6);
                const wWorld = Math.max(16, Math.min(60, n.r * 2.2));
                sprite.scale.set(wWorld, wWorld * 0.25, 1);
                quietLabelGroup.add(sprite);
                quietLabelCache.set(n.path, sprite);
            }
            usedQuiet.add(n.path);
            const w = Math.max(50, Math.min(180, m.screenR * 2.2));
            items.push({ sprite, sx: m.sx, sy: m.sy, w, h: 20, pri: 10 + m.screenR * 0.01 });
        }
        for (const entry of quietLabelCache) {
            if (!usedQuiet.has(entry[0])) entry[1].visible = false;
        }
        // Evict off-screen minis when the cache grows — textures are the cost.
        if (quietLabelCache.size > 350) {
            for (const entry of quietLabelCache) {
                if (usedQuiet.has(entry[0])) continue;
                const sprite = entry[1];
                quietLabelGroup.remove(sprite);
                if (sprite.material.map) sprite.material.map.dispose();
                sprite.material.dispose();
                quietLabelCache.delete(entry[0]);
                if (quietLabelCache.size <= 350) break;
            }
        }
    }

    items.sort((a, b) => b.pri - a.pri);
    const kept = [];
    for (const it of items) {
        let hit = false;
        for (const k of kept) {
            if (Math.abs(it.sx - k.sx) * 2 < (it.w + k.w) && Math.abs(it.sy - k.sy) * 2 < (it.h + k.h) + 8) { hit = true; break; }
        }
        it.sprite.visible = !hit;
        if (!hit) kept.push(it);
    }
}

// === Scene lifecycle =======================================================
function initThree() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W(), H());
    wrap.insertBefore(renderer.domElement, tooltipEl);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PAL.bgMix, 2600, 9000);
    camera = new THREE.PerspectiveCamera(50, W() / Math.max(1, H()), 2, 14000);
    applyCamera();
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(-600, -900, 1300);
    scene.add(sun);
    raycaster = new THREE.Raycaster();
    bindInput();
    const loop = () => {
        requestAnimationFrame(loop);
        if (!document.body.classList.contains('map-mode')) return;
        const now = performance.now();
        stepCamAnim(now);
        if (entranceStart) {
            const k = Math.min(1, (now - entranceStart) / 420);
            const e = 1 - (1 - k) * (1 - k);
            if (rootGroup) rootGroup.scale.setScalar(0.94 + 0.06 * e);
            if (k >= 1) { entranceStart = 0; if (rootGroup) rootGroup.scale.setScalar(1); }
            needsRender = true;
        }
        // Selection pulse: decaying ring wobble that settles after ~1.6s.
        if (selRing && selRing.visible && pulseStart) {
            const t = (now - pulseStart) / 1600;
            const n = selectedPath ? byPath.get(selectedPath) : null;
            if (t >= 1 || !n) {
                pulseStart = 0;
                if (n) selRing.scale.set(n.r * 1.55, n.r * 1.55, 1);
                selRing.material.opacity = 0.55;
            } else {
                const damp = 1 - t;
                const s = 1 + Math.sin(t * 12.5) * 0.12 * damp;
                selRing.scale.set(n.r * 1.55 * s, n.r * 1.55 * s, 1);
                selRing.material.opacity = 0.55 + 0.35 * damp;
            }
            needsRender = true;
        }
        if (labelDirty && !camAnim && now - lastCamMoveAt > 140) {
            updateLabelVisibility();
            labelDirty = false;
            needsRender = true;
        }
        if (needsRender) {
            renderer.render(scene, camera);
            needsRender = false;
            positionPanel();
        }
    };
    requestAnimationFrame(loop);
    if (window.ResizeObserver) new ResizeObserver(() => api.resize()).observe(wrap);
}

function disposeTree(obj) {
    obj.traverse((o) => {
        // InstancedMesh keeps instanceMatrix/instanceColor GPU buffers that
        // only its own dispose() releases — geometry.dispose() won't.
        if (o.isInstancedMesh) o.dispose();
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
        }
    });
}

function setData(payload) {
    initThree();
    if (rootGroup) { scene.remove(rootGroup); disposeTree(rootGroup); }
    rootGroup = new THREE.Group();
    scene.add(rootGroup);
    quietLabelCache = new Map();
    diffCache = new Map(); // diffs move with every refresh
    hoverPath = null;
    linkLines = null; // owned by the old rootGroup, already disposed above

    selRing = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.06, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })
    );
    selRing.visible = false;
    selRing.renderOrder = 15;
    rootGroup.add(selRing);

    hoverRing = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.045, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })
    );
    hoverRing.visible = false;
    hoverRing.renderOrder = 14;
    rootGroup.add(hoverRing);

    lastPayloadStored = payload;
    if (!showAllUserSet) showAllFiles = (payload.shownFiles || 0) <= 120;
    const allCb = document.getElementById('map-all-cb');
    if (allCb) allCb.checked = showAllFiles;

    layoutSize = payload.size || 1200;
    nodes = payload.nodes || [];
    fileNodes = nodes.filter((n) => !n.dir && n.path);
    changedNodes = fileNodes.filter(isChanged);
    byPath = new Map();
    for (const n of fileNodes) byPath.set(n.path, n);
    viewedSet = new Set(changedNodes.filter((n) => n.viewed).map((n) => n.path));
    labelByPath = new Map();
    verdictIndexByPath = new Map();
    selectedPath = null; blastSet = null;
    anchorPath = null;
    hideCard(); hideTooltip();

    // Quiet-zone pruning: unchanged files inside change-free directories stay
    // hidden (count on the folder label) unless "All files".
    const dirPathSet = new Set();
    const quietDirSet = new Set();
    for (const n of nodes) {
        if (n.dir && n.path) {
            dirPathSet.add(n.path);
            if (n.quiet) quietDirSet.add(n.path);
        }
    }
    const isPruned = (n) => {
        if (showAllFiles || isChanged(n)) return false;
        let p = n.path;
        for (;;) {
            const cut = p.lastIndexOf('/');
            if (cut === -1) return false;
            p = p.slice(0, cut);
            if (dirPathSet.has(p)) return quietDirSet.has(p);
        }
    };
    prunedSet = new Set();
    for (const n of fileNodes) if (isPruned(n)) prunedSet.add(n.path);
    // A hot import arc must land on a visible sphere: un-prune any quiet-zone
    // file that a changed file imports (or that imports one).
    for (const e of payload.edges || []) {
        if (!e.hot) continue;
        const a = nodes[e.from], b = nodes[e.to];
        if (a) prunedSet.delete(a.path);
        if (b) prunedSet.delete(b.path);
    }

    // --- Orbits: one torus ring per folder that has direct files ----------
    const dirs = nodes.filter((n) => n.dir && n.depth > 0);
    dirNodes = dirs;
    const ringDirs = dirs.filter((d) => d.r > 0);
    const bgCol = new THREE.Color(PAL.bgMix);
    if (ringDirs.length) {
        const torGeo = new THREE.TorusGeometry(1, 0.014, 6, 96);
        ringMeshI = new THREE.InstancedMesh(torGeo, new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false,
        }), ringDirs.length);
        const m = new THREE.Matrix4();
        const col = new THREE.Color();
        for (let i = 0; i < ringDirs.length; i++) {
            const d = ringDirs[i];
            const p = worldPos(d);
            m.makeTranslation(p.x, p.y, p.z);
            m.multiply(new THREE.Matrix4().makeScale(d.r, d.r, 1));
            ringMeshI.setMatrixAt(i, m);
            col.set(PAL.dir).lerp(new THREE.Color(0xffffff), 0.18);
            if (d.quiet) col.lerp(bgCol, 0.45);
            ringMeshI.setColorAt(i, col);
        }
        rootGroup.add(ringMeshI);
    } else {
        ringMeshI = null;
    }

    // Boundary discs: faint glass plates under each folder's territory —
    // they group the nesting visually and give the raycaster a dir target.
    if (dirs.length) {
        const discGeo = new THREE.CircleGeometry(1, 48);
        discMesh = new THREE.InstancedMesh(discGeo, new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: isLight ? 0.07 : 0.05, depthWrite: false, side: THREE.DoubleSide,
        }), dirs.length);
        const m = new THREE.Matrix4();
        const col = new THREE.Color();
        for (let i = 0; i < dirs.length; i++) {
            const d = dirs[i];
            const p = boundaryPos(d);
            m.makeTranslation(p.x, p.y, p.z - 1.5);
            m.multiply(new THREE.Matrix4().makeScale(d.br || d.r || 8, d.br || d.r || 8, 1));
            discMesh.setMatrixAt(i, m);
            col.set(PAL.dir);
            if (d.quiet) col.lerp(bgCol, 0.5);
            discMesh.setColorAt(i, col);
        }
        discMesh.renderOrder = 1;
        rootGroup.add(discMesh);
    } else {
        discMesh = null;
    }

    // Stems: a faint vertical line from each orbit down to its parent's
    // plane — reads as "this orbit hangs off that one".
    {
        const stemPos = [];
        const zOfDir = new Map();
        zOfDir.set('', 0);
        for (const d of dirs) zOfDir.set(d.path, d.z * ZSCALE);
        for (const d of dirs) {
            let parent = d.path;
            let pz = 0;
            for (;;) {
                const cut = parent.lastIndexOf('/');
                parent = cut === -1 ? '' : parent.slice(0, cut);
                if (zOfDir.has(parent)) { pz = zOfDir.get(parent); break; }
                if (!parent) break;
            }
            const p = boundaryPos(d);
            stemPos.push(p.x, p.y, p.z, p.x, p.y, pz);
        }
        if (stemPos.length) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(stemPos, 3));
            const stems = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
                color: PAL.dir, transparent: true, opacity: 0.18, depthWrite: false,
            }));
            stems.renderOrder = 2;
            rootGroup.add(stems);
        }
    }

    // Folder names float above their orbit.
    dirLabelGroup = new THREE.Group();
    for (const d of dirs) {
        const anchorR = Math.max(d.r, (d.br || 0) * 0.6);
        if (anchorR < 12) continue;
        const collapsed = !showAllFiles && d.quiet;
        const sprite = makeLabelSprite(d.name, collapsed && d.files ? d.files + ' files' : null, null, true);
        const p = worldPos(d);
        sprite.position.set(p.x, p.y, p.z + 14 + anchorR * 0.06);
        const wWorld = Math.max(22, Math.min(95, anchorR * 0.8));
        sprite.scale.set(wWorld, wWorld * 0.25, 1);
        sprite.material.opacity = 0.8;
        sprite.userData.node = d;
        dirLabelGroup.add(sprite);
    }
    rootGroup.add(dirLabelGroup);

    // --- Planets: two sphere populations, two draw calls -------------------
    baseNodes = fileNodes.filter((n) => !isChanged(n) && !prunedSet.has(n.path));
    baseMesh = null;
    changedMesh = null;
    if (baseNodes.length) {
        const geo = new THREE.SphereGeometry(1, 12, 9);
        baseMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), baseNodes.length);
        const m = new THREE.Matrix4();
        for (let i = 0; i < baseNodes.length; i++) {
            const n = baseNodes[i];
            const p = worldPos(n);
            m.makeTranslation(p.x, p.y, p.z);
            m.multiply(new THREE.Matrix4().makeScale(n.r, n.r, n.r));
            baseMesh.setMatrixAt(i, m);
        }
        rootGroup.add(baseMesh);
    }
    if (changedNodes.length) {
        const geo = new THREE.SphereGeometry(1, 20, 15);
        changedMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), changedNodes.length);
        const m = new THREE.Matrix4();
        for (let i = 0; i < changedNodes.length; i++) {
            const n = changedNodes[i];
            const p = worldPos(n);
            m.makeTranslation(p.x, p.y, p.z);
            m.multiply(new THREE.Matrix4().makeScale(n.r, n.r, n.r));
            changedMesh.setMatrixAt(i, m);
        }
        rootGroup.add(changedMesh);
    }

    // Hub halos: violet ring around often-imported files — the load-bearing
    // walls of the repo.
    hubNodes = fileNodes.filter((n) => n.hub && !prunedSet.has(n.path));
    hubMesh = null;
    if (hubNodes.length) {
        const geo = new THREE.TorusGeometry(1, 0.07, 6, 40);
        hubMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
            color: PAL.hub, transparent: true, opacity: isLight ? 0.85 : 0.6, depthWrite: false, blending: GLOW_BLEND,
        }), hubNodes.length);
        const m = new THREE.Matrix4();
        for (let i = 0; i < hubNodes.length; i++) {
            const n = hubNodes[i];
            const p = worldPos(n);
            m.makeTranslation(p.x, p.y, p.z);
            const hr = n.r * 1.7;
            m.multiply(new THREE.Matrix4().makeScale(hr, hr, 1));
            hubMesh.setMatrixAt(i, m);
        }
        hubMesh.renderOrder = 8;
        rootGroup.add(hubMesh);
    }

    // Verdict / viewed halo — flat ring around changed spheres.
    if (changedNodes.length) {
        const geo = new THREE.RingGeometry(1.35, 1.6, 40);
        verdictMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
        }), changedNodes.length);
        const m = new THREE.Matrix4();
        for (let i = 0; i < changedNodes.length; i++) {
            const n = changedNodes[i];
            verdictIndexByPath.set(n.path, i);
            const p = worldPos(n);
            m.makeTranslation(p.x, p.y, p.z);
            m.multiply(new THREE.Matrix4().makeScale(n.r, n.r, 1));
            verdictMesh.setMatrixAt(i, m);
            verdictMesh.setColorAt(i, new THREE.Color(PAL.dir));
        }
        rootGroup.add(verdictMesh);
    } else {
        verdictMesh = null;
    }

    // Import edges. Hot (touching a change) glow additive with a
    // direction gradient; cold repo wiring stays faint background structure.
    adj = new Map();
    outAdj = new Map();
    inAdj = new Map();
    const edges = payload.edges || [];
    if (edges.length) {
        const hotPos = [], coldPos = [], hotCol = [];
        const cFrom = new THREE.Color(PAL.edge), cTo = new THREE.Color(PAL.edgeTo), cTmp = new THREE.Color();
        for (const e of edges) {
            const a = nodes[e.from], b = nodes[e.to];
            if (!a || !b) continue;
            if (!adj.has(a.path)) adj.set(a.path, []);
            if (!adj.has(b.path)) adj.set(b.path, []);
            adj.get(a.path).push(b.path);
            adj.get(b.path).push(a.path);
            // Directed too: a imports b. "What breaks if I change b" needs
            // the reverse direction, so keep both maps.
            if (!outAdj.has(a.path)) outAdj.set(a.path, []);
            if (!inAdj.has(b.path)) inAdj.set(b.path, []);
            outAdj.get(a.path).push(b.path);
            inAdj.get(b.path).push(a.path);
            // Cold wiring into pruned quiet zones is dropped (endpoint invisible).
            if (!e.hot && (prunedSet.has(a.path) || prunedSet.has(b.path))) continue;
            const pa = worldPos(a), pb = worldPos(b);
            const mid = pa.clone().add(pb).multiplyScalar(0.5);
            const ctrl = new THREE.Vector3(mid.x, mid.y, Math.max(pa.z, pb.z) + pa.distanceTo(pb) * 0.18 + 10);
            const pts = new THREE.QuadraticBezierCurve3(pa, ctrl, pb).getPoints(16);
            const dst = e.hot ? hotPos : coldPos;
            for (let i = 0; i < pts.length - 1; i++) {
                dst.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
                if (e.hot) {
                    // Direction gradient: importer (cyan) -> imported (purple).
                    cTmp.copy(cFrom).lerp(cTo, i / (pts.length - 1));
                    hotCol.push(cTmp.r, cTmp.g, cTmp.b);
                    cTmp.copy(cFrom).lerp(cTo, (i + 1) / (pts.length - 1));
                    hotCol.push(cTmp.r, cTmp.g, cTmp.b);
                }
            }
        }
        if (coldPos.length) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(coldPos, 3));
            const cold = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
                color: PAL.dir, transparent: true, opacity: 0.06, depthWrite: false,
            }));
            cold.renderOrder = 4;
            rootGroup.add(cold);
        }
        if (hotPos.length) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(hotPos, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(hotCol, 3));
            const hot = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
                // Ambient wiring only — the bright lines are drawn on hover.
                vertexColors: true, transparent: true, opacity: isLight ? 0.45 : 0.22, depthWrite: false, blending: GLOW_BLEND,
            }));
            hot.renderOrder = 5;
            rootGroup.add(hot);
        }
    }

    // Two-line pill labels above every changed node: filename + counts/word.
    labelGroup = new THREE.Group();
    for (const n of changedNodes) {
        const a = analysisByPath.get(n.path);
        const counts = '+' + (n.add || 0) + ' −' + (n.del || 0);
        const sprite = makeLabelSprite(n.name, (a && a.word) || counts, qualityAccent(a));
        const p = worldPos(n);
        sprite.position.set(p.x, p.y, p.z + n.r + 9);
        const wWorld = Math.max(26, Math.min(96, n.r * 3.2));
        sprite.scale.set(wWorld, wWorld * 0.25, 1);
        sprite.userData.node = n;
        labelGroup.add(sprite);
        labelByPath.set(n.path, sprite);
    }
    rootGroup.add(labelGroup);

    quietLabelGroup = new THREE.Group();
    rootGroup.add(quietLabelGroup);

    // One-shot entrance: the whole board settles in with a short ease-out.
    entranceStart = performance.now();
    rootGroup.scale.setScalar(0.94);
    labelDirty = true;
    needsRender = true;

    applyColors();
    updateProgress();

    // First delivery: frame the changeset so the user lands on the action.
    if (!framedOnce) {
        framedOnce = true;
        if (changedNodes.length) frameChangeset();
    }
}

// === Filters / colors ======================================================
function weightOf(n) {
    let w = 1;
    const changed = isChanged(n);
    if (filter.dimUnchanged && !changed) w = 0.2;
    if (filter.unreviewedOnly && changed && viewedSet.has(n.path)) w = 0.15;
    if (filter.text) {
        const q = filter.text.toLowerCase();
        if (n.path.toLowerCase().indexOf(q) === -1) w = Math.min(w, 0.1);
    }
    if (filter.quality) {
        const a = analysisByPath.get(n.path);
        if (!changed || !a || a.quality !== filter.quality) w = Math.min(w, 0.12);
    }
    if (blastSet) w = blastSet.has(n.path) ? Math.max(w, 1) : Math.min(w, 0.13);
    return w;
}

function applyColors() {
    const bg = new THREE.Color(PAL.bgMix);
    if (changedMesh) {
        for (let i = 0; i < changedNodes.length; i++) {
            const n = changedNodes[i];
            const col = new THREE.Color(statusColor(n));
            // Reviewed files step back so remaining work stays brightest.
            if (viewedSet.has(n.path)) col.lerp(bg, 0.45);
            if (n.path === hoverPath) col.lerp(new THREE.Color(0xffffff), 0.2);
            const w = weightOf(n);
            if (w < 1) col.lerp(bg, 0.85 * (1 - w));
            changedMesh.setColorAt(i, col);
        }
        if (changedMesh.instanceColor) changedMesh.instanceColor.needsUpdate = true;
    }
    if (baseMesh) {
        const hubCol = new THREE.Color(PAL.hub);
        for (let i = 0; i < baseNodes.length; i++) {
            const n = baseNodes[i];
            // Non-edited files sit darkened toward the background; hubs keep
            // a violet identity even at rest.
            const col = new THREE.Color(PAL.file).lerp(bg, 0.35);
            if (n.hub) col.lerp(hubCol, 0.45);
            const w = weightOf(n);
            if (w < 1) col.lerp(bg, 0.85 * (1 - w));
            baseMesh.setColorAt(i, col);
        }
        if (baseMesh.instanceColor) baseMesh.instanceColor.needsUpdate = true;
    }
    if (verdictMesh) {
        for (const [p, i] of verdictIndexByPath) {
            const a = analysisByPath.get(p);
            let col = null;
            if (viewedSet.has(p)) col = new THREE.Color(PAL.viewed);
            else if (a && a.quality && QUALITY[a.quality] !== undefined) col = new THREE.Color(QUALITY[a.quality]);
            const n = byPath.get(p);
            const w = n ? weightOf(n) : 1;
            if (!col) col = new THREE.Color(PAL.dir);
            if (w < 1) col.lerp(new THREE.Color(PAL.bgMix), 0.85 * (1 - w));
            verdictMesh.setColorAt(i, col);
        }
        if (verdictMesh.instanceColor) verdictMesh.instanceColor.needsUpdate = true;
    }
    for (const [p, sprite] of labelByPath) {
        const n = byPath.get(p);
        sprite.userData.wOk = !!n && weightOf(n) > 0.5;
    }
    labelDirty = true;
    needsRender = true;
    updateProgress();
}

function updateProgress() {
    if (progressEl) {
        const total = changedNodes.length;
        if (!total) { progressEl.textContent = ''; }
        else {
            let v = 0;
            for (const n of changedNodes) if (viewedSet.has(n.path)) v++;
            progressEl.textContent = v + '/' + total + ' reviewed';
        }
    }
    const qEl = document.getElementById('map-quality');
    if (qEl) {
        const counts = { clean: 0, review: 0, concern: 0 };
        for (const n of changedNodes) {
            const a = analysisByPath.get(n.path);
            if (a && a.quality && counts[a.quality] !== undefined) counts[a.quality]++;
        }
        let html = '';
        for (const q of ['concern', 'review', 'clean']) {
            if (!counts[q]) continue;
            html += '<span class="q-chip q-' + q + (filter.quality === q ? ' on' : '') + '" data-q="' + q + '">' + counts[q] + ' ' + q + '</span>';
        }
        qEl.innerHTML = html;
    }
}

// === Tooltip / card ========================================================
function hideTooltip() { tooltipEl.style.display = 'none'; }
function showTooltip(n, x, y) {
    const a = analysisByPath.get(n.path);
    let html = '<div style="font-weight:600; font-size:13px">' + (n.dir ? '📁 ' : '') + esc(n.name) + '</div>';
    html += '<div class="t-path">' + esc(n.path) + '</div>';
    if (n.dir) {
        if (n.files) html += '<div class="t-meta">' + n.files + ' files' + (n.quiet ? ' · no changes' : '') + ' · double-click to focus</div>';
    } else if (isChanged(n)) {
        html += '<div class="t-meta"><span style="color:#2ea043">+' + (n.add || 0) + '</span> <span style="color:#f85149">-' + (n.del || 0) + '</span>';
        if (a && a.risk) html += ' · risk: ' + esc(a.risk);
        if (a && a.quality) html += ' · ' + esc(a.quality);
        if (viewedSet.has(n.path)) html += ' · ✓ reviewed';
        html += '</div>';
        if (a && a.summary) html += '<div class="t-sum">' + esc(a.summary) + '</div>';
        // The point of the hover: the code at the change.
        html += hunkWindowHtml(n.path);
        const io = linkCounts(n.path);
        if (io.out || io.in) {
            html += '<div class="t-meta">↗ imports ' + io.out + ' · ↙ imported by ' + io.in + (n.hub ? ' · ⬢ hub' : '') + '</div>';
        }
        if (!n.testPair) html += '<div class="t-meta">⚗ no test pair found</div>';
        if (n.comments) html += '<div class="t-meta">💬 ' + n.comments + ' note' + (n.comments === 1 ? '' : 's') + '</div>';
    } else {
        if (n.hub) html += '<div class="t-meta">⬢ hub — imported by ' + (n.inDeg || 0) + ' files</div>';
        const io = linkCounts(n.path);
        if (io.out || io.in) html += '<div class="t-meta">↗ imports ' + io.out + ' · ↙ imported by ' + io.in + '</div>';
    }
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    const rect = wrap.getBoundingClientRect();
    const tw = tooltipEl.offsetWidth || 430;
    const th = tooltipEl.offsetHeight || 200;
    let tx = x - rect.left + 14, ty = y - rect.top + 12;
    // Flip above the cursor when the diff peek would clip at the bottom;
    // clamp to the wrap either way.
    if (ty + th > rect.height - 4) ty = Math.max(4, y - rect.top - th - 12);
    if (tx + tw > rect.width - 4) tx = Math.max(4, x - rect.left - tw - 14);
    // Dodge the open diff panel — the peek must not hide under it.
    if (panelEl && panelEl.classList.contains('open')) {
        const pr = panelEl.getBoundingClientRect();
        const px0 = pr.left - rect.left, px1 = pr.right - rect.left;
        const py0 = pr.top - rect.top, py1 = pr.bottom - rect.top;
        if (tx < px1 && tx + tw > px0 && ty < py1 && ty + th > py0) {
            const leftX = x - rect.left - tw - 14;
            if (leftX >= 4) tx = leftX; else ty = Math.max(4, py0 - th - 8);
        }
    }
    tooltipEl.style.left = tx + 'px';
    tooltipEl.style.top = ty + 'px';
}

function hideCard() { cardEl.style.display = 'none'; }
function showCard(n) {
    const a = analysisByPath.get(n.path) || {};
    let html = '<div class="c-path">' + esc(n.path) + '</div>';
    html += '<div class="c-badges">';
    if (isChanged(n)) html += '<span class="c-badge"><span style="color:#2ea043">+' + (n.add || 0) + '</span> <span style="color:#f85149">-' + (n.del || 0) + '</span></span>';
    if (n.hub) html += '<span class="c-badge" style="color:#c678dd">⬢ hub · ' + (n.inDeg || 0) + '</span>';
    if (a.word) html += '<span class="c-badge">' + esc(a.word) + '</span>';
    if (a.risk) html += '<span class="c-badge">risk: ' + esc(a.risk) + '</span>';
    if (a.quality) html += '<span class="c-badge q-' + esc(a.quality) + '">' + esc(a.quality) + '</span>';
    if (viewedSet.has(n.path)) html += '<span class="c-badge q-clean">✓ reviewed</span>';
    html += '</div>';
    if (a.summary) html += '<div class="c-sum">' + esc(a.summary) + '</div>';
    if (a.flags && a.flags.length) html += '<div class="c-flags">⚑ ' + a.flags.map(esc).join('<br>⚑ ') + '</div>';
    const deps = adj.get(n.path);
    if (deps && deps.length) html += '<div class="c-flags">↯ linked: ' + deps.length + ' file' + (deps.length === 1 ? '' : 's') + ' (highlighted)</div>';
    html += '<div class="c-actions">';
    if (isChanged(n)) html += '<button data-act="diff">Diff</button>';
    html += '<button data-act="open">Open</button>';
    if (isChanged(n)) {
        html += '<button data-act="viewed">' + (viewedSet.has(n.path) ? 'Unmark' : '✓ Reviewed') + '</button>';
        html += '<button data-act="analyze">🔍 Analyze</button>';
    }
    html += '</div>';
    cardEl.innerHTML = html;
    cardEl.style.display = 'block';
    const acts = { diff: () => (bridge.showDiff ? bridge.showDiff(n.path) : bridge.jumpToDiff && bridge.jumpToDiff(n.path)),
        open: () => bridge.openFile && bridge.openFile(n.path),
        viewed: () => toggleViewed(n.path),
        analyze: () => bridge.analyze && bridge.analyze(n.path) };
    for (const btn of cardEl.querySelectorAll('button')) {
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); const f = acts[btn.getAttribute('data-act')]; if (f) f(); });
    }
}

function toggleViewed(p) {
    const nowViewed = !viewedSet.has(p);
    if (nowViewed) viewedSet.add(p); else viewedSet.delete(p);
    if (bridge.setViewed) bridge.setViewed(p, nowViewed);
    const n = byPath.get(p);
    if (n && selectedPath === p) showCard(n);
    applyColors();
}

// === Relationship lines ====================================================
function linkCounts(p) {
    return { out: (outAdj.get(p) || []).length, in: (inAdj.get(p) || []).length };
}

// Bright relationship arcs for one file, built on demand. Outgoing (this file
// imports X) run cyan->purple; incoming (X imports this file — the blast
// radius) run amber. Everything else stays ambient, so no hairball.
function showLinks(p) {
    if (linkLines) {
        rootGroup.remove(linkLines);
        disposeTree(linkLines);
        linkLines = null;
    }
    const centre = p ? byPath.get(p) : null;
    if (!centre) { needsRender = true; return; }
    const pos = [], col = [];
    const cA = new THREE.Color(), cB = new THREE.Color(), cTmp = new THREE.Color();
    const arc = (from, to, fromCol, toCol) => {
        if (!from || !to) return;
        const pa = worldPos(from), pb = worldPos(to);
        pa.z += from.r; pb.z += to.r;
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        const ctrl = new THREE.Vector3(mid.x, mid.y, Math.max(pa.z, pb.z) + pa.distanceTo(pb) * 0.22 + 14);
        const pts = new THREE.QuadraticBezierCurve3(pa, ctrl, pb).getPoints(20);
        cA.set(fromCol); cB.set(toCol);
        for (let i = 0; i < pts.length - 1; i++) {
            pos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
            cTmp.copy(cA).lerp(cB, i / (pts.length - 1));
            col.push(cTmp.r, cTmp.g, cTmp.b);
            cTmp.copy(cA).lerp(cB, (i + 1) / (pts.length - 1));
            col.push(cTmp.r, cTmp.g, cTmp.b);
        }
    };
    for (const t of outAdj.get(p) || []) arc(centre, byPath.get(t), PAL.edge, PAL.edgeTo);
    for (const s of inAdj.get(p) || []) arc(byPath.get(s), centre, LINK_IN, LINK_IN);
    if (!pos.length) { needsRender = true; return; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    linkLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false,
        blending: GLOW_BLEND,
    }));
    linkLines.renderOrder = 12;
    rootGroup.add(linkLines);
    needsRender = true;
}

// === Selection =============================================================
function select(n) {
    selectedPath = n ? n.path : null;
    if (selRing) {
        selRing.visible = !!n;
        if (n) {
            const p = worldPos(n);
            selRing.position.copy(p);
            selRing.scale.set(n.r * 1.55, n.r * 1.55, 1);
            pulseStart = performance.now();
        } else {
            pulseStart = 0;
        }
    }
    if (!n) {
        blastSet = null;
        hideCard();
        if (anchorPath) { anchorPath = null; if (bridge.hidePanel) bridge.hidePanel(); }
        showLinks(hoverPath);
        applyColors();
        return;
    }
    // Blast radius = who reaches this file, 2 hops max. An unbounded walk over
    // the undirected graph lights up the whole repo and says nothing.
    blastSet = new Set([n.path]);
    let frontier = [n.path];
    for (let hop = 0; hop < 2; hop++) {
        const next = [];
        for (const cur of frontier) {
            for (const p of (inAdj.get(cur) || []).concat(outAdj.get(cur) || [])) {
                if (blastSet.has(p)) continue;
                blastSet.add(p);
                next.push(p);
            }
        }
        frontier = next;
    }
    showCard(n);
    showLinks(n.path);
    applyColors();
}

// === Picking / input =======================================================
function pick(e) {
    if (!raycaster || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    if (changedMesh) {
        const hits = raycaster.intersectObject(changedMesh);
        if (hits.length && hits[0].instanceId !== undefined && hits[0].instanceId !== null) {
            return changedNodes[hits[0].instanceId];
        }
    }
    if (baseMesh) {
        const hits = raycaster.intersectObject(baseMesh);
        if (hits.length && hits[0].instanceId !== undefined && hits[0].instanceId !== null) {
            return baseNodes[hits[0].instanceId];
        }
    }
    if (discMesh) {
        const hits = raycaster.intersectObject(discMesh);
        if (hits.length) {
            // Smallest (deepest) folder wins visually; instances are
            // draw-order, so walk all hits and prefer the smallest boundary.
            let best = null;
            for (const h of hits) {
                if (h.instanceId === undefined || h.instanceId === null) continue;
                const d = dirNodes[h.instanceId];
                if (d && (!best || (d.br || d.r) < (best.br || best.r))) best = d;
            }
            return best;
        }
    }
    return null;
}

function setHover(n) {
    const p = n && !n.dir ? n.path : null;
    if (p === hoverPath) return;
    hoverPath = p;
    // Relationship lines follow the cursor; selection keeps them pinned.
    showLinks(p || selectedPath);
    applyColors();
    if (!hoverRing) return;
    if (p) {
        const wp = worldPos(n);
        hoverRing.position.copy(wp);
        const hr = n.r * 1.45;
        hoverRing.scale.set(hr, hr, 1);
        hoverRing.visible = true;
    } else {
        hoverRing.visible = false;
    }
    needsRender = true;
}

let lastHoverEvent = null, trailingPick = null;
function hoverAt(e) {
    const n = pick(e);
    setHover(n);
    renderer.domElement.style.cursor = n && !n.dir ? 'pointer' : '';
    // The anchored panel already shows this file — a tooltip on top is noise.
    const panelHasIt = n && anchorPath === n.path && panelEl && panelEl.classList.contains('open');
    if (n && !panelHasIt) showTooltip(n, e.clientX, e.clientY); else hideTooltip();
}

function bindInput() {
    const el = renderer.domElement;
    let dragging = false, moved = 0, lastX = 0, lastY = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
        camAnim = null; // user takes the wheel
        // A pending trailing hover pick would fire mid-drag with pre-drag
        // coordinates against a panned camera — kill it.
        if (trailingPick) { clearTimeout(trailingPick); trailingPick = null; }
        lastHoverEvent = null;
        dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
        wrap.classList.add('dragging');
        el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointercancel', () => {
        // Interrupted pointer stream (touch/pen/OS) — never leave the board
        // stuck in drag mode.
        dragging = false;
        wrap.classList.remove('dragging');
        if (trailingPick) { clearTimeout(trailingPick); trailingPick = null; }
    });
    el.addEventListener('pointermove', (e) => {
        if (dragging) {
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            moved += Math.abs(dx) + Math.abs(dy);
            lastX = e.clientX; lastY = e.clientY;
            // Fixed isometric: drag always pans. Free orbit made the board
            // impossible to hold in your head — rotation is Q/E snaps only.
            const panScale = camDist * 0.0014;
            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            const upv = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
            camTarget.addScaledVector(right, -dx * panScale);
            camTarget.addScaledVector(upv, dy * panScale);
            applyCamera();
            hideTooltip();
        } else {
            const now = performance.now();
            lastHoverEvent = { clientX: e.clientX, clientY: e.clientY };
            if (now - lastPickAt < 40) {
                // Throttled — but re-pick at the trailing edge so the hover
                // never sticks to a point the cursor merely passed through.
                if (!trailingPick) {
                    trailingPick = setTimeout(() => {
                        trailingPick = null;
                        if (lastHoverEvent) hoverAt(lastHoverEvent);
                    }, 48);
                }
                return;
            }
            lastPickAt = now;
            hoverAt(e);
        }
    });
    el.addEventListener('pointerup', (e) => {
        wrap.classList.remove('dragging');
        if (dragging && moved < 6 && e.button !== 2) {
            const n = pick(e);
            if (!n) { select(null); }
            else if (n.dir) { select(null); }
            else {
                select(n);
                if (isChanged(n) && bridge.showDiff) bridge.showDiff(n.path);
            }
        }
        dragging = false;
    });
    el.addEventListener('dblclick', (e) => {
        const n = pick(e);
        if (n && n.dir && bridge.setRoot) bridge.setRoot(n.path);
    });
    el.addEventListener('wheel', (e) => {
        e.preventDefault();
        camDist = Math.max(180, Math.min(7000, camDist * Math.pow(1.0016, e.deltaY)));
        applyCamera();
    }, { passive: false });
    el.addEventListener('pointerleave', () => {
        if (trailingPick) { clearTimeout(trailingPick); trailingPick = null; }
        lastHoverEvent = null;
        hideTooltip();
        setHover(null);
    });
}

// === Anchored diff panel ===================================================
// The main script fills #map-panel; this keeps it glued next to its sphere
// with a connector line, re-projected every rendered frame.
function positionPanel() {
    if (!panelEl || !anchorPath || !camera || !panelEl.classList.contains('open')) {
        if (connectorEl) connectorEl.style.display = 'none';
        return;
    }
    const n = byPath.get(anchorPath);
    if (!n) { if (connectorEl) connectorEl.style.display = 'none'; return; }
    const p = worldPos(n);
    p.z += n.r;
    const v = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(rootGroup ? rootGroup.matrixWorld : new THREE.Matrix4()).project(camera);
    const w = W(), h = H();
    const behind = v.z > 1;
    if (behind) {
        // Behind the camera the projection mirrors — freeze the panel where
        // it was instead of teleporting it to garbage coordinates.
        if (connectorEl) connectorEl.style.display = 'none';
        return;
    }
    const sx = (v.x + 1) / 2 * w;
    const sy = (1 - v.y) / 2 * h;
    const pw = panelEl.offsetWidth || 460;
    const ph = panelEl.offsetHeight || 300;
    // Prefer the right of the sphere; flip left when it would overflow.
    let px = sx + 26;
    if (px + pw > w - 8) px = sx - 26 - pw;
    px = Math.max(8, Math.min(w - pw - 8, px));
    let py = sy - ph * 0.35;
    py = Math.max(8, Math.min(h - ph - 8, py));
    panelEl.style.left = px + 'px';
    panelEl.style.top = py + 'px';
    if (connectorEl && connectorLine) {
        if (behind || sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) {
            connectorEl.style.display = 'none';
        } else {
            connectorEl.style.display = 'block';
            connectorEl.setAttribute('width', String(w));
            connectorEl.setAttribute('height', String(h));
            connectorEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
            // Attach to the nearer vertical edge of the panel.
            const ex = sx < px ? px : px + pw;
            const ey = Math.max(py + 14, Math.min(py + ph - 14, sy));
            connectorLine.setAttribute('x1', String(sx));
            connectorLine.setAttribute('y1', String(sy));
            connectorLine.setAttribute('x2', String(ex));
            connectorLine.setAttribute('y2', String(ey));
        }
    }
}

// === Public API ============================================================
const api = {
    setData,
    analysis(p, result) {
        analysisByPath.set(p, result || {});
        const sprite = labelByPath.get(p);
        const n = byPath.get(p);
        if (sprite && n) {
            const counts = '+' + (n.add || 0) + ' −' + (n.del || 0);
            drawLabel(sprite.userData.canvas, n.name, (result && result.word) || counts, qualityAccent(result));
            sprite.material.map.needsUpdate = true;
        }
        if (selectedPath === p && n) showCard(n);
        applyColors();
    },
    setFilter(f) {
        filter = { text: String(f.text || ''), unreviewedOnly: !!f.unreviewedOnly, dimUnchanged: !!f.dimUnchanged, quality: filter.quality };
        applyColors();
    },
    resize() {
        if (!renderer) return;
        renderer.setSize(W(), H());
        if (camera) {
            camera.aspect = W() / Math.max(1, H());
            camera.updateProjectionMatrix();
        }
        labelDirty = true;
        needsRender = true;
    },
    setStale(b) { if (mapViewEl) mapViewEl.classList.toggle('stale', !!b); },
    clearSelection() { select(null); },
    toggleViewedSelected() { if (selectedPath) toggleViewed(selectedPath); },
    toggleViewedPath(p) { if (p && byPath.has(p)) toggleViewed(p); },
    isViewed(p) { return viewedSet.has(p); },
    diffSelected() { if (selectedPath && bridge.showDiff) bridge.showDiff(selectedPath); },
    frameChangeset() { frameChangeset(); },
    flyToPath(p) { const n = byPath.get(p); if (n) flyToNode(n); },
    nextUnreviewed(dir) { nextUnreviewed(dir || 1); },
    rotate(dir) { rotateSnap(dir || 1); },
    // Screen-space position of a file's sphere (px in #map-canvas-wrap).
    // Used by tests and by anything that wants to point at a planet.
    screenPos(p) {
        const n = byPath.get(p);
        if (!n || !camera) return null;
        const v = worldPos(n);
        // Include the entrance-scale transform so this agrees with pick()
        // even during the 420ms settle after setData.
        if (rootGroup) v.applyMatrix4(rootGroup.matrixWorld);
        v.project(camera);
        return { x: (v.x + 1) / 2 * W(), y: (1 - v.y) / 2 * H(), visible: v.z <= 1 };
    },
    // Test hook: what would a pointer event at these client coords pick?
    debugPick(clientX, clientY) {
        const n = pick({ clientX, clientY });
        return n ? { path: n.path, dir: !!n.dir } : null;
    },
    // Glue the diff panel to this sphere (null releases it).
    anchorPanel(p) {
        anchorPath = p && byPath.has(p) ? p : null;
        needsRender = true;
        if (!anchorPath && connectorEl) connectorEl.style.display = 'none';
        positionPanel();
    },
    setShowAll(b) {
        showAllUserSet = true;
        showAllFiles = !!b;
        if (lastPayloadStored) setData(lastPayloadStored);
    },
};
const mapAllCbEl = document.getElementById('map-all-cb');
if (mapAllCbEl) mapAllCbEl.addEventListener('change', () => api.setShowAll(mapAllCbEl.checked));
const mapFrameBtn = document.getElementById('map-frame');
if (mapFrameBtn) mapFrameBtn.addEventListener('click', () => frameChangeset());
const mapNextBtn = document.getElementById('map-next');
if (mapNextBtn) mapNextBtn.addEventListener('click', () => nextUnreviewed(1));
const mapQualityEl = document.getElementById('map-quality');
if (mapQualityEl) {
    mapQualityEl.addEventListener('click', (e) => {
        const chip = e.target.closest('.q-chip');
        if (!chip) return;
        const q = chip.getAttribute('data-q');
        filter.quality = filter.quality === q ? null : q;
        applyColors();
        updateProgress();
    });
}
window.GitMap = api;
window.dispatchEvent(new Event('gitmap-ready'));
