// Code Map — pure layout + graph module. No vscode imports so it stays
// testable from plain node.
//
// v2 "orbital" layout: every folder is a horizontal ring (an orbit) floating
// at a height derived from its depth; the folder's files are spheres resting
// on the ring's circumference, spaced by their size. Child folders pack
// inside the parent's boundary circle, so nesting reads as orbits within
// orbits. d3 circle-packing places the rings (children sorted by path, not
// value, so the board doesn't jump as churn changes).
import { hierarchy, pack, HierarchyNode } from 'd3-hierarchy';
import * as path from 'path';

export interface MapChangeInfo {
    additions: number;
    deletions: number;
    status: string;
    untracked: boolean;
}

export interface MapNode {
    id: number;
    path: string;
    name: string;
    dir: boolean;
    depth: number;
    x: number;
    y: number;
    /** height of the node's orbit plane (layout units, 0 = root plane) */
    z: number;
    /** files: sphere radius · dirs: orbit ring radius (0 = no direct files) */
    r: number;
    /** dirs only: packed boundary circle radius (ring + subfolders) */
    br?: number;
    /** dirs only: boundary circle centre — may differ from the ring centre */
    bx?: number;
    by?: number;
    add?: number;
    del?: number;
    status?: string;
    testPair?: boolean;
    comments?: number;
    viewed?: boolean;
    /** dirs only: no changed files anywhere beneath */
    quiet?: boolean;
    /** dirs only: total file count beneath */
    files?: number;
    /** files: how many files import this one (scoped repo, pre-truncation) */
    inDeg?: number;
    /** files: imported often enough to be structural — worth a distinct look */
    hub?: boolean;
}

export interface MapEdge {
    from: number;
    to: number;
    /** true when either endpoint is a changed file — drawn hot */
    hot?: boolean;
}

export interface ArchMapPayload {
    v: 2;
    size: number;
    nodes: MapNode[];
    edges: MapEdge[];
    totalFiles: number;
    shownFiles: number;
    truncated: boolean;
    changedCount: number;
    root: string;
    maxDepth: number;
}

const MAX_FILES = 3000;
const LAYOUT_SIZE = 1200;

// Orbit tuning (layout units, pre-pack — everything rescales together).
const RING_GAP = 4;    // arc gap between neighbouring spheres
const RING_PAD = 8;    // clearance between the ring line and its packed circle
const MIN_RING = 10;   // a one-file folder still gets a visible orbit
const Z_STEP = 30;     // orbit height per folder depth
const Z_JITTER = 16;   // deterministic per-folder wobble so planes never merge
const HUB_MIN_IN = 4;  // imported-by count that makes a file a hub

interface TreeEntry {
    name: string;
    path: string;
    children?: Map<string, TreeEntry>;
}

function ensureDir(root: TreeEntry, dirPath: string): TreeEntry {
    if (!dirPath || dirPath === '.') return root;
    const parts = dirPath.split('/');
    let cur = root;
    let acc = '';
    for (const part of parts) {
        acc = acc ? acc + '/' + part : part;
        if (!cur.children) cur.children = new Map();
        let next = cur.children.get(part);
        if (!next) {
            next = { name: part, path: acc, children: new Map() };
            cur.children.set(part, next);
        }
        cur = next;
    }
    return cur;
}

// Import specifier extraction for JS/TS-ish files. Only relative specifiers
// are kept — bare module imports point outside the repo.
const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js'];

/** Raw relative import specifiers found in a file's source. */
export function extractImportSpecs(content: string): string[] {
    const out: string[] = [];
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content)) !== null) {
        const spec = m[1] || m[2] || m[3] || m[4];
        if (spec && (spec.startsWith('./') || spec.startsWith('../'))) out.push(spec);
    }
    return out;
}

export function resolveImport(fromPath: string, spec: string, fileSet: Set<string>): string | null {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), spec));
    for (const suffix of RESOLVE_SUFFIXES) {
        const candidate = base + suffix;
        if (fileSet.has(candidate)) return candidate;
    }
    return null;
}

