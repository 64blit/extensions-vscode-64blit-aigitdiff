import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fsp from 'fs/promises';
import * as crypto from 'crypto';
import { getWebviewHtml } from './webview';

// node-pty native module — loaded lazily so the extension still activates
// even on platforms where the prebuilt binary is missing/incompatible.
let ptyModule: any = null;
let ptyLoadError: string | null = null;
function loadPty(): any | null {
    if (ptyModule || ptyLoadError) return ptyModule;
    try {
        ptyModule = require('@homebridge/node-pty-prebuilt-multiarch');
    } catch (e: any) {
        ptyLoadError = e?.message ?? String(e);
        // eslint-disable-next-line no-console
        console.error('[git-diff-viewer] node-pty failed to load:', ptyLoadError);
    }
    return ptyModule;
}

interface PtySession {
    id: string;
    proc: any;
    label: string;
}

interface FileChange {
    path: string;
    status: string;
    statusLabel: string;
    staged: boolean;
    unstaged: boolean;
    untracked: boolean;
    additions: number;
    deletions: number;
    diff: string;
    binary: boolean;
    language?: string;
    context: number;
    mtime: number;
    headContent: string | null;
    indexContent: string | null;
    worktreeContent: string | null;
}

const MAX_HIGHLIGHT_CONTENT_SIZE = 256 * 1024; // 256 KB cap per version per file

async function readBlobContent(repoRoot: string, ref: string, filePath: string): Promise<string | null> {
    try {
        const target = ref ? `${ref}:${filePath}` : `:${filePath}`;
        const out = await gitExec(repoRoot, ['-c', 'core.quotepath=false', 'show', target]);
        if (out.length > MAX_HIGHLIGHT_CONTENT_SIZE) return null;
        return out;
    } catch {
        return null;
    }
}

async function readWorktreeContent(repoRoot: string, filePath: string): Promise<string | null> {
    try {
        const fp = path.join(repoRoot, filePath);
        const stat = await fsp.stat(fp);
        if (stat.size > MAX_HIGHLIGHT_CONTENT_SIZE) return null;
        return await fsp.readFile(fp, 'utf8');
    } catch {
        return null;
    }
}

async function fetchFileContents(repoRoot: string, filePath: string, untracked: boolean, binary: boolean): Promise<{
    headContent: string | null;
    indexContent: string | null;
    worktreeContent: string | null;
}> {
    if (binary) return { headContent: null, indexContent: null, worktreeContent: null };
    if (untracked) {
        const wt = await readWorktreeContent(repoRoot, filePath);
        return { headContent: null, indexContent: null, worktreeContent: wt };
    }
    const [headContent, indexContent, worktreeContent] = await Promise.all([
        readBlobContent(repoRoot, 'HEAD', filePath),
        readBlobContent(repoRoot, '', filePath),
        readWorktreeContent(repoRoot, filePath),
    ]);
    return { headContent, indexContent, worktreeContent };
}

interface InlineComment {
    id: string;
    file: string;
    side: 'left' | 'right';
    lineNum: number;
    lineText: string;
    body: string;
    created: number;
    updated: number;
    aiGenerated?: boolean;
    severity?: 'critical' | 'major' | 'minor' | 'nit';
}

const LANG_BY_EXT: Record<string, string> = {
    'ts': 'typescript', 'tsx': 'typescript', 'mts': 'typescript', 'cts': 'typescript',
    'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
    'py': 'python', 'pyw': 'python',
    'rb': 'ruby', 'go': 'go', 'rs': 'rust',
    'java': 'java', 'kt': 'kotlin', 'kts': 'kotlin', 'scala': 'scala',
    'swift': 'swift', 'm': 'objectivec', 'mm': 'objectivec',
    'c': 'c', 'h': 'c', 'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp', 'hpp': 'cpp', 'hh': 'cpp',
    'cs': 'csharp', 'fs': 'fsharp', 'vb': 'vbnet',
    'php': 'php',
    'sh': 'bash', 'bash': 'bash', 'zsh': 'bash', 'fish': 'bash',
    'ps1': 'powershell',
    'json': 'json', 'jsonc': 'json',
    'yml': 'yaml', 'yaml': 'yaml',
    'toml': 'ini', 'ini': 'ini', 'cfg': 'ini',
    'md': 'markdown', 'markdown': 'markdown',
    'html': 'xml', 'htm': 'xml', 'xml': 'xml', 'svg': 'xml', 'vue': 'xml', 'svelte': 'xml',
    'css': 'css', 'scss': 'scss', 'sass': 'scss', 'less': 'less',
    'sql': 'sql', 'lua': 'lua', 'r': 'r', 'pl': 'perl', 'pm': 'perl',
    'dart': 'dart', 'ex': 'elixir', 'exs': 'elixir',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile', 'mk': 'makefile',
    'tf': 'terraform', 'hcl': 'terraform',
    'gradle': 'groovy', 'groovy': 'groovy',
    'graphql': 'graphql', 'gql': 'graphql',
};

function detectLanguage(filePath: string): string | undefined {
    const base = path.basename(filePath).toLowerCase();
    if (base === 'dockerfile') return 'dockerfile';
    if (base === 'makefile') return 'makefile';
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return LANG_BY_EXT[ext];
}

function gitExec(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        cp.execFile(
            'git',
            args,
            { cwd, maxBuffer: 64 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (err) {
                    // git diff --no-index exits 1 when files differ — that's success for our purposes.
                    const e = err as cp.ExecFileException & { code?: number };
                    if (e.code === 1 && stdout) {
                        resolve(stdout);
                        return;
                    }
                    reject(new Error(stderr || err.message));
                    return;
                }
                resolve(stdout);
            }
        );
    });
}

function gitExecStdin(cwd: string, args: string[], stdin: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = cp.execFile(
            'git',
            args,
            { cwd, maxBuffer: 64 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr || err.message));
                    return;
                }
                resolve(stdout);
            }
        );
        child.stdin?.write(stdin);
        child.stdin?.end();
    });
}

/**
 * Extract a single-hunk patch from a file's current diff, suitable for `git apply`.
 * `section` selects which diff to read from: 'staged' uses --cached, 'unstaged' uses
 * the working-tree diff. The patch header (diff --git, index, ---/+++) is preserved.
 */
async function extractHunkPatch(
    repoRoot: string,
    filePath: string,
    section: 'staged' | 'unstaged',
    hunkIndex: number,
    contextLines: number
): Promise<string | null> {
    const args = ['-c', 'core.quotepath=false', 'diff', `-U${contextLines}`];
    if (section === 'staged') args.push('--cached');
    args.push('--', filePath);
    const full = await gitExec(repoRoot, args);
    if (!full) return null;

    const lines = full.split('\n');
    const headerLines: string[] = [];
    const hunks: string[][] = [];
    let cur: string[] | null = null;
    let pastHeader = false;
    for (const line of lines) {
        if (line.startsWith('@@')) {
            pastHeader = true;
            if (cur) hunks.push(cur);
            cur = [line];
        } else if (cur) {
            cur.push(line);
        } else if (!pastHeader) {
            headerLines.push(line);
        }
    }
    if (cur) hunks.push(cur);
    if (hunkIndex < 0 || hunkIndex >= hunks.length) return null;

    const patch = headerLines.concat(hunks[hunkIndex]).join('\n');
    return patch.endsWith('\n') ? patch : patch + '\n';
}

async function applyPatch(repoRoot: string, patch: string, opts: { reverse?: boolean; cached?: boolean }): Promise<void> {
    const args = ['apply', '--whitespace=nowarn'];
    if (opts.reverse) args.push('--reverse');
    if (opts.cached) args.push('--cached');
    args.push('-');
    await gitExecStdin(repoRoot, args, patch);
}

async function getRepoRoot(cwd: string): Promise<string | null> {
    try {
        const out = await gitExec(cwd, ['rev-parse', '--show-toplevel']);
        return out.trim() || null;
    } catch {
        return null;
    }
}

function statusToLabel(code: string): string {
    switch (code) {
        case 'M': return 'Modified';
        case 'A': return 'Added';
        case 'D': return 'Deleted';
        case 'R': return 'Renamed';
        case 'C': return 'Copied';
        case 'U': return 'Conflict';
        case '?': return 'Untracked';
        case 'T': return 'Type changed';
        default: return code;
    }
}

function countChanges(diff: string): { additions: number; deletions: number; binary: boolean } {
    if (!diff) return { additions: 0, deletions: 0, binary: false };
    if (/^Binary files .* differ$/m.test(diff)) {
        return { additions: 0, deletions: 0, binary: true };
    }
    let additions = 0;
    let deletions = 0;
    for (const line of diff.split('\n')) {
        if (line.startsWith('+++') || line.startsWith('---')) continue;
        if (line.startsWith('+')) additions++;
        else if (line.startsWith('-')) deletions++;
    }
    return { additions, deletions, binary: false };
}

function parsePorcelain(output: string): Array<{ x: string; y: string; path: string }> {
    // -z output: NUL-terminated entries; renames have an extra NUL-separated origin path.
    const entries: Array<{ x: string; y: string; path: string }> = [];
    const tokens = output.split('\0');
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (!tok) continue;
        const x = tok[0];
        const y = tok[1];
        const filePath = tok.slice(3);
        if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
            // Rename/copy: next token is the original path; we want the new name (current tok).
            i++;
        }
        entries.push({ x, y, path: filePath });
    }
    return entries;
}

