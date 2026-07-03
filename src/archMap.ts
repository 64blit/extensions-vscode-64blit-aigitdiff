// Code Map — pure layout + graph module. No vscode imports so it stays
// testable from plain node. Positions come from d3 circle-packing, which
// keeps the layout deterministic for a given file list (children sorted by
// path, not by value, so bubbles don't jump as churn changes).
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
    r: number;
    add?: number;
    del?: number;
    status?: string;
    testPair?: boolean;
    comments?: number;
    viewed?: boolean;
}

export interface MapEdge {
    from: number;
    to: number;
}

export interface ArchMapPayload {
    v: 1;
    size: number;
    nodes: MapNode[];
    edges: MapEdge[];
    totalFiles: number;
    shownFiles: number;
    truncated: boolean;
    changedCount: number;
}

const MAX_FILES = 3000;
const LAYOUT_SIZE = 1200;

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

export function extractImports(fromPath: string, content: string, fileSet: Set<string>): string[] {
    const out: string[] = [];
    const dir = path.posix.dirname(fromPath);
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content)) !== null) {
        const spec = m[1] || m[2] || m[3] || m[4];
        if (!spec || (!spec.startsWith('./') && !spec.startsWith('../'))) continue;
        const base = path.posix.normalize(path.posix.join(dir, spec));
        for (const suffix of RESOLVE_SUFFIXES) {
            const candidate = base + suffix;
            if (fileSet.has(candidate)) {
                out.push(candidate);
                break;
            }
        }
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
}

export function buildArchMap(input: BuildMapInput): ArchMapPayload {
    const { changes, viewed, comments, contents } = input;
    const allFiles = Array.from(new Set(input.files.concat(Array.from(changes.keys())))).sort();
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

    const toPlain = (e: TreeEntry): any => ({
        name: e.name,
        path: e.path,
        isDir: !!e.children,
        children: e.children ? Array.from(e.children.values()).map(toPlain) : undefined,
    });

    const h: HierarchyNode<any> = hierarchy(toPlain(root))
        .sum((d: any) => {
            if (d.isDir) return 0;
            const ch = changes.get(d.path);
            if (!ch) return 1;
            const churn = ch.additions + ch.deletions;
            return 2 + Math.min(30, Math.sqrt(churn) * 1.5);
        })
        // Deterministic + stable: order siblings by path, never by value.
        .sort((a, b) => String(a.data.path).localeCompare(String(b.data.path)));

    pack<any>().size([LAYOUT_SIZE, LAYOUT_SIZE]).padding(3)(h as any);

    const nodes: MapNode[] = [];
    const idByPath = new Map<string, number>();
    h.each((n: any) => {
        if (!n.data.path && n.depth === 0) {
            // Root circle — keep as an invisible anchor (id 0).
            nodes.push({ id: nodes.length, path: '', name: '(root)', dir: true, depth: 0, x: n.x, y: n.y, r: n.r });
            return;
        }
        const id = nodes.length;
        const isDir = !!n.data.isDir;
        const node: MapNode = {
            id,
            path: n.data.path,
            name: n.data.name,
            dir: isDir,
            depth: n.depth,
            x: Math.round(n.x * 100) / 100,
            y: Math.round(n.y * 100) / 100,
            r: Math.round(n.r * 100) / 100,
        };
        if (!isDir) {
            const ch = changes.get(n.data.path);
            if (ch) {
                node.add = ch.additions;
                node.del = ch.deletions;
                node.status = ch.untracked ? '?' : ch.status;
                node.testPair = findTestPair(n.data.path, fileSet);
                node.viewed = viewed.has(n.data.path);
            }
            const c = comments.get(n.data.path);
            if (c) node.comments = c;
            idByPath.set(n.data.path, id);
        }
        nodes.push(node);
    });

    // Import edges — from changed files' worktree contents.
    const edges: MapEdge[] = [];
    const seen = new Set<string>();
    for (const [p, content] of contents) {
        const fromId = idByPath.get(p);
        if (fromId === undefined) continue;
        for (const target of extractImports(p, content, fileSet)) {
            const toId = idByPath.get(target);
            if (toId === undefined || toId === fromId) continue;
            const key = fromId + '>' + toId;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ from: fromId, to: toId });
        }
    }

    return {
        v: 1,
        size: LAYOUT_SIZE,
        nodes,
        edges,
        totalFiles,
        shownFiles: files.length,
        truncated,
        changedCount: changes.size,
    };
}