export function extractImports(fromPath: string, content: string, fileSet: Set<string>): string[] {
    const out: string[] = [];
    for (const spec of extractImportSpecs(content)) {
        const target = resolveImport(fromPath, spec, fileSet);
        if (target) out.push(target);
    }
    return out;
}

const TEST_HINTS = ['.test.', '.spec.'];

function findTestPair(filePath: string, fileSet: Set<string>): boolean {
    const dir = path.posix.dirname(filePath);
    const base = path.posix.basename(filePath);
    const dot = base.lastIndexOf('.');
    if (dot <= 0) return false;
    const stem = base.slice(0, dot);
    const ext = base.slice(dot);
    for (const hint of TEST_HINTS) {
        const sibling = (dir === '.' ? '' : dir + '/') + stem + hint.slice(0, -1) + ext;
        if (fileSet.has(sibling)) return true;
    }
    const testsDir = (dir === '.' ? '' : dir + '/') + '__tests__/' + base;
    if (fileSet.has(testsDir)) return true;
    return false;
}

export interface BuildMapInput {
    files: string[];
    changes: Map<string, MapChangeInfo>;
    viewed: Set<string>;
    comments: Map<string, number>;
    /** worktree contents for changed text files — used for import edges */
    contents: Map<string, string>;
    /** pre-extracted relative import specifiers per file (whole-repo scan) */
    importSpecs?: Map<string, string[]>;
    /** scope map to this folder (posix path, no trailing slash); '' = repo root */
    root?: string;
    /** glob patterns for non-code files/folders to hide */
    exclude?: string[];
}

// Tiny glob → RegExp: ** = any path segment run, * = within-segment, ? = one char.
export function globToRegExp(glob: string): RegExp {
    let re = '';
    let i = 0;
    while (i < glob.length) {
        const c = glob[i];
        if (c === '*') {
            if (glob[i + 1] === '*') {
                if (glob[i + 2] === '/') {
                    // '**/' = zero or more WHOLE segments — never a partial
                    // one, or '**/media/**' would swallow 'multimedia/'.
                    re += '(?:[^/]+/)*';
                    i += 3;
                } else {
                    // Trailing/bare '**' = anything.
                    re += '.*';
                    i += 2;
                }
            } else {
                re += '[^/]*';
                i++;
            }
        } else if (c === '?') {
            re += '[^/]';
            i++;
        } else {
            re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
            i++;
        }
    }
    return new RegExp('^' + re + '$', 'i');
}

export function buildExcluder(patterns: string[]): (p: string) => boolean {
    const regs = patterns.filter(Boolean).map((g) => {
        // Bare names like "media" mean "that folder anywhere".
        const norm = g.includes('*') || g.includes('/') ? g : '**/' + g + '/**';
        return globToRegExp(norm);
    });
    return (p: string) => {
        // Also test with leading path so '**/x/**' matches top-level 'x/…'.
        const padded = '/' + p;
        for (const r of regs) {
            if (r.test(p) || r.test(padded)) return true;
        }
        return false;
    };
}

// Deterministic 0..1 from a path — used for orbit start angles and height
// wobble, so the board looks organic yet never moves between builds.
export function hash01(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
}

// Plain collapsed tree node (single-child directory chains folded).
interface PlainDir {
    name: string;
    path: string;
    depth: number;
    files: string[];   // direct file paths, sorted
    dirs: PlainDir[];
}

// Pack-hierarchy node: dirs carry children; every dir with direct files gets
// one synthetic "ring" leaf that reserves the disc its orbit needs.
interface PackDatum {
    kind: 'dir' | 'ring';
    path: string;
    name?: string;
    value?: number;
    ringR?: number;
    children?: PackDatum[];
}