async function buildFileDiff(repoRoot: string, filePath: string, x: string, y: string, contextLines: number): Promise<{ diff: string; staged: boolean; unstaged: boolean; untracked: boolean }> {
    const sections: string[] = [];
    let staged = false;
    let unstaged = false;
    let untracked = false;
    const ctxArg = `-U${contextLines}`;

    if (x === '?') {
        untracked = true;
        try {
            const fakeDiff = await gitExec(repoRoot, [
                '-c', 'core.quotepath=false',
                'diff', ctxArg, '--no-index', '--', '/dev/null', filePath
            ]);
            sections.push(fakeDiff);
        } catch (e: any) {
            if (e.message) sections.push(`(unable to diff untracked file: ${e.message})`);
        }
    } else {
        if (x !== ' ' && x !== '?') {
            staged = true;
            try {
                const d = await gitExec(repoRoot, [
                    '-c', 'core.quotepath=false',
                    'diff', ctxArg, '--cached', '--', filePath
                ]);
                if (d) sections.push(`### Staged\n${d}`);
            } catch { /* ignore */ }
        }
        if (y !== ' ' && y !== '?') {
            unstaged = true;
            try {
                const d = await gitExec(repoRoot, [
                    '-c', 'core.quotepath=false',
                    'diff', ctxArg, '--', filePath
                ]);
                if (d) sections.push(`### Unstaged\n${d}`);
            } catch { /* ignore */ }
        }
    }
    return { diff: sections.join('\n'), staged, unstaged, untracked };
}