export function buildArchMap(input: BuildMapInput): ArchMapPayload {
    const { viewed, comments, contents } = input;
    const scopeRoot = (input.root || '').replace(/^\/+|\/+$/g, '');
    const excluded = buildExcluder(input.exclude || []);
    const inRoot = (p: string) => !scopeRoot || p === scopeRoot || p.startsWith(scopeRoot + '/');

    const keep = (p: string) => inRoot(p) && !excluded(p);
    let changes = input.changes;
    let scopedFiles = input.files.filter(keep);
    let scopedChanges = new Map(Array.from(changes.entries()).filter(([p]) => keep(p)));
    // Safety: a root that matches nothing falls back to unscoped — and the
    // payload must SAY so, or the UI shows a scope that isn't applied.
    let effectiveRoot = scopeRoot;
    if (scopeRoot && scopedFiles.length === 0 && scopedChanges.size === 0) {
        effectiveRoot = '';
        scopedFiles = input.files.filter((p) => !excluded(p));
        scopedChanges = new Map(Array.from(changes.entries()).filter(([p]) => !excluded(p)));
    }
    changes = scopedChanges;

    const allFiles = Array.from(new Set(scopedFiles.concat(Array.from(changes.keys())))).sort();
    const totalFiles = allFiles.length;

    // Cap huge repos: changed files always survive, then files sharing a
    // directory with a change, then everything else until the cap.
    let files = allFiles;
    let truncated = false;
    if (allFiles.length > MAX_FILES) {
        truncated = true;
        const changedDirs = new Set<string>();
        for (const p of changes.keys()) changedDirs.add(path.posix.dirname(p));
        const changed: string[] = [];
        const near: string[] = [];
        const rest: string[] = [];
        for (const f of allFiles) {
            if (changes.has(f)) changed.push(f);
            else if (changedDirs.has(path.posix.dirname(f))) near.push(f);
            else rest.push(f);
        }
        files = changed.concat(near, rest).slice(0, MAX_FILES).sort();
    }

    const fileSet = new Set(files);

    // Build directory tree.
    const root: TreeEntry = { name: '', path: '', children: new Map() };
    for (const f of files) {
        const dir = ensureDir(root, path.posix.dirname(f));
        if (!dir.children) dir.children = new Map();
        dir.children.set(path.posix.basename(f), { name: path.posix.basename(f), path: f });
    }

    // Collapse single-child directory chains (src → client → components with
    // nothing else becomes one "src/client/components" node), then split each
    // dir into direct files + subdirs.
    const toPlain = (e: TreeEntry, depth: number, isRoot?: boolean): PlainDir => {
        let cur = e;
        let label = e.name;
        if (!isRoot) {
            while (cur.children && cur.children.size === 1) {
                const only = Array.from(cur.children.values())[0];
                if (!only.children) break; // single child is a file — stop
                label = label ? label + '/' + only.name : only.name;
                cur = only;
            }
        }
        const kids = cur.children ? Array.from(cur.children.values()) : [];
        return {
            name: label,
            path: cur.path,
            depth,
            files: kids.filter((c) => !c.children).map((c) => c.path).sort(),
            dirs: kids.filter((c) => !!c.children)
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((c) => toPlain(c, depth + 1)),
        };
    };
    const plainRoot = toPlain(root, 0, true);

    // Sphere radius in layout units — churn grows the planet, capped so a
    // monster diff can't dominate the frame (~2.8x a small change; the
    // renderer's glow carries the rest of the "big" signal).
    const sphereR = (p: string): number => {
        const ch = changes.get(p);
        if (!ch) return 3;
        return 5 + Math.min(9, Math.sqrt(ch.additions + ch.deletions));
    };

    // Ring radius each folder needs so its spheres fit around the orbit.
    const ringNeed = (filePaths: string[]): number => {
        let arc = 0;
        for (const f of filePaths) arc += 2 * sphereR(f) + RING_GAP;
        return Math.max(MIN_RING, arc / (2 * Math.PI));
    };

    // Pack hierarchy: dirs are containers, ring leaves reserve orbit space.
    const ringRByDir = new Map<string, number>();
    const toPack = (d: PlainDir): PackDatum => {
        const children: PackDatum[] = d.dirs.map(toPack);
        if (d.files.length) {
            const rr = ringNeed(d.files);
            ringRByDir.set(d.path, rr);
            children.push({ kind: 'ring', path: d.path, value: Math.pow(rr + RING_PAD, 2) });
        }
        return { kind: 'dir', path: d.path, name: d.name, children };
    };
    const packRoot = toPack(plainRoot);

    const h: HierarchyNode<PackDatum> = hierarchy(packRoot)
        .sum((d) => (d.kind === 'ring' ? d.value || 0 : 0))
        // Deterministic + stable: order siblings by path/kind, never by value.
        .sort((a, b) =>
            (a.data.path + (a.data.kind === 'ring' ? ' ring' : ''))
                .localeCompare(b.data.path + (b.data.kind === 'ring' ? ' ring' : '')));

    pack<PackDatum>().size([LAYOUT_SIZE, LAYOUT_SIZE]).padding(6)(h as any);

    // Where each dir's orbit landed. Pack scales all radii by one factor k —
    // recover it from any ring leaf so sphere sizes stay in step.
    interface RingSpot { cx: number; cy: number; r: number; k: number }
    const ringByDir = new Map<string, RingSpot>();
    const dirCircle = new Map<string, { x: number; y: number; r: number; depth: number; name: string }>();
    h.each((n: any) => {
        const d: PackDatum = n.data;
        if (d.kind === 'ring') {
            const need = ringRByDir.get(d.path) || MIN_RING;
            const k = n.r / (need + RING_PAD);
            ringByDir.set(d.path, { cx: n.x, cy: n.y, r: k * need, k });
        } else {
            dirCircle.set(d.path, { x: n.x, y: n.y, r: n.r, depth: n.depth, name: d.name || '' });
        }
    });

    // Orbit heights: depth climbs, a hashed wobble keeps sibling planes from
    // fusing into one visual slab.
    const dirZ = (p: string, depth: number): number =>
        depth * Z_STEP + (p ? (hash01(p) - 0.5) * Z_JITTER : 0);

    const nodes: MapNode[] = [];
    const idByPath = new Map<string, number>();
    let maxDepth = 0;

    // Root anchor (id 0) — invisible, keeps ids stable for the renderer.
    const rootCircle = dirCircle.get('')!;
    nodes.push({
        id: 0, path: '', name: '(root)', dir: true, depth: 0,
        x: rootCircle.x, y: rootCircle.y, z: 0,
        r: ringByDir.get('') ? ringByDir.get('')!.r : 0,
        br: rootCircle.r, bx: rootCircle.x, by: rootCircle.y,
    });
    if (ringByDir.get('')) {
        const rs = ringByDir.get('')!;
        nodes[0].x = rs.cx;
        nodes[0].y = rs.cy;
    }

    // Emit dirs + their files, walking the collapsed tree (deterministic).
    const emit = (d: PlainDir) => {
        const circ = dirCircle.get(d.path);
        const ring = ringByDir.get(d.path);
        const z = dirZ(d.path, d.depth);
        if (d.depth > 0 && circ) {
            maxDepth = Math.max(maxDepth, d.depth);
            const node: MapNode = {
                id: nodes.length,
                path: d.path,
                name: d.name,
                dir: true,
                depth: d.depth,
                x: ring ? ring.cx : circ.x,
                y: ring ? ring.cy : circ.y,
                z: Math.round(z * 100) / 100,
                r: ring ? Math.round(ring.r * 100) / 100 : 0,
                br: Math.round(circ.r * 100) / 100,
                bx: Math.round(circ.x * 100) / 100,
                by: Math.round(circ.y * 100) / 100,
            };
            nodes.push(node);
        }
        if (ring && d.files.length) {
            // Spread spheres around the orbit by their arc share; the start
            // angle is hashed so sibling rings don't all begin at 3 o'clock.
            let arcTotal = 0;
            for (const f of d.files) arcTotal += 2 * sphereR(f) + RING_GAP;
            const start = hash01(d.path || '(root)') * 2 * Math.PI;
            let cum = 0;
            for (const f of d.files) {
                const w = 2 * sphereR(f) + RING_GAP;
                const a = start + 2 * Math.PI * ((cum + w / 2) / arcTotal);
                cum += w;
                const rWorld = Math.max(1.4, Math.min(24, ring.k * sphereR(f)));
                const id = nodes.length;
                const node: MapNode = {
                    id,
                    path: f,
                    name: path.posix.basename(f),
                    dir: false,
                    depth: d.depth + 1,
                    x: Math.round((ring.cx + ring.r * Math.cos(a)) * 100) / 100,
                    y: Math.round((ring.cy + ring.r * Math.sin(a)) * 100) / 100,
                    z: Math.round(z * 100) / 100,
                    r: Math.round(rWorld * 100) / 100,
                };
                const ch = changes.get(f);
                if (ch) {
                    node.add = ch.additions;
                    node.del = ch.deletions;
                    node.status = ch.untracked ? '?' : ch.status;
                    node.testPair = findTestPair(f, fileSet);
                    node.viewed = viewed.has(f);
                }
                const c = comments.get(f);
                if (c) node.comments = c;
                idByPath.set(f, id);
                nodes.push(node);
            }
        }
        for (const sub of d.dirs) emit(sub);
    };
    emit(plainRoot);

    // Dir context stats: total files beneath + whether any change lives there.
    const changedPaths = Array.from(changes.keys());
    for (const n of nodes) {
        if (!n.dir || !n.path) continue;
        const prefix = n.path + '/';
        let fc = 0;
        for (const f of files) if (f.startsWith(prefix)) fc++;
        n.files = fc;
        if (!changedPaths.some((c) => c === n.path || c.startsWith(prefix))) n.quiet = true;
    }

    // Import edges. Whole-repo specs when the caller scanned them; changed-file
    // worktree contents as the fallback source.
    const specsByPath = new Map<string, string[]>();
    if (input.importSpecs) {
        for (const [p, specs] of input.importSpecs) specsByPath.set(p, specs);
    }
    for (const [p, content] of contents) {
        if (!specsByPath.has(p)) specsByPath.set(p, extractImportSpecs(content));
    }
    let edges: MapEdge[] = [];
    const seenPair = new Set<string>();
    const inDeg = new Map<string, number>();
    // Resolve against the PRE-truncation universe so hub identity is stable
    // on huge repos — a file doesn't stop being a hub because its importers
    // fell past the MAX_FILES cap. Edges still only connect visible nodes.
    const fullFileSet = truncated ? new Set(allFiles) : fileSet;
    for (const [p, specs] of specsByPath) {
        if (!fullFileSet.has(p)) continue; // importer outside scope
        for (const spec of specs) {
            const target = resolveImport(p, spec, fullFileSet);
            if (!target || target === p) continue;
            const key = p + '>' + target;
            if (seenPair.has(key)) continue;
            seenPair.add(key);
            inDeg.set(target, (inDeg.get(target) || 0) + 1);
            const fromId = idByPath.get(p);
            const toId = idByPath.get(target);
            if (fromId === undefined || toId === undefined) continue;
            edges.push({
                from: fromId,
                to: toId,
                hot: changes.has(p) || changes.has(target) || undefined,
            });
        }
    }
    // Hub marking — counted over ALL resolved imports, before any edge cap,
    // so a heavily-imported file stays a hub even when its edges are culled.
    for (const [p, deg] of inDeg) {
        const id = idByPath.get(p);
        if (id === undefined) continue;
        nodes[id].inDeg = deg;
        if (deg >= HUB_MIN_IN) nodes[id].hub = true;
    }
    // Hairball guard — hot edges always survive.
    const MAX_EDGES = 900;
    if (edges.length > MAX_EDGES) {
        const hot = edges.filter((e) => e.hot);
        const cold = edges.filter((e) => !e.hot);
        edges = hot.concat(cold.slice(0, Math.max(0, MAX_EDGES - hot.length)));
    }

    return {
        v: 2,
        size: LAYOUT_SIZE,
        nodes,
        edges,
        totalFiles,
        shownFiles: files.length,
        truncated,
        changedCount: changes.size,
        root: effectiveRoot,
        maxDepth,
    };
}