async function collectChanges(repoRoot: string, defaultContext: number, perFileContext: Map<string, number>): Promise<FileChange[]> {
    const status = await gitExec(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const entries = parsePorcelain(status);
    const out: FileChange[] = [];

    for (const { x, y, path: filePath } of entries) {
        const ctx = perFileContext.get(filePath) ?? defaultContext;
        const { diff, staged, unstaged, untracked } = await buildFileDiff(repoRoot, filePath, x, y, ctx);
        const { additions, deletions, binary } = countChanges(diff);
        const code = (x !== ' ' && x !== '?') ? x : y;
        const mtime = await fileMtime(repoRoot, filePath);
        const contents = await fetchFileContents(repoRoot, filePath, untracked, binary);
        out.push({
            path: filePath,
            status: code,
            statusLabel: statusToLabel(code),
            staged,
            unstaged,
            untracked,
            additions,
            deletions,
            diff,
            binary,
            language: detectLanguage(filePath),
            context: ctx,
            mtime,
            ...contents,
        });
    }
    out.sort((a, b) => a.path.localeCompare(b.path));
    return out;
}

async function rediffOne(repoRoot: string, filePath: string, contextLines: number): Promise<FileChange | null> {
    const status = await gitExec(repoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', filePath]);
    const entries = parsePorcelain(status);
    if (entries.length === 0) return null;
    const { x, y } = entries[0];
    const { diff, staged, unstaged, untracked } = await buildFileDiff(repoRoot, filePath, x, y, contextLines);
    const { additions, deletions, binary } = countChanges(diff);
    const code = (x !== ' ' && x !== '?') ? x : y;
    const mtime = await fileMtime(repoRoot, filePath);
    const contents = await fetchFileContents(repoRoot, filePath, untracked, binary);
    return {
        path: filePath,
        status: code,
        statusLabel: statusToLabel(code),
        staged,
        unstaged,
        untracked,
        additions,
        deletions,
        diff,
        binary,
        language: detectLanguage(filePath),
        context: contextLines,
        mtime,
        ...contents,
    };
}

function isInsideGitDir(relPath: string): boolean {
    const norm = relPath.split(path.sep).join('/');
    return norm === '.git' || norm.startsWith('.git/');
}

function checkIgnored(repoRoot: string, relPath: string): Promise<boolean> {
    return new Promise((resolve) => {
        cp.execFile(
            'git',
            ['check-ignore', '--quiet', '--', relPath],
            { cwd: repoRoot },
            (err) => {
                if (!err) { resolve(true); return; }
                const e = err as cp.ExecFileException & { code?: number };
                // exit 1 = not ignored; anything else = treat as not-ignored to be permissive.
                resolve(false);
                void e;
            }
        );
    });
}

function hiddenKey(repoRoot: string): string { return `gitDiffViewer.hidden:${repoRoot}`; }
function draftKey(repoRoot: string): string { return `gitDiffViewer.draft:${repoRoot}`; }
function commentsKey(repoRoot: string): string { return `gitDiffViewer.comments:${repoRoot}`; }
function autoExpandKey(repoRoot: string): string { return `gitDiffViewer.autoExpandRecent:${repoRoot}`; }

function getComments(context: vscode.ExtensionContext, repoRoot: string): InlineComment[] {
    const list = context.workspaceState.get<InlineComment[]>(commentsKey(repoRoot), []);
    return Array.isArray(list) ? list.slice() : [];
}

async function setComments(context: vscode.ExtensionContext, repoRoot: string, list: InlineComment[]): Promise<void> {
    await context.workspaceState.update(commentsKey(repoRoot), list);
}

async function fileMtime(repoRoot: string, relPath: string): Promise<number> {
    try {
        const st = await fsp.stat(path.join(repoRoot, relPath));
        return st.mtimeMs;
    } catch {
        return 0;
    }
}

function makeId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getHidden(context: vscode.ExtensionContext, repoRoot: string): string[] {
    const list = context.workspaceState.get<string[]>(hiddenKey(repoRoot), []);
    return Array.isArray(list) ? list.slice() : [];
}

async function setHidden(context: vscode.ExtensionContext, repoRoot: string, list: string[]): Promise<void> {
    await context.workspaceState.update(hiddenKey(repoRoot), list);
}

interface EditorThemeConfig {
    fontFamily: string;
    fontSize: number;
    lineHeight: number; // px or 0 for auto
    tabSize: number;
    insertSpaces: boolean;
}

const OPENROUTER_KEY_STATE = 'gitDiffViewer.openRouterKey';

async function readOpenRouterKeyFromEnvFile(): Promise<string | null> {
    try {
        const envPath = path.join(os.homedir(), '.env');
        const content = await fsp.readFile(envPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const m = trimmed.match(/^(?:export\s+)?(OPENROUTER_API_KEY|OPENROUTER_KEY|OPEN_ROUTER_API_KEY|OR_API_KEY)\s*=\s*(.+?)\s*$/);
            if (!m) continue;
            let value = m[2];
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (value) return value;
        }
    } catch { /* missing or unreadable — fine */ }
    return null;
}

type KeySource = 'settings' | 'state' | 'env' | null;

async function resolveOpenRouterKey(context: vscode.ExtensionContext): Promise<{ key: string | null; source: KeySource }> {
    // 1. VS Code user/workspace setting (preferred — visible in Settings UI).
    const fromSettings = vscode.workspace.getConfiguration('gitDiffViewer').get<string>('openRouterApiKey', '');
    if (fromSettings && fromSettings.trim()) return { key: fromSettings.trim(), source: 'settings' };
    // 2. Legacy globalState (older versions stored it here).
    const stored = context.globalState.get<string>(OPENROUTER_KEY_STATE);
    if (stored && stored.trim()) return { key: stored.trim(), source: 'state' };
    // 3. ~/.env fallback.
    const fromEnv = await readOpenRouterKeyFromEnvFile();
    if (fromEnv) return { key: fromEnv, source: 'env' };
    return { key: null, source: null };
}

interface AiConfig {
    model: string;
    analysisModel: string;
    reviewModel: string;
    commitModel: string;
    autoAnalyze: boolean;
    mode: 'local' | 'remote' | 'both';
    fallowPath: string;
    concurrency: number;
}

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

function getAiConfig(): AiConfig {
    const cfg = vscode.workspace.getConfiguration('gitDiffViewer');
    const base = (cfg.get<string>('model', '') || '').trim() || DEFAULT_MODEL;
    const pick = (key: string) => ((cfg.get<string>(key, '') || '').trim() || base);
    const modeRaw = cfg.get<string>('analysisMode', 'both');
    const mode: AiConfig['mode'] = modeRaw === 'local' ? 'local' : modeRaw === 'remote' ? 'remote' : 'both';
    const conc = Number(cfg.get<number>('analysisConcurrency', 3));
    return {
        model: base,
        analysisModel: pick('analysisModel'),
        reviewModel: pick('reviewModel'),
        commitModel: pick('commitModel'),
        autoAnalyze: cfg.get<boolean>('autoAnalyze', true),
        mode,
        fallowPath: (cfg.get<string>('fallowPath', '') || '').trim() || 'fallow',
        concurrency: Math.max(1, Math.min(8, Number.isFinite(conc) ? Math.floor(conc) : 3)),
    };
}

// Single OpenRouter entry point — every AI feature goes through here so the
// model stays configurable and requests stay abortable.
async function openRouterChat(key: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/git-diff-viewer',
            'X-Title': 'Git Diff Viewer',
        },
        body: JSON.stringify(body),
        signal,
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 600)}`);
    }
    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from model.');
    return String(content);
}

function stripJsonFences(raw: string): string {
    return raw.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
}

function sha1(text: string): string {
    return crypto.createHash('sha1').update(text).digest('hex');
}

interface FallowResult {
    ok: boolean;
    installed: boolean;
    report?: any;
    error?: string;
}

// Local static analysis via the fallow CLI (https://github.com/fallow-rs/fallow).
// Missing binary is a soft failure — the Architect Doc simply skips the section.
function runFallow(repoRoot: string, fallowBin: string, signal?: AbortSignal): Promise<FallowResult> {
    return new Promise((resolve) => {
        let settled = false;
        const done = (r: FallowResult) => { if (!settled) { settled = true; resolve(r); } };
        let proc: cp.ChildProcess;
        try {
            proc = cp.execFile(
                fallowBin,
                ['audit', '--changed-since', 'HEAD', '--format', 'json', '--quiet'],
                { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024, timeout: 60_000 },
                (err, stdout) => {
                    if ((err as any)?.code === 'ENOENT') {
                        done({ ok: false, installed: false, error: `fallow not found (looked for "${fallowBin}")` });
                        return;
                    }
                    // fallow exits non-zero on a "fail" verdict but still emits the
                    // JSON report on stdout — parse stdout regardless of exit code.
                    const out = String(stdout || '').trim();
                    if (out) {
                        try {
                            done({ ok: true, installed: true, report: JSON.parse(out) });
                            return;
                        } catch { /* fall through */ }
                    }
                    done({ ok: false, installed: true, error: err ? String((err as any).message ?? err).slice(0, 400) : 'empty fallow output' });
                }
            );
        } catch (e: any) {
            done({ ok: false, installed: false, error: e?.message ?? String(e) });
            return;
        }
        signal?.addEventListener('abort', () => {
            try { proc.kill(); } catch { /* already dead */ }
            done({ ok: false, installed: true, error: 'cancelled' });
        });
    });
}

interface ViewSettings {
    gridSize: 'sm' | 'md' | 'lg';
    gridMinColumnWidth: number;
}
const GRID_SIZE_PX: Record<string, number> = {
    sm: 560,
    md: 840,
    lg: 1200,
};
function getViewSettings(): ViewSettings {
    const cfg = vscode.workspace.getConfiguration('gitDiffViewer');
    const sizeRaw = cfg.get<string>('gridSize', 'md');
    const gridSize: 'sm' | 'md' | 'lg' =
        sizeRaw === 'sm' ? 'sm' : sizeRaw === 'lg' ? 'lg' : 'md';
    return {
        gridSize,
        gridMinColumnWidth: GRID_SIZE_PX[gridSize],
    };
}

function getEditorConfig(): EditorThemeConfig {
    const cfg = vscode.workspace.getConfiguration('editor');
    return {
        fontFamily: cfg.get<string>('fontFamily', '') || '',
        fontSize: cfg.get<number>('fontSize', 14),
        lineHeight: cfg.get<number>('lineHeight', 0),
        tabSize: cfg.get<number>('tabSize', 4),
        insertSpaces: cfg.get<boolean>('insertSpaces', true),
    };
}

async function getBranchInfo(repoRoot: string): Promise<{ branch: string; ahead: number; behind: number }> {
    let branch = '';
    let ahead = 0;
    let behind = 0;
    try {
        branch = (await gitExec(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    } catch { /* ignore */ }
    try {
        const counts = (await gitExec(repoRoot, ['rev-list', '--left-right', '--count', '@{u}...HEAD'])).trim();
        const [b, a] = counts.split(/\s+/).map(n => parseInt(n, 10) || 0);
        behind = b;
        ahead = a;
    } catch { /* no upstream — leave zero */ }
    return { branch, ahead, behind };
}

export function activate(context: vscode.ExtensionContext) {
    let panel: vscode.WebviewPanel | undefined;
    let activeRepoRoot: string | undefined;
    let watcher: vscode.FileSystemWatcher | undefined;
    let refreshTimer: NodeJS.Timeout | undefined;
    let refreshToken = 0;
    const ignoreCache = new Map<string, boolean>();
    const perFileContext = new Map<string, number>();
    const DEFAULT_CONTEXT = 10;

    // === Architect Doc — async changeset analysis ===
    // A new changeset signature aborts the in-flight run and starts over.
    // Per-file results are cached by (path, diff-hash) so a restart only
    // re-analyzes files whose diff actually changed.
    let analysisGen = 0;
    let analysisAbort: AbortController | undefined;
    let lastAnalysisSig = '';
    let lastChangesForAnalysis: FileChange[] = [];
    const fileAnalysisCache = new Map<string, any>();
    const FILE_ANALYSIS_CACHE_MAX = 300;

    // === Embedded terminal sessions (xterm.js + node-pty) ===
    const ptySessions = new Map<string, PtySession>();
    const killAllPtys = () => {
        for (const s of ptySessions.values()) {
            try { s.proc.kill(); } catch { /* ignore */ }
        }
        ptySessions.clear();
    };
    function shellQuote(s: string): string {
        return "'" + String(s).replace(/'/g, "'\\''") + "'";
    }

    const ptyCreate = async (
        id: string,
        label: string,
        command: string,
        args: string[],
        cols: number,
        rows: number,
        agent?: { binary: string; promptText: string },
    ) => {
        const pty = loadPty();
        if (!pty) {
            panel?.webview.postMessage({
                type: 'pty.error',
                id,
                error: `node-pty failed to load: ${ptyLoadError ?? 'unknown error'}`,
            });
            return;
        }
        // Default to user's actual login shell so PATH includes everything in
        // ~/.zshrc / ~/.bash_profile (Claude/Gemini installs are typically
        // there, e.g. /opt/homebrew/bin or ~/.local/bin).
        const realCmd = command && command.trim() ? command : (process.env.SHELL || '/bin/bash');
        let realArgs = Array.isArray(args) ? args.slice() : [];
        if (realArgs.length === 0) {
            // Interactive login shell — sources the user's profile.
            realArgs = ['-l', '-i'];
        }
        try {
            const proc = pty.spawn(realCmd, realArgs, {
                name: 'xterm-256color',
                cols: Math.max(2, cols | 0),
                rows: Math.max(2, rows | 0),
                cwd: activeRepoRoot ?? process.env.HOME ?? process.cwd(),
                env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1' },
            });
            ptySessions.set(id, { id, proc, label });
            proc.onData((data: string) => {
                panel?.webview.postMessage({ type: 'pty.data', id, data });
            });
            proc.onExit((evt: { exitCode: number; signal?: number }) => {
                ptySessions.delete(id);
                panel?.webview.postMessage({
                    type: 'pty.exit',
                    id,
                    code: evt.exitCode,
                    signal: evt.signal,
                });
            });
            panel?.webview.postMessage({ type: 'pty.ready', id, pid: proc.pid });

            // If an agent was requested (claude / gemini), drop the prompt to a
            // temp file and inject `agent "$(cat tmpfile)"` after the shell has
            // had a moment to source its profile and print its prompt.
            if (agent && agent.binary && agent.promptText) {
                try {
                    const tmpDir = os.tmpdir();
                    const tmpPath = path.join(tmpDir, `gdv-prompt-${Date.now()}-${id}.txt`);
                    await fsp.writeFile(tmpPath, agent.promptText, 'utf8');
                    setTimeout(() => {
                        if (!ptySessions.has(id)) return;
                        const cmd = `${shellQuote(agent.binary)} "$(cat ${shellQuote(tmpPath)})"\r`;
                        try { proc.write(cmd); } catch { /* dead pty */ }
                        // Best-effort cleanup after 10 minutes.
                        setTimeout(() => { fsp.unlink(tmpPath).catch(() => undefined); }, 10 * 60 * 1000);
                    }, 700);
                } catch (e: any) {
                    panel?.webview.postMessage({
                        type: 'pty.error',
                        id,
                        error: `Failed to stage agent prompt: ${e?.message ?? e}`,
                    });
                }
            }
        } catch (e: any) {
            panel?.webview.postMessage({
                type: 'pty.error',
                id,
                error: `Failed to spawn ${realCmd}: ${e?.message ?? e}`,
            });
        }
    };
    const ptyWrite = (id: string, data: string) => {
        const s = ptySessions.get(id);
        if (s) { try { s.proc.write(data); } catch { /* dead pty */ } }
    };
    const ptyResize = (id: string, cols: number, rows: number) => {
        const s = ptySessions.get(id);
        if (s) { try { s.proc.resize(Math.max(2, cols | 0), Math.max(2, rows | 0)); } catch { /* ignore */ } }
    };
    const ptyKill = (id: string) => {
        const s = ptySessions.get(id);
        if (!s) return;
        try { s.proc.kill(); } catch { /* ignore */ }
        ptySessions.delete(id);
    };

    const openPanel = async (opts: { silent?: boolean; preserveFocus?: boolean } = {}) => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            if (!opts.silent) vscode.window.showErrorMessage('Open a folder or workspace first.');
            return;
        }
        const repoRoot = await getRepoRoot(folder.uri.fsPath);
        if (!repoRoot) {
            if (!opts.silent) vscode.window.showErrorMessage('No git repository found in the current workspace.');
            return;
        }
        activeRepoRoot = repoRoot;

        if (panel) {
            panel.reveal(vscode.ViewColumn.Active, opts.preserveFocus);
            await refresh();
            return;
        }

        panel = vscode.window.createWebviewPanel(
            'gitDiffViewer',
            'Git Changes',
            { viewColumn: vscode.ViewColumn.Active, preserveFocus: !!opts.preserveFocus },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
            }
        );

        const mediaRoot = vscode.Uri.joinPath(context.extensionUri, 'media');
        panel.webview.html = getWebviewHtml({
            cspSource: panel.webview.cspSource,
            hlJsUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'highlight.min.js')).toString(),
            hlCssUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'highlight-bright.css')).toString(),
            xtermJsUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'xterm.js')).toString(),
            xtermCssUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'xterm.css')).toString(),
            xtermFitUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'addon-fit.js')).toString(),
            gridstackJsUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'gridstack-all.js')).toString(),
            gridstackCssUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'gridstack.min.css')).toString(),
            editor: getEditorConfig(),
        });

        // Push live editor config updates whenever the user changes settings.
        const cfgSub = vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (
                e.affectsConfiguration('editor.fontFamily') ||
                e.affectsConfiguration('editor.fontSize') ||
                e.affectsConfiguration('editor.lineHeight') ||
                e.affectsConfiguration('editor.tabSize') ||
                e.affectsConfiguration('editor.insertSpaces')
            ) {
                panel?.webview.postMessage({ type: 'editorConfig', editor: getEditorConfig() });
            }
            if (e.affectsConfiguration('gitDiffViewer.openRouterApiKey')) {
                const r = await resolveOpenRouterKey(context);
                panel?.webview.postMessage({
                    type: 'openRouterKeyStatus',
                    hasKey: !!r.key,
                    source: r.source,
                });
            }
            if (e.affectsConfiguration('gitDiffViewer.gridSize')) {
                panel?.webview.postMessage({ type: 'viewSettings', view: getViewSettings() });
            }
        });
        context.subscriptions.push(cfgSub);

        panel.webview.onDidReceiveMessage(async (msg) => {
            if (!activeRepoRoot) return;
            switch (msg.type) {
                case 'ready':
                case 'refresh':
                    await refresh();
                    return;
                case 'archDocRun':
                    void runAnalysis(lastChangesForAnalysis, true);
                    return;
                case 'archDocCancel':
                    analysisAbort?.abort();
                    analysisGen++;
                    panel?.webview.postMessage({ type: 'archDoc', phase: 'cancelled' });
                    return;
                case 'openFile': {
                    const uri = vscode.Uri.file(path.join(activeRepoRoot, msg.path));
                    await vscode.window.showTextDocument(uri, { preview: false });
                    return;
                }
                case 'openNativeDiff': {
                    const uri = vscode.Uri.file(path.join(activeRepoRoot, msg.path));
                    try {
                        await vscode.commands.executeCommand('git.openChange', uri);
                    } catch {
                        await vscode.window.showTextDocument(uri, { preview: false });
                    }
                    return;
                }
                case 'stage': {
                    try {
                        await gitExec(activeRepoRoot, ['add', '--', msg.path]);
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`git add failed: ${e.message}`);
                    }
                    return;
                }
                case 'unstage': {
                    try {
                        await gitExec(activeRepoRoot, ['reset', 'HEAD', '--', msg.path]);
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`git reset failed: ${e.message}`);
                    }
                    return;
                }
                case 'stageAll': {
                    try {
                        await gitExec(activeRepoRoot, ['add', '--all']);
                        vscode.window.setStatusBarMessage('$(check) Staged all changes', 2000);
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`git add --all failed: ${e.message}`);
                    }
                    return;
                }
                case 'pushOnly': {
                    try {
                        try {
                            await gitExec(activeRepoRoot, ['push']);
                        } catch (e: any) {
                            const errStr = String(e?.message ?? e ?? '');
                            if (/upstream|--set-upstream|has no upstream/i.test(errStr)) {
                                const branch = (await gitExec(activeRepoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
                                await gitExec(activeRepoRoot, ['push', '--set-upstream', 'origin', branch]);
                            } else {
                                throw e;
                            }
                        }
                        vscode.window.setStatusBarMessage('$(check) Pushed', 2500);
                        panel?.webview.postMessage({ type: 'pushResult', ok: true });
                        await refresh();
                    } catch (e: any) {
                        const errStr = e?.message ?? String(e);
                        vscode.window.showErrorMessage(`Push failed: ${errStr}`);
                        panel?.webview.postMessage({ type: 'pushResult', ok: false, error: errStr });
                    }
                    return;
                }
                case 'approveAllInFile': {
                    const target = String(msg.path || '').trim();
                    if (!target) return;
                    try {
                        await gitExec(activeRepoRoot, ['add', '--', target]);
                        vscode.window.setStatusBarMessage(`$(check) Approved ${target}`, 2000);
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Approve all failed: ${e.message}`);
                        await refresh();
                    }
                    return;
                }
                case 'unstageAll': {
                    try {
                        await gitExec(activeRepoRoot, ['reset', 'HEAD', '--']);
                        vscode.window.setStatusBarMessage('$(check) Unstaged all changes', 2000);
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`git reset failed: ${e.message}`);
                    }
                    return;
                }
                case 'setContext': {
                    const ctxLines: number = typeof msg.context === 'number' && msg.context > 0
                        ? Math.min(msg.context, 99999)
                        : DEFAULT_CONTEXT;
                    perFileContext.set(msg.path, ctxLines);
                    try {
                        const updated = await rediffOne(activeRepoRoot, msg.path, ctxLines);
                        if (updated) {
                            panel?.webview.postMessage({ type: 'fileUpdated', change: updated });
                        }
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`re-diff failed: ${e.message}`);
                    }
                    return;
                }
                case 'hideFile': {
                    const hidden = getHidden(context, activeRepoRoot);
                    if (!hidden.includes(msg.path)) {
                        hidden.push(msg.path);
                        await setHidden(context, activeRepoRoot, hidden);
                    }
                    panel?.webview.postMessage({ type: 'hiddenUpdated', hidden });
                    return;
                }
                case 'unhideFile': {
                    const hidden = getHidden(context, activeRepoRoot).filter(p => p !== msg.path);
                    await setHidden(context, activeRepoRoot, hidden);
                    panel?.webview.postMessage({ type: 'hiddenUpdated', hidden });
                    return;
                }
                case 'unhideAll': {
                    await setHidden(context, activeRepoRoot, []);
                    panel?.webview.postMessage({ type: 'hiddenUpdated', hidden: [] });
                    return;
                }
                case 'saveDraft': {
                    await context.workspaceState.update(draftKey(activeRepoRoot), msg.draft || '');
                    return;
                }
                case 'discardFile': {
                    const target = String(msg.path || '');
                    if (!target) return;
                    const choice = await vscode.window.showWarningMessage(
                        `Discard all changes to ${target}? This cannot be undone.`,
                        { modal: true },
                        'Discard'
                    );
                    if (choice !== 'Discard') return;
                    try {
                        if (msg.untracked) {
                            // Move to OS trash via VS Code (recoverable).
                            const uri = vscode.Uri.file(path.join(activeRepoRoot, target));
                            await vscode.workspace.fs.delete(uri, { useTrash: true, recursive: false });
                        } else {
                            await gitExec(activeRepoRoot, ['restore', '--source=HEAD', '--staged', '--worktree', '--', target]);
                        }
                        perFileContext.delete(target);
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Discard failed: ${e.message}`);
                    }
                    return;
                }
                case 'approveHunk': {
                    const target = String(msg.path || '');
                    const section: 'staged' | 'unstaged' = msg.section === 'staged' ? 'staged' : 'unstaged';
                    const hunkIndex = Number(msg.hunkIndex);
                    if (!target || !Number.isFinite(hunkIndex)) return;
                    if (section === 'staged') {
                        // Already staged — nothing to do.
                        return;
                    }
                    try {
                        const ctx = perFileContext.get(target) ?? DEFAULT_CONTEXT;
                        const patch = await extractHunkPatch(activeRepoRoot, target, 'unstaged', hunkIndex, ctx);
                        if (!patch) {
                            vscode.window.showErrorMessage('Could not locate hunk to approve.');
                            return;
                        }
                        await applyPatch(activeRepoRoot, patch, { cached: true });
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Approve hunk failed: ${e.message}`);
                        // Re-sync the webview so the optimistic dissolve
                        // animation gets reconciled with reality.
                        await refresh();
                    }
                    return;
                }
                case 'rejectHunk': {
                    const target = String(msg.path || '');
                    const section: 'staged' | 'unstaged' = msg.section === 'staged' ? 'staged' : 'unstaged';
                    const hunkIndex = Number(msg.hunkIndex);
                    if (!target || !Number.isFinite(hunkIndex)) return;
                    const choice = await vscode.window.showWarningMessage(
                        `Reject this hunk in ${target}? The change will be removed.`,
                        { modal: true },
                        'Reject'
                    );
                    if (choice !== 'Reject') return;
                    try {
                        const ctx = perFileContext.get(target) ?? DEFAULT_CONTEXT;
                        const patch = await extractHunkPatch(activeRepoRoot, target, section, hunkIndex, ctx);
                        if (!patch) {
                            vscode.window.showErrorMessage('Could not locate hunk to reject.');
                            return;
                        }
                        if (section === 'staged') {
                            // Unstage the hunk and undo it in the working tree (if it's also there).
                            await applyPatch(activeRepoRoot, patch, { reverse: true, cached: true });
                            try {
                                await applyPatch(activeRepoRoot, patch, { reverse: true });
                            } catch { /* working tree may differ; ignore */ }
                        } else {
                            await applyPatch(activeRepoRoot, patch, { reverse: true });
                        }
                        await refresh();
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Reject hunk failed: ${e.message}`);
                        await refresh();
                    }
                    return;
                }
                case 'addComment': {
                    const list = getComments(context, activeRepoRoot);
                    const c: InlineComment = {
                        id: makeId(),
                        file: String(msg.file || ''),
                        side: msg.side === 'left' ? 'left' : 'right',
                        lineNum: Number(msg.lineNum) || 0,
                        lineText: String(msg.lineText || ''),
                        body: String(msg.body || ''),
                        created: Date.now(),
                        updated: Date.now(),
                    };
                    list.push(c);
                    await setComments(context, activeRepoRoot, list);
                    panel?.webview.postMessage({ type: 'commentsUpdated', comments: list });
                    return;
                }
                case 'editComment': {
                    const list = getComments(context, activeRepoRoot);
                    const idx = list.findIndex(c => c.id === msg.id);
                    if (idx >= 0) {
                        list[idx].body = String(msg.body || '');
                        list[idx].updated = Date.now();
                        await setComments(context, activeRepoRoot, list);
                    }
                    panel?.webview.postMessage({ type: 'commentsUpdated', comments: list });
                    return;
                }
                case 'deleteComment': {
                    const list = getComments(context, activeRepoRoot).filter(c => c.id !== msg.id);
                    await setComments(context, activeRepoRoot, list);
                    panel?.webview.postMessage({ type: 'commentsUpdated', comments: list });
                    return;
                }
                case 'getOpenRouterKeyStatus': {
                    const r = await resolveOpenRouterKey(context);
                    panel?.webview.postMessage({
                        type: 'openRouterKeyStatus',
                        hasKey: !!r.key,
                        source: r.source,
                    });
                    return;
                }
                case 'setOpenRouterKey': {
                    const k = String(msg.key || '').trim();
                    try {
                        const cfg = vscode.workspace.getConfiguration('gitDiffViewer');
                        await cfg.update(
                            'openRouterApiKey',
                            k || undefined, // undefined removes the setting
                            vscode.ConfigurationTarget.Global,
                        );
                        // Also clear any legacy globalState entry if user is overwriting.
                        if (k) {
                            await context.globalState.update(OPENROUTER_KEY_STATE, undefined);
                        }
                        const r = await resolveOpenRouterKey(context);
                        panel?.webview.postMessage({
                            type: 'openRouterKeyStatus',
                            hasKey: !!r.key,
                            source: r.source,
                            saved: true,
                        });
                    } catch (e: any) {
                        panel?.webview.postMessage({
                            type: 'openRouterKeyStatus',
                            hasKey: false,
                            source: null,
                            error: e?.message ?? String(e),
                        });
                    }
                    return;
                }
                case 'setGridSize': {
                    const v = String(msg.size || '').toLowerCase();
                    const next = v === 'sm' || v === 'md' || v === 'lg' ? v : 'md';
                    try {
                        await vscode.workspace.getConfiguration('gitDiffViewer').update(
                            'gridSize', next, vscode.ConfigurationTarget.Global,
                        );
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Could not save grid size: ${e?.message ?? e}`);
                    }
                    panel?.webview.postMessage({ type: 'viewSettings', view: getViewSettings() });
                    return;
                }
                case 'openOpenRouterSettings': {
                    await vscode.commands.executeCommand(
                        'workbench.action.openSettings',
                        'gitDiffViewer.openRouterApiKey',
                    );
                    return;
                }
                case 'generateCommitMessage': {
                    if (!activeRepoRoot) return;
                    const r = await resolveOpenRouterKey(context);
                    if (!r.key) {
                        panel?.webview.postMessage({
                            type: 'commitMessageGenerated',
                            ok: false,
                            error: 'No OpenRouter API key. Click the key icon to enter one, or set OPENROUTER_API_KEY in ~/.env.',
                        });
                        return;
                    }
                    let diff = '';
                    try { diff = await gitExec(activeRepoRoot, ['diff', '--cached', '-U3']); } catch { /* ignore */ }
                    if (!diff.trim()) {
                        try { diff = await gitExec(activeRepoRoot, ['diff', '-U3']); } catch { /* ignore */ }
                    }
                    if (!diff.trim()) {
                        // Include status summary as a hint when there's no diff (e.g., only untracked files).
                        try {
                            const st = await gitExec(activeRepoRoot, ['status', '--short']);
                            if (st.trim()) diff = `# git status\n${st}`;
                        } catch { /* ignore */ }
                    }
                    if (!diff.trim()) {
                        panel?.webview.postMessage({
                            type: 'commitMessageGenerated',
                            ok: false,
                            error: 'Nothing to summarize — no diff and no pending changes.',
                        });
                        return;
                    }
                    const MAX_DIFF = 60_000;
                    let truncated = false;
                    if (diff.length > MAX_DIFF) {
                        diff = diff.slice(0, MAX_DIFF);
                        truncated = true;
                    }
                    try {
                        const body = {
                            model: getAiConfig().commitModel,
                            // Reasoning off — a commit message doesn't need
                            // chain-of-thought, and thinking tokens are the
                            // dominant source of latency.
                            reasoning: { enabled: false },
                            messages: [
                                {
                                    role: 'system',
                                    content:
                                        'You write concise, professional git commit messages. ' +
                                        'Output ONLY the commit message — no explanation, no markdown fencing, no surrounding quotes. ' +
                                        'Format: short subject line (<= 72 chars, imperative mood — e.g. "Fix X" not "Fixed X"). ' +
                                        'If the change warrants context, add a blank line and 1–3 short sentences describing what changed and why. ' +
                                        'Prefer specifics over generalities. Do not invent details that are not in the diff.',
                                },
                                {
                                    role: 'user',
                                    content: `Generate a commit message for this diff${truncated ? ' (truncated)' : ''}:\n\n${diff}`,
                                },
                            ],
                            temperature: 0.2,
                            // 200 tokens is plenty: 72-char subject + 1–3
                            // short body sentences.
                            max_tokens: 200,
                        };
                        const content = await openRouterChat(r.key, body);
                        // Strip surrounding markdown fences or quotes if model returned them anyway.
                        let cleaned = String(content).trim();
                        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
                        cleaned = cleaned.replace(/^["']/, '').replace(/["']$/, '');
                        panel?.webview.postMessage({
                            type: 'commitMessageGenerated',
                            ok: true,
                            message: cleaned.trim(),
                            truncated,
                        });
                    } catch (e: any) {
                        panel?.webview.postMessage({
                            type: 'commitMessageGenerated',
                            ok: false,
                            error: e?.message ?? String(e),
                        });
                    }
                    return;
                }
                case 'reviewAllDiffs': {
                    if (!activeRepoRoot) return;
                    const r = await resolveOpenRouterKey(context);
                    if (!r.key) {
                        panel?.webview.postMessage({
                            type: 'reviewAllDiffsResult', ok: false,
                            error: 'No OpenRouter API key. Click ⚙ in the commit bar to set one, or set OPENROUTER_API_KEY in ~/.env.',
                        });
                        return;
                    }
                    // Collect every changed file's full diff.
                    let combined = '';
                    let truncated = false;
                    try {
                        const status = await gitExec(activeRepoRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
                        const entries = parsePorcelain(status);
                        const PER_FILE_MAX = 12_000;
                        const TOTAL_MAX = 110_000;
                        for (const ent of entries) {
                            if (combined.length > TOTAL_MAX) { truncated = true; break; }
                            const isUntracked = ent.x === '?';
                            let d = '';
                            try {
                                if (isUntracked) {
                                    d = await gitExec(activeRepoRoot, [
                                        '-c', 'core.quotepath=false',
                                        'diff', '-U3', '--no-index', '--', '/dev/null', ent.path,
                                    ]);
                                } else {
                                    d = await gitExec(activeRepoRoot, [
                                        '-c', 'core.quotepath=false',
                                        'diff', 'HEAD', '-U3', '--', ent.path,
                                    ]);
                                }
                            } catch (err: any) {
                                if (err?.stdout) d = err.stdout;
                            }
                            if (!d.trim()) continue;
                            if (d.length > PER_FILE_MAX) {
                                d = d.slice(0, PER_FILE_MAX) + '\n[file truncated]\n';
                                truncated = true;
                            }
                            combined += `\n=== ${ent.path} ===\n${d}\n`;
                        }
                    } catch (e: any) {
                        panel?.webview.postMessage({
                            type: 'reviewAllDiffsResult', ok: false,
                            error: `Could not collect diffs: ${e?.message ?? e}`,
                        });
                        return;
                    }
                    if (!combined.trim()) {
                        panel?.webview.postMessage({
                            type: 'reviewAllDiffsResult', ok: false,
                            error: 'No changes to review — working tree is clean.',
                        });
                        return;
                    }
                    if (combined.length > 120_000) {
                        combined = combined.slice(0, 120_000);
                        truncated = true;
                    }
                    const branchInfo = await getBranchInfo(activeRepoRoot);
                    const system = [
                        'You are a senior software architect performing a thorough multi-file code review.',
                        'You receive a set of git diffs across files. Produce a clear, organized review in MARKDOWN.',
                        '',
                        'Structure your output with these sections (only include sections that are relevant):',
                        '',
                        '## Summary',
                        'A one-paragraph plain-English summary of what this changeset does.',
                        '',
                        '## Critical issues',
                        'Bugs, data loss, security holes, race conditions, broken APIs. Cite file + line. Include the suggested fix.',
                        '',
                        '## Major concerns',
                        'Likely-broken behavior, error-handling gaps, performance regressions, contract violations.',
                        '',
                        '## Architectural / design feedback',
                        'Layering, coupling, naming, duplication, missed abstractions, unintended cross-module dependencies.',
                        '',
                        '## Test coverage gaps',
                        'What is changed but not exercised by tests; what new edge cases need coverage.',
                        '',
                        '## Minor notes',
                        'Style, readability, small improvements. Keep this short — only include real items.',
                        '',
                        '## Verdict',
                        'One sentence: ship it / hold for fixes / needs major rework, with a confidence note.',
                        '',
                        'Rules:',
                        '- Be specific: cite filenames, function names, and line numbers from the diff hunk headers when possible.',
                        '- Quote the exact code line(s) you reference inside backtick fences for clarity.',
                        '- Include concrete patch suggestions (small code blocks) when proposing fixes.',
                        '- Skip sections that genuinely have nothing to say. Do not pad.',
                        '- Output ONLY the markdown report itself; no preamble like "Here is your review".',
                    ].join('\n');
                    const userPrompt = [
                        `Branch: ${branchInfo.branch}${branchInfo.ahead ? ` (↑${branchInfo.ahead})` : ''}${branchInfo.behind ? ` (↓${branchInfo.behind})` : ''}`,
                        '',
                        'Diffs:',
                        combined,
                        truncated ? '\n[NOTE: some diffs truncated to fit context window]' : '',
                    ].join('\n');
                    try {
                        const content = await openRouterChat(r.key, {
                            model: getAiConfig().reviewModel,
                            // Reasoning off — plenty for review-style output
                            // and a few seconds faster per call.
                            reasoning: { enabled: false },
                            messages: [
                                { role: 'system', content: system },
                                { role: 'user', content: userPrompt },
                            ],
                            temperature: 0.2,
                            max_tokens: 6000,
                        });
                        panel?.webview.postMessage({
                            type: 'reviewAllDiffsResult', ok: true,
                            markdown: String(content).trim(),
                            truncated,
                        });
                    } catch (e: any) {
                        panel?.webview.postMessage({
                            type: 'reviewAllDiffsResult', ok: false,
                            error: e?.message ?? String(e),
                        });
                    }
                    return;
                }
                case 'analyzeDiff': {
                    if (!activeRepoRoot) return;
                    const filePath = String(msg.path || '').trim();
                    if (!filePath) return;
                    const r = await resolveOpenRouterKey(context);
                    if (!r.key) {
                        panel?.webview.postMessage({
                            type: 'analyzeDiffResult',
                            ok: false,
                            path: filePath,
                            error: 'No OpenRouter API key. Click ⚙ in the commit bar to set one, or set OPENROUTER_API_KEY in ~/.env.',
                        });
                        return;
                    }
                    // Determine status (so we know whether to use --no-index for untracked).
                    let untracked = false;
                    try {
                        const st = await gitExec(activeRepoRoot, ['status', '--porcelain=v1', '-z', '--', filePath]);
                        const ents = parsePorcelain(st);
                        if (ents.length && ents[0].x === '?') untracked = true;
                    } catch { /* ignore */ }
                    // Build the file's full diff (HEAD vs working tree, or untracked synthesis).
                    let diff = '';
                    try {
                        if (untracked) {
                            diff = await gitExec(activeRepoRoot, [
                                '-c', 'core.quotepath=false',
                                'diff', '-U3', '--no-index', '--', '/dev/null', filePath,
                            ]);
                        } else {
                            diff = await gitExec(activeRepoRoot, [
                                '-c', 'core.quotepath=false',
                                'diff', 'HEAD', '-U3', '--', filePath,
                            ]);
                        }
                    } catch (e: any) {
                        if (e?.stdout) diff = e.stdout;
                    }
                    if (!diff.trim()) {
                        panel?.webview.postMessage({
                            type: 'analyzeDiffResult', ok: false, path: filePath,
                            error: 'No diff to analyze for this file.',
                        });
                        return;
                    }
                    const MAX_DIFF = 80_000;
                    let truncated = false;
                    if (diff.length > MAX_DIFF) {
                        diff = diff.slice(0, MAX_DIFF);
                        truncated = true;
                    }
                    const language = detectLanguage(filePath) || 'unknown';
                    const system = [
                        'You are a senior software architect performing critical code review on a git diff.',
                        'Identify real issues — bugs, security problems, race conditions, data corruption,',
                        'broken contracts, API misuse, error-handling gaps, performance cliffs, leaks,',
                        'concurrency mistakes, off-by-one, null/undefined hazards, missing input validation.',
                        '',
                        'Output STRICTLY a JSON object with this shape (no markdown, no fences, no commentary):',
                        '{ "issues": [',
                        '  {',
                        '    "side": "right" | "left",          // "right" = added/context, "left" = removed',
                        '    "lineNum": <integer>,              // line number from the diff hunk header',
                        '    "lineText": "<exact text of the line, no leading +/-/space>",',
                        '    "severity": "critical" | "major" | "minor" | "nit",',
                        '    "title": "<short summary, <= 60 chars>",',
                        '    "comment": "<detailed explanation + concrete suggested fix>"',
                        '  }',
                        '] }',
                        '',
                        'Rules:',
                        '- Only flag genuine problems. Empty array is fine if the diff is solid.',
                        '- Prefer fewer, higher-quality findings over noise. Skip nits unless severity allows it.',
                        '- Anchor each finding to the most relevant LINE in the diff (use the new-side line number for added/context, old-side for deleted).',
                        '- "lineText" must be the exact source line as it appears in the diff (without the leading + - or space character).',
                        '- "comment" should give the WHY and a concrete, copy-pasteable suggested change when possible.',
                    ].join('\n');
                    const userPrompt = `Language: ${language}\nFile: ${filePath}\n\nDiff:\n${diff}${truncated ? '\n\n[diff truncated for length]' : ''}`;
                    try {
                        const rawContent = await openRouterChat(r.key, {
                            model: getAiConfig().analysisModel,
                            // Reasoning off — analyze-diff returns a JSON
                            // shape the model already knows; thinking
                            // adds latency without measurable quality.
                            reasoning: { enabled: false },
                            messages: [
                                { role: 'system', content: system },
                                { role: 'user', content: userPrompt },
                            ],
                            temperature: 0.1,
                            max_tokens: 4000,
                            response_format: { type: 'json_object' },
                        });
                        // Strip stray markdown fences just in case.
                        const raw = stripJsonFences(rawContent);
                        let parsed: any;
                        try {
                            parsed = JSON.parse(raw);
                        } catch (e: any) {
                            panel?.webview.postMessage({
                                type: 'analyzeDiffResult', ok: false, path: filePath,
                                error: `Could not parse model JSON: ${e?.message ?? e}`,
                            });
                            return;
                        }
                        const list: any[] = Array.isArray(parsed?.issues) ? parsed.issues
                            : Array.isArray(parsed) ? parsed
                            : [];

                        // Replace prior AI-generated comments for this file so re-analyzing doesn't pile up.
                        const existing = getComments(context, activeRepoRoot);
                        const surviving = existing.filter(c => !(c.file === filePath && c.aiGenerated));
                        const now = Date.now();
                        const VALID_SEVERITY = new Set(['critical', 'major', 'minor', 'nit']);
                        const newComments: InlineComment[] = list
                            .filter(it => it && typeof it === 'object')
                            .map((it): InlineComment | null => {
                                const sev = String(it.severity || 'minor').toLowerCase();
                                const lineNum = Number(it.lineNum);
                                if (!Number.isFinite(lineNum) || lineNum < 1) return null;
                                const side: 'left' | 'right' = it.side === 'left' ? 'left' : 'right';
                                const title = String(it.title || '').trim();
                                const body = String(it.comment || '').trim();
                                if (!body && !title) return null;
                                const sevTag = VALID_SEVERITY.has(sev) ? sev : 'minor';
                                const composed = `🔍 [${sevTag.toUpperCase()}] ${title}\n\n${body}`.trim();
                                return {
                                    id: makeId(),
                                    file: filePath,
                                    side,
                                    lineNum,
                                    lineText: String(it.lineText || ''),
                                    body: composed,
                                    created: now,
                                    updated: now,
                                    aiGenerated: true,
                                    severity: sevTag as InlineComment['severity'],
                                };
                            })
                            .filter((c): c is InlineComment => c !== null);
                        const merged = surviving.concat(newComments);
                        await setComments(context, activeRepoRoot, merged);
                        panel?.webview.postMessage({ type: 'commentsUpdated', comments: merged });
                        panel?.webview.postMessage({
                            type: 'analyzeDiffResult', ok: true, path: filePath,
                            count: newComments.length, truncated,
                        });
                    } catch (e: any) {
                        panel?.webview.postMessage({
                            type: 'analyzeDiffResult', ok: false, path: filePath,
                            error: e?.message ?? String(e),
                        });
                    }
                    return;
                }
                case 'pty.create': {
                    const agent = msg.agent && typeof msg.agent === 'object'
                        ? {
                            binary: String(msg.agent.binary || '').trim(),
                            promptText: String(msg.agent.promptText || ''),
                        }
                        : undefined;
                    void ptyCreate(
                        String(msg.id || ''),
                        String(msg.label || 'Terminal'),
                        String(msg.command || ''),
                        Array.isArray(msg.args) ? msg.args : [],
                        Number(msg.cols) || 80,
                        Number(msg.rows) || 24,
                        agent && agent.binary ? agent : undefined,
                    );
                    return;
                }
                case 'pty.write': {
                    ptyWrite(String(msg.id || ''), String(msg.data || ''));
                    return;
                }
                case 'pty.resize': {
                    ptyResize(String(msg.id || ''), Number(msg.cols) || 80, Number(msg.rows) || 24);
                    return;
                }
                case 'pty.kill': {
                    ptyKill(String(msg.id || ''));
                    return;
                }
                case 'sendToAi': {
                    const target = String(msg.target || 'antigravity');
                    const message = String(msg.message || '');
                    if (!message.trim()) return;

                    // Always copy as a fallback — guarantees the user can paste
                    // even if the integration with the chosen tool fails.
                    try { await vscode.env.clipboard.writeText(message); } catch { /* ignore */ }

                    if (target === 'claude-code' || target === 'gemini-cli') {
                        // Open or reuse a VS Code terminal for the chosen agent.
                        const name = target === 'gemini-cli' ? 'Gemini CLI' : 'Claude Code';
                        const bin = target === 'gemini-cli' ? 'gemini' : 'claude';
                        let term = vscode.window.terminals.find(t => t.name === name);
                        if (!term) {
                            term = vscode.window.createTerminal({ name, cwd: activeRepoRoot });
                        }
                        term.show(false);
                        const tag = `__GDV_PROMPT_${Date.now()}__`;
                        const cmd = `${bin} "$(cat <<'${tag}'\n${message}\n${tag}\n)"`;
                        term.sendText(cmd, true);
                        vscode.window.setStatusBarMessage(`$(check) Sent prompt to ${name}`, 2500);
                        return;
                    }
                    if (target === 'embedded-claude' || target === 'embedded-gemini' || target === 'embedded-shell') {
                        // The webview spawns its own embedded pty. We just forward
                        // the prompt + which agent. The webview handles open/spawn/write.
                        panel?.webview.postMessage({
                            type: 'embeddedAi.spawn',
                            target,
                            message,
                            label: target === 'embedded-gemini' ? 'Gemini'
                                : target === 'embedded-shell' ? 'Shell'
                                : 'Claude',
                        });
                        return;
                    }

                    // Antigravity (or default): try a list of likely chat commands.
                    const commands: Array<{ id: string; arg?: any }> = [
                        { id: 'antigravity.openChat', arg: { query: message } },
                        { id: 'antigravity.chat.open', arg: { query: message } },
                        { id: 'antigravity.newConversation', arg: { query: message } },
                        { id: 'workbench.action.chat.open', arg: { query: message } },
                        { id: 'workbench.action.chat.openInSidebar', arg: { query: message } },
                        { id: 'workbench.panel.chat.view.copilot.focus' },
                    ];
                    let opened = false;
                    for (const c of commands) {
                        try {
                            await vscode.commands.executeCommand(c.id, c.arg);
                            opened = true;
                            break;
                        } catch { /* try next */ }
                    }
                    if (opened) {
                        vscode.window.setStatusBarMessage(
                            '$(check) Opened AI chat — prompt also copied to clipboard',
                            3500
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            'Could not open Antigravity chat directly. Prompt is copied to your clipboard — open the chat panel and paste.'
                        );
                    }
                    return;
                }
                case 'copyToClipboard': {
                    try {
                        await vscode.env.clipboard.writeText(String(msg.text || ''));
                        vscode.window.setStatusBarMessage(
                            `$(check) Git Diff Viewer: copied${msg.label ? ' ' + msg.label : ''} to clipboard`,
                            2500
                        );
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Copy failed: ${e.message}`);
                    }
                    return;
                }
                case 'setAutoExpandRecent': {
                    await context.workspaceState.update(autoExpandKey(activeRepoRoot), !!msg.value);
                    return;
                }
                case 'commit': {
                    const message = String(msg.message || '').trim();
                    const amend = !!msg.amend;
                    const stageAll = !!msg.stageAll;
                    const push = !!msg.push;
                    if (!message && !amend) {
                        vscode.window.showErrorMessage('Commit message is empty.');
                        panel?.webview.postMessage({ type: 'commitResult', ok: false, error: 'Empty commit message.' });
                        return;
                    }
                    try {
                        if (stageAll) {
                            await gitExec(activeRepoRoot, ['add', '--all']);
                        }
                        const args = ['commit'];
                        if (amend) args.push('--amend');
                        if (message) args.push('-m', message);
                        else if (amend) args.push('--no-edit');
                        await gitExec(activeRepoRoot, args);
                        let head = '';
                        try {
                            head = (await gitExec(activeRepoRoot, ['log', '-1', '--pretty=format:%h %s'])).trim();
                        } catch { /* ignore */ }

                        let pushed = false;
                        if (push) {
                            try {
                                await gitExec(activeRepoRoot, ['push']);
                                pushed = true;
                            } catch (e: any) {
                                const errStr = String(e?.message ?? e ?? '');
                                // No upstream configured yet — set it on the first push.
                                if (/upstream|--set-upstream|has no upstream/i.test(errStr)) {
                                    try {
                                        const branch = (await gitExec(activeRepoRoot, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
                                        await gitExec(activeRepoRoot, ['push', '--set-upstream', 'origin', branch]);
                                        pushed = true;
                                    } catch (e2: any) {
                                        vscode.window.showErrorMessage(`Commit succeeded, but push failed: ${e2?.message ?? e2}`);
                                    }
                                } else {
                                    vscode.window.showErrorMessage(`Commit succeeded, but push failed: ${errStr}`);
                                }
                            }
                        }

                        const successMsg = `Committed${head ? `: ${head}` : ''}${pushed ? ' (and pushed)' : ''}`;
                        vscode.window.showInformationMessage(successMsg);
                        await context.workspaceState.update(draftKey(activeRepoRoot), '');
                        // Stale per-file UI state for files that just got committed.
                        perFileContext.clear();
                        // Drop hidden entries for paths that no longer have any changes
                        // (post-commit clean state). We re-derive against the next refresh.
                        try {
                            const stillChanged = await gitExec(activeRepoRoot, ['status', '--porcelain=v1', '-z']);
                            const live = new Set(parsePorcelain(stillChanged).map(e => e.path));
                            const hidden = getHidden(context, activeRepoRoot).filter(p => live.has(p));
                            await setHidden(context, activeRepoRoot, hidden);
                        } catch { /* best effort */ }
                        panel?.webview.postMessage({ type: 'commitResult', ok: true, head, pushed });
                        await refresh();
                    } catch (e: any) {
                        const errMsg = e.message ?? String(e);
                        vscode.window.showErrorMessage(`git commit failed: ${errMsg}`);
                        panel?.webview.postMessage({ type: 'commitResult', ok: false, error: errMsg });
                    }
                    return;
                }
            }
        });

        const scheduleRefresh = () => {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => { void refresh(); }, 150);
        };

        const handleFsEvent = async (uri: vscode.Uri) => {
            if (!activeRepoRoot) return;
            const relRaw = path.relative(activeRepoRoot, uri.fsPath);
            if (!relRaw || relRaw.startsWith('..') || path.isAbsolute(relRaw)) return;
            if (isInsideGitDir(relRaw)) return;

            // .gitignore changes invalidate prior ignore decisions.
            if (path.basename(relRaw) === '.gitignore' || relRaw === '.gitattributes') {
                ignoreCache.clear();
                scheduleRefresh();
                return;
            }

            let ignored = ignoreCache.get(relRaw);
            if (ignored === undefined) {
                ignored = await checkIgnored(activeRepoRoot, relRaw);
                ignoreCache.set(relRaw, ignored);
            }
            if (ignored) return;
            scheduleRefresh();
        };

        watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '**/*')
        );
        watcher.onDidChange(handleFsEvent);
        watcher.onDidCreate(handleFsEvent);
        watcher.onDidDelete((uri) => {
            ignoreCache.delete(path.relative(activeRepoRoot ?? '', uri.fsPath));
            void handleFsEvent(uri);
        });

        // Re-render on tab/active editor save (covers cases where the FS watcher
        // is throttled by the OS).
        const saveSub = vscode.workspace.onDidSaveTextDocument((doc) => handleFsEvent(doc.uri));
        context.subscriptions.push(saveSub);

        panel.onDidDispose(() => {
            killAllPtys();
            panel = undefined;
            watcher?.dispose();
            watcher = undefined;
            if (refreshTimer) clearTimeout(refreshTimer);
            perFileContext.clear();
            ignoreCache.clear();
            analysisAbort?.abort();
            lastAnalysisSig = '';
        });

        await refresh();
    };

    const openCmd = vscode.commands.registerCommand('gitDiffViewer.open', () => openPanel());
    const refreshCmd = vscode.commands.registerCommand('gitDiffViewer.refresh', () => refresh());

    // Architect Doc pipeline. Stage A: fallow static analysis (local, instant).
    // Stage B: per-file LLM summaries (pool, cache-aware). Stage C: synthesis
    // into a compact architecture overview. Any changeset change aborts and
    // restarts; only files whose diff hash changed hit the network again.
    const runAnalysis = async (changes: FileChange[], force = false) => {
        if (!panel || !activeRepoRoot) return;
        const ai = getAiConfig();
        lastChangesForAnalysis = changes;
        const files = changes.filter(c => !c.binary && (c.diff || '').trim());
        const sig = files.map(c => c.path + ':' + sha1(c.diff)).sort().join('|');
        if (!force && sig === lastAnalysisSig) return;
        lastAnalysisSig = sig;
        analysisAbort?.abort();
        const ctrl = new AbortController();
        analysisAbort = ctrl;
        const gen = ++analysisGen;
        const repoRoot = activeRepoRoot;
        const post = (m: Record<string, unknown>) => {
            if (gen === analysisGen && panel) panel.webview.postMessage({ ...m, type: 'archDoc', gen });
        };
        if (!files.length) {
            post({ phase: 'empty' });
            return;
        }
        post({ phase: 'start', total: files.length });

        // Stage A — independent of the LLM path; lands whenever it finishes.
        if (ai.mode !== 'remote') {
            void runFallow(repoRoot, ai.fallowPath, ctrl.signal).then(f => {
                if (!ctrl.signal.aborted) post({ phase: 'static', ...f });
            });
        }

        if (ai.mode === 'local') { post({ phase: 'done', localOnly: true }); return; }

        const r = await resolveOpenRouterKey(context);
        if (ctrl.signal.aborted) return;
        if (!r.key) {
            post({ phase: 'error', error: 'No OpenRouter API key. Click ⚙ in the commit bar to set one, or set OPENROUTER_API_KEY in ~/.env.' });
            return;
        }
        const key = r.key;

        // Stage B — per-file summaries.
        const fileSystem = [
            'You summarize one git diff for a human reviewer scanning many AI-generated changes.',
            'Output STRICT JSON (no fences, no commentary):',
            '{ "summary": "<ONE line, <= 110 chars: what changed and why it matters>",',
            '  "risk": "low" | "medium" | "high",',
            '  "flags": ["<up to 3 ultra-short notes on real problems; empty array if none>"] }',
            'Be maximally terse. No filler words. Concrete over generic.',
        ].join('\n');
        const PER_FILE_DIFF_MAX = 24_000;
        const results: Array<{ path: string; summary: string; risk: string; flags: string[] }> = [];
        let completed = 0;
        const queue = files.slice();
        const worker = async () => {
            for (;;) {
                const c = queue.shift();
                if (!c || ctrl.signal.aborted) return;
                const cacheKey = c.path + ' ' + sha1(c.diff);
                let out = fileAnalysisCache.get(cacheKey);
                if (!out) {
                    let diff = c.diff;
                    let truncated = false;
                    if (diff.length > PER_FILE_DIFF_MAX) { diff = diff.slice(0, PER_FILE_DIFF_MAX); truncated = true; }
                    try {
                        const raw = await openRouterChat(key, {
                            model: ai.analysisModel,
                            reasoning: { enabled: false },
                            messages: [
                                { role: 'system', content: fileSystem },
                                { role: 'user', content: `File: ${c.path} (${c.statusLabel}, +${c.additions}/-${c.deletions})\n\nDiff:\n${diff}${truncated ? '\n[diff truncated]' : ''}` },
                            ],
                            temperature: 0.1,
                            max_tokens: 400,
                            response_format: { type: 'json_object' },
                        }, ctrl.signal);
                        const parsed = JSON.parse(stripJsonFences(raw));
                        out = {
                            summary: String(parsed?.summary ?? '').slice(0, 160),
                            risk: ['low', 'medium', 'high'].includes(String(parsed?.risk)) ? String(parsed.risk) : 'low',
                            flags: Array.isArray(parsed?.flags) ? parsed.flags.slice(0, 3).map((f: any) => String(f).slice(0, 120)) : [],
                        };
                        fileAnalysisCache.set(cacheKey, out);
                        while (fileAnalysisCache.size > FILE_ANALYSIS_CACHE_MAX) {
                            const oldest = fileAnalysisCache.keys().next().value;
                            if (oldest === undefined) break;
                            fileAnalysisCache.delete(oldest);
                        }
                    } catch (e: any) {
                        if (ctrl.signal.aborted) return;
                        out = { summary: '', risk: 'unknown', flags: [], error: String(e?.message ?? e).slice(0, 200) };
                    }
                }
                completed++;
                results.push({ path: c.path, ...out });
                post({ phase: 'file', path: c.path, completed, total: files.length, result: out });
            }
        };
        await Promise.all(Array.from({ length: Math.min(ai.concurrency, files.length) }, () => worker()));
        if (ctrl.signal.aborted || gen !== analysisGen) return;

        // Stage C — synthesis.
        try {
            const branchInfo = await getBranchInfo(repoRoot);
            const fileLines = results
                .map(x => `- ${x.path} [${x.risk}] ${x.summary}${x.flags?.length ? ' | flags: ' + x.flags.join('; ') : ''}`)
                .join('\n');
            const overviewSystem = [
                'You are a senior architect writing an ultra-compact review doc for a large, possibly AI-generated changeset.',
                'Input: per-file one-line summaries with risk levels. Output MARKDOWN, maximally terse — the reader is scanning, not reading.',
                '',
                'Sections (skip any with nothing real to say):',
                '## TL;DR',
                'Max 2 sentences: what this changeset does.',
                '## Architecture',
                'Max 6 bullets: modules touched, data-flow changes, new coupling, boundary concerns.',
                '## Risks',
                'Bullets, each "file — risk", highest risk first. Only medium/high.',
                '## Verdict',
                'One line: ship / hold for fixes / needs rework.',
                '',
                'No filler. No praise. No restating the file list.',
            ].join('\n');
            const overview = await openRouterChat(key, {
                model: ai.reviewModel,
                reasoning: { enabled: false },
                messages: [
                    { role: 'system', content: overviewSystem },
                    { role: 'user', content: `Branch: ${branchInfo.branch}\nFiles changed: ${files.length}\n\nPer-file summaries:\n${fileLines}` },
                ],
                temperature: 0.2,
                max_tokens: 1200,
            }, ctrl.signal);
            post({ phase: 'overview', markdown: overview.trim() });
        } catch (e: any) {
            if (!ctrl.signal.aborted) post({ phase: 'error', error: `Overview failed: ${String(e?.message ?? e).slice(0, 300)}` });
        }
        post({ phase: 'done' });
    };

    const refresh = async () => {
        if (!panel || !activeRepoRoot) return;
        const token = ++refreshToken;
        try {
            const [changes, branchInfo] = await Promise.all([
                collectChanges(activeRepoRoot, DEFAULT_CONTEXT, perFileContext),
                getBranchInfo(activeRepoRoot),
            ]);
            // Drop stale results — a newer refresh has been queued.
            if (token !== refreshToken || !panel) return;
            const hidden = getHidden(context, activeRepoRoot);
            const draft = context.workspaceState.get<string>(draftKey(activeRepoRoot), '');
            const comments = getComments(context, activeRepoRoot);
            const autoExpandRecent = context.workspaceState.get<boolean>(autoExpandKey(activeRepoRoot), false);
            const view = getViewSettings();
            panel.webview.postMessage({
                type: 'state',
                repoRoot: activeRepoRoot,
                branch: branchInfo,
                changes,
                hidden,
                draft,
                comments,
                autoExpandRecent,
                view,
            });
            lastChangesForAnalysis = changes;
            if (getAiConfig().autoAnalyze) void runAnalysis(changes);
        } catch (e: any) {
            if (token !== refreshToken || !panel) return;
            panel.webview.postMessage({ type: 'error', message: e.message ?? String(e) });
        }
    };

    context.subscriptions.push(openCmd, refreshCmd);

    const cfg = vscode.workspace.getConfiguration('gitDiffViewer');
    if (cfg.get<boolean>('autoOpenOnStartup', true)) {
        const preserveFocus = !cfg.get<boolean>('autoOpenFocus', false);
        // Defer slightly so the workbench finishes restoring its layout first.
        setTimeout(() => { void openPanel({ silent: true, preserveFocus }); }, 400);
    }
}

export function deactivate() { /* no-op */ }
