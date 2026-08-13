interface WebviewAssets {
    cspSource: string;
    hlJsUri: string;
    hlCssUri: string;
    xtermJsUri: string;
    xtermCssUri: string;
    xtermFitUri: string;
    gridstackJsUri: string;
    gridstackCssUri: string;
    threeUri: string;
    /** the Code Map renderer module (media/map.js) */
    mapJsUri: string;
    editor: {
        fontFamily: string;
        fontSize: number;
        lineHeight: number;
        tabSize: number;
        insertSpaces: boolean;
    };
}

const FALLBACK_MONO = `ui-monospace, 'SF Mono', 'SFMono-Regular', Menlo, Monaco, 'Cascadia Mono', 'Cascadia Code', Consolas, 'Liberation Mono', 'DejaVu Sans Mono', 'Courier New', monospace`;

function buildEditorVars(e: WebviewAssets['editor']): string {
    const userFont = (e.fontFamily || '').trim();
    const monoStack = userFont ? `${userFont}, ${FALLBACK_MONO}` : FALLBACK_MONO;
    const fontSize = Number.isFinite(e.fontSize) && e.fontSize > 0 ? e.fontSize : 14;
    const lineHeightCss = e.lineHeight > 0
        ? (e.lineHeight < 8 ? `${e.lineHeight}` : `${e.lineHeight}px`)  // VS Code allows ratios <8 or px values
        : '1.5';
    const tabSize = Number.isFinite(e.tabSize) && e.tabSize > 0 ? e.tabSize : 4;
    return [
        `--diff-mono: ${monoStack};`,
        `--editor-font-size: ${fontSize}px;`,
        `--editor-line-height: ${lineHeightCss};`,
        `--editor-tab-size: ${tabSize};`,
    ].join('\n        ');
}

export function getWebviewHtml(a: WebviewAssets): string {
    const csp = [
        `default-src 'none'`,
        `style-src ${a.cspSource} 'unsafe-inline'`,
        `script-src ${a.cspSource} 'unsafe-inline'`,
        `font-src ${a.cspSource}`,
        `img-src ${a.cspSource} data:`,
    ].join('; ');
    const editorVars = buildEditorVars(a.editor);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<title>Git Changes</title>
<link rel="stylesheet" href="${a.hlCssUri}" />
<link rel="stylesheet" href="${a.xtermCssUri}" />
<link rel="stylesheet" href="${a.gridstackCssUri}" />
<script src="${a.hlJsUri}"></script>
<script src="${a.xtermJsUri}"></script>
<script src="${a.xtermFitUri}"></script>
<script src="${a.gridstackJsUri}"></script>
<style>
    :root {
        /* Editor settings injected by the extension — see buildEditorVars().
           These can be live-updated via the editorConfig message. */
        ${editorVars}

        /* === Dark theme (default) === */
        --diff-fg: #ffffff;
        --add-bg: rgba(0, 255, 100, 0.20);
        --add-line: #00ff66;
        --add-num-bg: rgba(0, 255, 100, 0.32);
        --add-num-fg: #00ff66;
        --del-bg: rgba(255, 60, 100, 0.22);
        --del-line: #ff3366;
        --del-num-bg: rgba(255, 60, 100, 0.32);
        --del-num-fg: #ff3366;
        --num-bg: rgba(255, 255, 255, 0.06);
        --empty-bg: rgba(255, 255, 255, 0.02);
        --hunk-bg: rgba(0, 255, 255, 0.06);
        --hunk-header-fg: #00ffff;
        --hunk-header-bg: rgba(0, 255, 255, 0.08);
        --section-title-fg: #ffff66;
        --row-num: #ffffff;
        --border: rgba(255, 255, 255, 0.25);
        --expand-bg: rgba(0, 212, 255, 0.10);
        --expand-bg-hover: rgba(0, 212, 255, 0.22);
        --expand-fg: #00d4ff;
        --file-approved-bg: rgba(0, 255, 100, 0.10);
        --file-approved-fg: #00ff66;
        --file-rejected-bg: rgba(255, 60, 100, 0.10);
        --file-rejected-fg: #ff3366;
        --action-approved-bg: rgba(0, 255, 100, 0.16);
        --action-approved-fg: #00ff66;
        --action-approved-border: rgba(0, 255, 100, 0.55);
        --action-rejected-bg: rgba(255, 60, 100, 0.16);
        --action-rejected-fg: #ff3366;
        --action-rejected-border: rgba(255, 60, 100, 0.55);
        --recent-bg: rgba(56, 139, 253, 0.18);
        --recent-fg: #58a6ff;
        --recent-border: rgba(56, 139, 253, 0.4);

        /* Highlight tokens — bright for dark bg */
        --hl-comment: #00ffff;
        --hl-keyword: #ff2ad4;
        --hl-string: #00ff66;
        --hl-number: #ffae00;
        --hl-function: #ffff00;
        --hl-builtin: #ff66cc;
        --hl-variable: #00d4ff;
        --hl-property: #66ffff;
        --hl-attribute: #ffff66;
        --hl-tag: #ff2ad4;
        --hl-meta: #ffff66;
        --hl-operator: #ffffff;
        --hl-deletion: #ff5577;
        --hl-addition: #66ff77;
    }

    /* === Light theme overrides — readable on white === */
    body.vscode-light, body.vscode-high-contrast-light {
        --diff-fg: #1f2328;
        --add-bg: rgba(46, 160, 67, 0.18);
        --add-line: #1a7f37;
        --add-num-bg: rgba(46, 160, 67, 0.26);
        --add-num-fg: #1a7f37;
        --del-bg: rgba(207, 34, 46, 0.16);
        --del-line: #cf222e;
        --del-num-bg: rgba(207, 34, 46, 0.22);
        --del-num-fg: #cf222e;
        --num-bg: rgba(0, 0, 0, 0.04);
        --empty-bg: rgba(0, 0, 0, 0.02);
        --hunk-bg: rgba(0, 86, 197, 0.05);
        --hunk-header-fg: #0550ae;
        --hunk-header-bg: rgba(0, 86, 197, 0.08);
        --section-title-fg: #9a6700;
        --row-num: #57606a;
        --border: rgba(0, 0, 0, 0.18);
        --expand-bg: rgba(9, 105, 218, 0.06);
        --expand-bg-hover: rgba(9, 105, 218, 0.14);
        --expand-fg: #0969da;
        --file-approved-bg: rgba(46, 160, 67, 0.12);
        --file-approved-fg: #1a7f37;
        --file-rejected-bg: rgba(207, 34, 46, 0.10);
        --file-rejected-fg: #cf222e;
        --action-approved-bg: rgba(46, 160, 67, 0.14);
        --action-approved-fg: #1a7f37;
        --action-approved-border: rgba(46, 160, 67, 0.55);
        --action-rejected-bg: rgba(207, 34, 46, 0.12);
        --action-rejected-fg: #cf222e;
        --action-rejected-border: rgba(207, 34, 46, 0.55);
        --recent-bg: rgba(9, 105, 218, 0.10);
        --recent-fg: #0969da;
        --recent-border: rgba(9, 105, 218, 0.4);

        /* Highlight tokens — GitHub Primer Light */
        --hl-comment: #6e7781;
        --hl-keyword: #cf222e;
        --hl-string: #0a3069;
        --hl-number: #0550ae;
        --hl-function: #8250df;
        --hl-builtin: #953800;
        --hl-variable: #24292f;
        --hl-property: #116329;
        --hl-attribute: #0550ae;
        --hl-tag: #116329;
        --hl-meta: #6639ba;
        --hl-operator: #1f2328;
        --hl-deletion: #82071e;
        --hl-addition: #116329;
    }
    * { box-sizing: border-box; }
    html, body {
        margin: 0; padding: 0; height: 100%;
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
    }
    .toolbar {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
        padding: 8px 12px;
        background: var(--vscode-sideBar-background, var(--vscode-editor-background));
        border-bottom: 1px solid var(--border);
    }
    .toolbar .meta { display: flex; flex-direction: column; line-height: 1.2; margin-right: auto; }
    .toolbar .meta .repo { font-size: 11px; opacity: 0.7; max-width: 60vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .toolbar .meta .branch { font-weight: 600; }
    .toolbar .meta .branch .ahead-behind { margin-left: 6px; font-weight: normal; opacity: 0.75; font-size: 11px; }
    .toolbar button, .toolbar input[type="search"] {
        font: inherit; padding: 4px 10px;
        background: var(--vscode-button-secondaryBackground, transparent);
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--border); border-radius: 3px; cursor: pointer;
    }
    .toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.15)); }
    .toolbar input[type="search"] { cursor: text; min-width: 180px; }
    .toolbar .summary { font-size: 11px; opacity: 0.75; }

    .commit-bar {
        display: flex; gap: 8px; align-items: stretch;
        padding: 8px 12px;
        background: var(--vscode-sideBar-background, var(--vscode-editor-background));
        border-bottom: 1px solid var(--border);
    }
    .commit-bar textarea {
        flex: 1;
        min-height: 36px;
        max-height: 160px;
        resize: vertical;
        padding: 6px 8px;
        font: inherit;
        font-family: var(--diff-mono);
        background: var(--vscode-input-background, transparent);
        color: var(--vscode-input-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 3px;
    }
    .commit-bar .commit-actions {
        display: flex; flex-direction: column; gap: 4px; align-items: stretch;
        min-width: 170px;
    }
    .commit-bar label {
        font-size: 11px; display: flex; gap: 6px; align-items: center;
    }
    .commit-bar button {
        font: inherit; font-weight: 600;
        padding: 6px 12px;
        background: var(--vscode-button-background, #0e639c);
        color: var(--vscode-button-foreground, white);
        border: 1px solid var(--vscode-button-background, #0e639c);
        border-radius: 3px; cursor: pointer;
    }
    .commit-bar button.secondary {
        font-weight: normal;
        background: var(--vscode-button-secondaryBackground, transparent);
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--border);
    }
    .commit-bar button:disabled {
        opacity: 0.5; cursor: not-allowed;
    }
    .commit-bar button:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground, #1177bb);
    }
    .commit-bar button.secondary:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.15));
    }
    .commit-status {
        font-size: 11px; opacity: 0.8;
        align-self: center;
        padding: 0 8px;
    }
    .commit-status.error { color: var(--vscode-errorForeground, #f85149); }
    .commit-status.ok { color: #3fb950; }

    .commit-msg-wrap { display: flex; flex-direction: column; flex: 1; gap: 4px; }
    .commit-key-row {
        display: flex; gap: 6px; align-items: center;
        font-size: 11px;
    }
    .commit-key-row input[type="password"] {
        flex: 1;
        font: inherit;
        font-family: var(--diff-mono);
        font-size: 11px;
        padding: 4px 8px;
        background: var(--vscode-input-background, transparent);
        color: var(--vscode-input-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 3px;
    }
    .commit-key-row button {
        font: inherit; font-size: 11px;
        padding: 3px 10px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--border);
        border-radius: 3px; cursor: pointer;
    }
    .commit-key-row button:hover { background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1)); }
    .commit-key-status { opacity: 0.75; font-size: 11px; }
    .commit-key-status.ok { color: #3fb950; }
    .commit-key-status.error { color: var(--vscode-errorForeground, #f85149); }

    /* Floating Generate (✨) + key (⚙) buttons inside the textarea. */
    .commit-msg-container {
        position: relative;
        flex: 1;
        display: flex;
    }
    .commit-msg-container > textarea {
        flex: 1;
        padding-right: 64px;
    }
    .commit-msg-floating {
        position: absolute;
        top: 4px;
        right: 6px;
        display: flex;
        gap: 4px;
        z-index: 2;
    }
    .commit-msg-floating button {
        width: 26px; height: 26px;
        padding: 0;
        font: inherit;
        font-size: 14px;
        line-height: 1;
        background: var(--vscode-button-secondaryBackground, transparent);
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--border);
        border-radius: 4px;
        cursor: pointer;
        opacity: 0.85;
    }
    .commit-msg-floating button:hover {
        opacity: 1;
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.15));
    }
    .commit-msg-floating button:disabled {
        opacity: 0.5; cursor: not-allowed;
    }
    .commit-msg-floating button#commit-generate {
        font-size: 13px;
    }

    .hidden-pill {
        display: none;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: rgba(127,127,127,0.12);
        cursor: pointer;
    }
    .hidden-pill.has-hidden { display: inline-flex; align-items: center; gap: 6px; }
    .hidden-pill:hover { background: rgba(127,127,127,0.25); }

    .hidden-list {
        display: none;
        padding: 6px 12px;
        border-bottom: 1px solid var(--border);
        background: var(--hunk-bg);
        font-size: 11px;
    }
    .hidden-list.open { display: block; }
    .hidden-list .h-row {
        display: flex; gap: 8px; align-items: center;
        padding: 2px 0;
        font-family: var(--diff-mono);
    }
    .hidden-list .h-row .path { flex: 1; opacity: 0.85; }
    .hidden-list button {
        font: inherit; font-size: 11px;
        padding: 1px 8px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--border); border-radius: 3px; cursor: pointer;
    }
    .hidden-list button:hover { background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1)); }

    .file-actions .icon-btn {
        padding: 2px 6px; font-size: 13px; line-height: 1;
    }
    .file-actions .danger {
        color: #f85149;
        border-color: rgba(248, 81, 73, 0.5);
    }
    .file-actions .danger:hover {
        background: rgba(248, 81, 73, 0.15);
    }

    .hunk-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .hunk-header .hunk-text {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .hunk-actions { display: flex; gap: 4px; }
    .hunk-actions button {
        font: inherit; font-size: 11px;
        padding: 1px 8px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--border);
        border-radius: 3px; cursor: pointer;
    }
    .hunk-actions button.approve {
        color: #3fb950;
        border-color: rgba(46, 160, 67, 0.5);
    }
    .hunk-actions button.approve:hover {
        background: rgba(46, 160, 67, 0.15);
    }
    .hunk-actions button.reject {
        color: #f85149;
        border-color: rgba(248, 81, 73, 0.5);
    }
    .hunk-actions button.reject:hover {
        background: rgba(248, 81, 73, 0.15);
    }

    /* Recent badge for files sorted by mtime in auto-expand mode. */
    .file.most-recent .file-header { box-shadow: inset 3px 0 0 var(--recent-fg); }
    .recent-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        background: var(--recent-bg);
        color: var(--recent-fg);
        border: 1px solid var(--recent-border);
    }

    /* File-level approve / reject status (per-session). Layered as bg-image
       over the file-header's solid base so sticky positioning still hides
       scrolling content beneath it. */
    .file.file-approved > .file-header {
        background-image: linear-gradient(var(--file-approved-bg), var(--file-approved-bg));
    }
    .file.file-approved .file-header .path { color: var(--file-approved-fg); font-weight: 700; }
    .file.file-rejected > .file-header {
        background-image: linear-gradient(var(--file-rejected-bg), var(--file-rejected-bg));
    }
    .file.file-rejected .file-header .path { color: var(--file-rejected-fg); font-weight: 700; }
    .action-tag {
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .action-tag.approved {
        color: var(--action-approved-fg);
        background: var(--action-approved-bg);
        border: 1px solid var(--action-approved-border);
    }
    .action-tag.rejected {
        color: var(--action-rejected-fg);
        background: var(--action-rejected-bg);
        border: 1px solid var(--action-rejected-border);
    }

    /* Comment affordance — a "+" button appears in the line-num gutter on row hover. */
    .diff-table tr.code-row { position: relative; }
    .diff-table tr.code-row td.num { position: relative; }
    .diff-table tr.code-row .add-comment {
        position: absolute;
        right: 2px; top: 50%;
        transform: translateY(-50%);
        width: 14px; height: 14px;
        border-radius: 3px;
        background: var(--expand-fg);
        color: white;
        font-size: 10px; line-height: 14px; text-align: center;
        cursor: pointer; opacity: 0;
        user-select: none;
    }
    .diff-table tr.code-row td.num:hover .add-comment { opacity: 1; }

    /* Inline comment rows in the diff table. */
    tr.comment-row > td {
        padding: 0 !important;
        line-height: 1 !important;
        background: var(--vscode-editorWidget-background, rgba(127,127,127,0.06));
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        white-space: normal;
    }
    .comment-block {
        padding: 2px 8px;
        border-left: 3px solid #d29922;
        background: rgba(210, 153, 34, 0.06);
        font-family: var(--diff-mono);
        font-size: var(--editor-font-size);
        line-height: 1.25;
    }
    .comment-block.ai-critical { border-left-color: #ff3366; background: rgba(255, 60, 100, 0.08); }
    .comment-block.ai-major    { border-left-color: #ffae00; background: rgba(255, 174, 0, 0.07); }
    .comment-block.ai-minor    { border-left-color: #00d4ff; background: rgba(0, 212, 255, 0.06); }
    .comment-block.ai-nit      { border-left-color: #6e7781; background: rgba(110, 119, 129, 0.06); }
    .comment-block .meta {
        font-family: var(--diff-mono);
        font-size: calc(var(--editor-font-size) * 0.9);
        opacity: 0.85;
        margin: 0;
        line-height: 1.2;
        display: flex; gap: 6px; align-items: center;
        cursor: pointer;
        user-select: none;
    }
    .comment-block .meta .chevron {
        display: inline-block;
        width: 8px;
        font-size: 10px;
        opacity: 0.8;
    }
    .comment-block:not(.collapsed) .meta .chevron { transform: rotate(90deg); }
    .comment-block .meta .stale { color: #d29922; }
    .comment-block .meta .peek {
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 60vw;
    }
    .comment-block.collapsed .body,
    .comment-block.collapsed .actions { display: none; }

    .comment-block textarea {
        display: block;
        width: 100%;
        min-height: 24px;
        height: 24px;
        max-height: 240px;
        resize: vertical;
        padding: 2px 6px;
        margin: 2px 0 0 0;
        font-family: var(--diff-mono);
        font-size: var(--editor-font-size);
        line-height: 1.3;
        background: var(--vscode-input-background, transparent);
        color: var(--vscode-input-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 3px;
        box-sizing: border-box;
    }
    .comment-block .body {
        white-space: pre-wrap;
        font-family: var(--diff-mono);
        font-size: var(--editor-font-size);
        line-height: 1.3;
        color: #ff2ad4;
        margin: 1px 0 0 0;
    }
    body.vscode-light .comment-block .body { color: #a626a4; }
    .comment-block .actions {
        margin: 2px 0 0 0;
        line-height: 1;
        display: flex; gap: 4px;
        flex-wrap: wrap;
    }
    .comment-block .actions button {
        font-family: var(--diff-mono);
        font-size: calc(var(--editor-font-size) * 0.9);
        line-height: 1.2;
        padding: 1px 6px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--border);
        border-radius: 3px; cursor: pointer;
    }
    .comment-block .actions button.primary {
        background: var(--vscode-button-background, #0e639c);
        color: var(--vscode-button-foreground, white);
        border-color: var(--vscode-button-background, #0e639c);
    }
    .comment-block .actions button:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
    }
    .comment-block .actions button.primary:hover {
        background: var(--vscode-button-hoverBackground, #1177bb);
    }

    .toolbar-toggle {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px;
        padding: 4px 8px;
        border: 1px solid var(--border);
        border-radius: 3px;
        cursor: pointer;
        user-select: none;
    }
    .toolbar-toggle input { margin: 0; }
    .toolbar-toggle.active {
        background: rgba(56, 139, 253, 0.16);
        border-color: rgba(56, 139, 253, 0.5);
    }

    /* AI prompt dialog */
    .ai-dialog {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        z-index: 100;
        align-items: center;
        justify-content: center;
        padding: 24px;
    }
    .ai-dialog.open { display: flex; }
    .ai-dialog-content {
        background: var(--vscode-editor-background);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 14px 16px;
        max-width: 760px;
        width: 100%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    }
    .ai-dialog-content h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--expand-fg);
    }
    .ai-dialog-content .row {
        display: flex; gap: 10px; align-items: center;
        font-size: 12px;
    }
    .ai-dialog-content select,
    .ai-dialog-content input[type="text"] {
        font: inherit;
        padding: 4px 8px;
        background: var(--vscode-input-background, transparent);
        color: var(--vscode-input-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 3px;
    }
    .ai-dialog-content textarea {
        flex: 1;
        min-height: 240px;
        max-height: 60vh;
        resize: vertical;
        padding: 6px 8px;
        font-family: var(--diff-mono);
        font-size: var(--editor-font-size);
        line-height: 1.4;
        background: var(--vscode-input-background, transparent);
        color: var(--vscode-input-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 3px;
        white-space: pre-wrap;
    }
    .ai-dialog-content .ai-actions {
        display: flex; gap: 6px; justify-content: flex-end;
    }
    .ai-dialog-content button {
        font: inherit;
        padding: 5px 14px;
        background: var(--vscode-button-secondaryBackground, transparent);
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--border);
        border-radius: 3px;
        cursor: pointer;
    }
    .ai-dialog-content button.primary {
        background: var(--vscode-button-background, #0e639c);
        color: var(--vscode-button-foreground, white);
        border-color: var(--vscode-button-background, #0e639c);
        font-weight: 600;
    }
    .ai-dialog-content button:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1));
    }
    .ai-dialog-content button.primary:hover {
        background: var(--vscode-button-hoverBackground, #1177bb);
    }

    .files { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .empty { padding: 32px; text-align: center; opacity: 0.7; }

    /* Multi-column grid view — gridstack handles per-cell drag/resize/reorder.
       Cells are absolutely positioned by gridstack, so we don't lay them out
       ourselves; just style the inner content box. */
    .files.grid-mode .grid-stack-item-content {
        display: flex;
        flex-direction: column;
        /* Override gridstack's default overflow-y:auto so the inner .file-body
           handles scrolling instead of doubling up scrollbars. */
        overflow: hidden;
    }
    .files.grid-mode .grid-stack-item-content > .file {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        height: 100%;
    }
    .files.grid-mode .file.expanded > .file-body {
        overflow: auto;
        flex: 1 1 auto;
        min-height: 0;
    }
    /* Drag-handle grip in the file header. Visible only inside grid mode;
       gridstack uses .grid-drag-handle as its drag selector. */
    .grid-drag-handle { display: none; }
    .files.grid-mode .grid-drag-handle {
        display: inline-flex;
        align-items: center;
        cursor: grab;
        padding: 0 4px;
        opacity: 0.6;
        font-weight: bold;
        letter-spacing: -2px;
        user-select: none;
    }
    .files.grid-mode .grid-drag-handle:hover { opacity: 1; }
    .files.grid-mode .grid-drag-handle:active { cursor: grabbing; }
    /* In grid mode, push file actions to their own row below the filename so
       the path stays readable in narrow cells. */
    .files.grid-mode .file-header {
        flex-wrap: wrap;
        row-gap: 4px;
    }
    .files.grid-mode .file-header .path {
        min-width: 0;
        flex: 1 1 auto;
    }
    .files.grid-mode .file-actions {
        flex: 0 0 100%;
        order: 99;
        margin-top: 2px;
        flex-wrap: wrap;
        justify-content: flex-start;
    }
    /* GridStack visual touch-ups — make the resize handle a bit more obvious
       by using the editor foreground color and rounding the corners. */
    .grid-stack > .grid-stack-item > .ui-resizable-handle {
        background-color: rgba(128, 128, 128, 0.25);
        opacity: 0;
        transition: opacity 0.15s ease;
    }
    .grid-stack > .grid-stack-item:hover > .ui-resizable-handle { opacity: 1; }
    .grid-stack > .grid-stack-item.ui-draggable-dragging,
    .grid-stack > .grid-stack-item.ui-resizable-resizing {
        z-index: 100;
        outline: 1px dashed var(--expand-fg, #58a6ff);
    }
    .toolbar-toggle.active { /* already defined elsewhere */ }
    /* Active state for the grid toggle button. */
    .toolbar #view-mode-toggle.active {
        background: rgba(56, 139, 253, 0.18);
        border-color: rgba(56, 139, 253, 0.55);
        color: var(--expand-fg);
    }

    .file {
        border: 1px solid var(--border); border-radius: 4px;
        background: var(--vscode-editorWidget-background, transparent);
        overflow: hidden;
    }
    .file-header {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 10px; cursor: pointer; user-select: none;
        /* Solid background so sticky positioning hides scrolling content
           underneath. Translucent approve/reject tints layer on top via
           background-image overlays below. */
        background-color: var(--vscode-sideBarSectionHeader-background, var(--vscode-editor-background));
        background-image: none;
    }
    .file-header:hover { background-color: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1)); }
    .file-header .chevron { display: inline-block; width: 10px; }
    .file.expanded .file-header .chevron { transform: rotate(90deg); }
    .file-header .path {
        flex: 1; font-family: var(--diff-mono);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    /* Filename first-class: bold name, dimmed folder prefix. */
    .file-header .path .p-dir { opacity: 0.55; font-weight: 400; font-size: 11px; }
    .file-header .path .p-name { font-weight: 700; font-size: 13px; }
    /* Status stripe on the header's left edge — same color language as the
       Code Map: green added, amber modified, red deleted, blue renamed. */
    .file.st-A > .file-header { border-left: 3px solid #3fb950; }
    .file.st-M > .file-header, .file.st-T > .file-header { border-left: 3px solid #d29922; }
    .file.st-D > .file-header, .file.st-U > .file-header { border-left: 3px solid #f85149; }
    .file.st-R > .file-header, .file.st-C > .file-header { border-left: 3px solid #58a6ff; }
    .badge {
        font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 8px;
        text-transform: uppercase; letter-spacing: 0.5px;
        border: 1px solid currentColor; opacity: 0.85;
    }
    .badge.M { color: #d29922; }
    .badge.A { color: #3fb950; }
    .badge.D { color: #f85149; }
    .badge.R, .badge.C { color: #58a6ff; }
    .badge.T { color: #d29922; }
    .badge.U { color: #f85149; }
    .badge.\\? { color: #8b949e; }
    .stage-tag { font-size: 10px; padding: 1px 6px; border-radius: 8px; border: 1px dashed var(--border); opacity: 0.75; }
    .stats { font-size: 11px; font-family: var(--diff-mono); }
    .stats .add { color: #3fb950; }
    .stats .del { color: #f85149; }
    .file-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    /* Sub-group boxes: visually corral related actions so the toolbar reads as
       three concerns (navigation/context, file ops, AI) instead of a flat row. */
    .action-group {
        display: inline-flex;
        gap: 3px;
        padding: 2px 4px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: rgba(128, 128, 128, 0.04);
    }
    .action-group:empty { display: none; }
    .action-group[data-group="ai"] { background: rgba(56, 139, 253, 0.06); }
    .action-group[data-group="nav"] { background: rgba(63, 185, 80, 0.05); }
    .file-actions button {
        font-size: 11px; padding: 2px 8px;
        background: transparent; color: var(--vscode-foreground);
        border: 1px solid var(--border); border-radius: 3px; cursor: pointer;
    }
    .file-actions button:hover { background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.1)); }

    .file-body { display: none; border-top: 1px solid var(--border); }
    .file.expanded .file-body { display: block; }

    .section-title {
        padding: 4px 10px; font-size: 11px; opacity: 0.65;
        background: var(--hunk-bg); border-bottom: 1px solid var(--border);
    }

    /* Brief outline pulse on the hunk we just navigated to — fades after ~1s. */
    @keyframes hunk-flash-fade {
        0% { box-shadow: 0 0 0 2px var(--expand-fg, #58a6ff) inset; }
        100% { box-shadow: 0 0 0 2px transparent inset; }
    }
    .hunk-flash {
        animation: hunk-flash-fade 1s ease-out;
    }

    .hunk { border-bottom: 1px solid var(--border); }
    .hunk:last-child { border-bottom: none; }
    .hunk-header {
        padding: 4px 10px;
        font-family: var(--diff-mono);
        font-size: 11px;
        color: var(--hunk-header-fg);
        font-weight: 700;
        background: var(--hunk-header-bg);
        border-bottom: 1px solid var(--border);
    }
    .section-title {
        color: var(--section-title-fg) !important;
        font-weight: 800 !important;
        opacity: 1 !important;
    }

    /* Strict 50/50 split — no horizontal scroll, lines always wrap inside the cell. */
    .diff-scroll {
        overflow: hidden;
        background: var(--vscode-editor-background);
        width: 100%;
    }
    .diff-table {
        border-collapse: collapse;
        font-family: var(--diff-mono);
        font-size: var(--editor-font-size);
        table-layout: fixed;
        width: 100%;
        max-width: 100%;
        min-width: 0;
    }
    /* Column structure per row: [num | code] | [num | code]
       Each SIDE takes exactly 50% (gutter + code together). */
    .diff-table colgroup col.num { width: 60px; }
    .diff-table colgroup col.code { width: calc(50% - 60px); }
    .diff-table td {
        padding: 0 8px;
        vertical-align: top;
        line-height: var(--editor-line-height);
        tab-size: var(--editor-tab-size);
        -moz-tab-size: var(--editor-tab-size);
        border-right: 1px solid var(--border);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
        box-sizing: border-box;
        /* max-width: 0 is the canonical trick to force fixed-layout tables
           to honor column widths even with very long unbreakable tokens. */
        max-width: 0;
    }
    .diff-table td:last-child { border-right: none; }
    .diff-table td.num {
        text-align: right; color: var(--row-num);
        user-select: none; background: var(--num-bg);
        font-size: 0.9em;
        font-weight: 700;
        width: 60px;
        max-width: 60px;
        min-width: 60px;
        white-space: nowrap;
        word-break: keep-all;
        overflow-wrap: normal;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .diff-table td.code {
        overflow: hidden;
    }

    /* Per-cell colorization: a modified-line row has left=del + right=add,
       so we color cells by their own kind, not the row class. */
    .diff-table td.code.add { background: var(--add-bg); box-shadow: inset 3px 0 0 var(--add-line); }
    .diff-table td.code.del { background: var(--del-bg); box-shadow: inset 3px 0 0 var(--del-line); }
    .diff-table td.code.empty { background: var(--empty-bg); }

    .diff-table td.num.add { background: var(--add-num-bg); color: var(--add-num-fg); }
    .diff-table td.num.del { background: var(--del-num-bg); color: var(--del-num-fg); }
    .diff-table td.num.empty { background: var(--empty-bg); }

    /* Vertical (unified) diff: renderHunk emits 2-column markup with one row
       per side. Just need the column to fill the remaining width since the
       col.code default is "calc(50% - 60px)" sized for the 4-col split. */
    .diff-table.vertical colgroup col.code { width: calc(100% - 60px); }

    /* Intra-line diff highlight — bolds the differing substring on each side
       of a changed line pair (computed via prefix/suffix common-text
       detection in JS). Subtle yellow tint draws the eye without overwhelming
       the surrounding hljs colors. */
    .intra-diff {
        font-weight: 700;
        background: rgba(255, 200, 0, 0.22);
        border-radius: 2px;
        padding: 0 1px;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
    }

    /* highlight.js fallback so nothing breaks if hljs fails to load. */
    .hljs { background: transparent !important; padding: 0 !important; }
    .code-inner {
        display: inline;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
        max-width: 100%;
    }
    .code-inner * {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
    }

    .binary-note { padding: 12px; opacity: 0.7; font-style: italic; }
    .error {
        padding: 12px; color: var(--vscode-errorForeground, #f85149);
        background: rgba(248, 81, 73, 0.08);
        border: 1px solid rgba(248, 81, 73, 0.4);
        border-radius: 4px; margin: 12px;
    }

    .file.hidden-by-search { display: none; }

    /* Approve All button accent — green to match the per-hunk approve. */
    .file-actions .approve-all-btn {
        color: var(--add-line);
        border-color: rgba(0, 255, 100, 0.5);
    }
    body.vscode-light .file-actions .approve-all-btn {
        color: #1a7f37;
        border-color: rgba(46, 160, 67, 0.55);
    }
    .file-actions .approve-all-btn:hover {
        background: rgba(0, 255, 100, 0.15);
    }
    body.vscode-light .file-actions .approve-all-btn:hover {
        background: rgba(46, 160, 67, 0.18);
    }

    /* === Embedded terminal panel (xterm.js + node-pty) === */
    #term-panel {
        position: fixed;
        left: 0; right: 0; bottom: 0;
        z-index: 50;
        background: var(--vscode-editor-background, #1e1e1e);
        border-top: 1px solid var(--border);
        display: none;
        flex-direction: column;
        height: 36vh;
        min-height: 120px;
        max-height: 80vh;
        box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.45);
    }
    #term-panel.open { display: flex; }
    #term-panel.minimized {
        height: 28px !important;
        min-height: 28px;
    }
    #term-panel.minimized .term-resize,
    #term-panel.minimized .term-tabs .term-body { display: none; }
    #term-panel .term-resize {
        height: 5px;
        cursor: ns-resize;
        background: transparent;
        border-bottom: 1px solid var(--border);
    }
    #term-panel .term-resize:hover {
        background: var(--expand-bg-hover);
    }
    #term-panel .term-bar {
        flex: 0 0 auto;
        display: flex;
        align-items: stretch;
        background: var(--vscode-sideBarSectionHeader-background, transparent);
        border-bottom: 1px solid var(--border);
        height: 28px;
    }
    #term-panel .term-tabs {
        flex: 1;
        display: flex;
        overflow-x: auto;
        scrollbar-width: thin;
    }
    #term-panel .term-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-right: 1px solid var(--border);
        cursor: pointer;
        font-size: 11px;
        color: var(--vscode-foreground);
        opacity: 0.65;
        white-space: nowrap;
        flex: 0 0 auto;
    }
    #term-panel .term-tab:hover { opacity: 1; }
    #term-panel .term-tab.active {
        opacity: 1;
        background: var(--vscode-editor-background);
        box-shadow: inset 0 -2px 0 var(--expand-fg);
    }
    #term-panel .term-tab .label { font-weight: 600; }
    #term-panel .term-tab .pid { opacity: 0.6; font-size: 10px; }
    #term-panel .term-tab .term-status {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--add-line);
    }
    #term-panel .term-tab.exited .term-status { background: var(--row-num); }
    #term-panel .term-tab .close-btn {
        margin-left: 4px;
        width: 16px; height: 16px;
        line-height: 14px; text-align: center;
        border-radius: 3px;
        font-size: 13px;
        opacity: 0.7;
    }
    #term-panel .term-tab .close-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        opacity: 1;
    }
    #term-panel .term-controls {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 6px;
    }
    #term-panel .term-controls button {
        font: inherit; font-size: 13px;
        background: transparent;
        color: var(--vscode-foreground);
        border: none;
        width: 24px; height: 24px;
        border-radius: 3px;
        cursor: pointer;
        opacity: 0.75;
    }
    #term-panel .term-controls button:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.15));
        opacity: 1;
    }
    #term-panel .term-body {
        flex: 1 1 auto;
        position: relative;
        overflow: hidden;
        padding: 4px 0 0 4px;
    }
    #term-panel .term-pane {
        position: absolute;
        inset: 0;
        display: none;
    }
    #term-panel .term-pane.active { display: block; }

    /* Diff review panel — bottom drawer, separate from terminal panel. */
    #review-panel {
        position: fixed;
        left: 0; right: 0; bottom: 0;
        z-index: 48;
        background: var(--vscode-editor-background);
        border-top: 1px solid var(--border);
        display: none;
        flex-direction: column;
        height: 38vh;
        min-height: 140px;
        max-height: 85vh;
        box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.45);
    }
    #review-panel.open { display: flex; }
    #review-panel.minimized {
        height: 28px !important;
        min-height: 28px;
    }
    #review-panel.minimized .review-body,
    #review-panel.minimized .review-resize { display: none; }
    #review-panel .review-resize {
        height: 5px;
        cursor: ns-resize;
        border-bottom: 1px solid var(--border);
    }
    #review-panel .review-resize:hover { background: var(--expand-bg-hover); }
    #review-panel .review-bar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        height: 28px;
        padding: 0 10px;
        background: var(--vscode-sideBarSectionHeader-background, transparent);
        border-bottom: 1px solid var(--border);
    }
    #review-panel .review-title {
        flex: 1;
        font-size: 12px;
        font-weight: 700;
        display: flex; align-items: center; gap: 8px;
    }
    #review-panel .review-status {
        font-weight: normal; opacity: 0.8;
        font-size: 11px;
    }
    #review-panel .review-status.error { color: var(--vscode-errorForeground, #f85149); }
    #review-panel .review-controls { display: flex; gap: 4px; }
    #review-panel .review-controls button {
        font: inherit; font-size: 12px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid transparent;
        padding: 2px 8px;
        border-radius: 3px;
        cursor: pointer;
    }
    #review-panel .review-controls button:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.15));
        border-color: var(--border);
    }
    #review-panel .review-body {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 12px 18px;
        font-family: var(--vscode-font-family);
        font-size: 13px;
        line-height: 1.5;
        color: var(--diff-fg);
    }
    /* Markdown styling inside the review body. */
    #review-panel .review-body h1,
    #review-panel .review-body h2,
    #review-panel .review-body h3 {
        margin: 14px 0 6px;
        font-weight: 700;
        color: var(--hl-keyword);
    }
    #review-panel .review-body h1 { font-size: 17px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
    #review-panel .review-body h2 { font-size: 15px; }
    #review-panel .review-body h3 { font-size: 13px; color: var(--hl-function); }
    #review-panel .review-body p { margin: 6px 0; }
    #review-panel .review-body ul, #review-panel .review-body ol { margin: 6px 0; padding-left: 22px; }
    #review-panel .review-body li { margin: 2px 0; }
    #review-panel .review-body code {
        font-family: var(--diff-mono);
        font-size: 0.92em;
        background: rgba(127, 127, 127, 0.18);
        padding: 1px 5px;
        border-radius: 3px;
    }
    #review-panel .review-body pre {
        font-family: var(--diff-mono);
        font-size: 12px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 8px 10px;
        margin: 8px 0;
        overflow-x: auto;
        line-height: 1.4;
    }
    body.vscode-light #review-panel .review-body pre {
        background: rgba(0, 0, 0, 0.05);
    }
    #review-panel .review-body pre code {
        background: transparent;
        padding: 0;
    }
    #review-panel .review-body strong { color: var(--hl-builtin); }
    #review-panel .review-body em { color: var(--hl-comment); }
    #review-panel .review-body blockquote {
        margin: 6px 0;
        padding: 4px 12px;
        border-left: 3px solid var(--hl-attribute);
        background: rgba(127, 127, 127, 0.08);
        opacity: 0.95;
    }
    #review-panel .review-loading {
        padding: 18px;
        opacity: 0.75;
        font-style: italic;
        text-align: center;
    }

    /* Float a "Show terminal" pill at bottom-right when panel is closed and
       at least one session exists (e.g., minimized then closed-via-close). */
    #term-launcher {
        position: fixed;
        right: 10px; bottom: 10px;
        z-index: 49;
        display: none;
        gap: 6px;
        align-items: center;
        padding: 6px 10px;
        font-size: 11px;
        background: var(--vscode-button-background, #0e639c);
        color: var(--vscode-button-foreground, white);
        border: 1px solid var(--expand-fg);
        border-radius: 14px;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }
    #term-launcher.show { display: inline-flex; }

    /* === Selection word-match highlighting === */
    ::highlight(word-match) {
        background-color: rgba(255, 220, 0, 0.45);
        color: inherit;
    }
    body.vscode-light ::highlight(word-match) {
        background-color: rgba(255, 200, 0, 0.55);
    }

    /* === Cmd/Ctrl+F find bar + match highlights === */
    ::highlight(find-match) {
        background-color: rgba(255, 165, 0, 0.40);
        color: inherit;
    }
    ::highlight(find-match-current) {
        background-color: #ffae00;
        color: #1f2328;
    }
    body.vscode-light ::highlight(find-match) {
        background-color: rgba(255, 145, 0, 0.45);
    }
    body.vscode-light ::highlight(find-match-current) {
        background-color: #ff8f00;
        color: #ffffff;
    }
    .find-bar {
        position: fixed;
        top: 8px;
        right: 12px;
        z-index: 60;
        display: none;
        align-items: center;
        gap: 4px;
        padding: 4px 6px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--border);
        border-radius: 4px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
        font-family: var(--diff-mono);
        font-size: 12px;
    }
    .find-bar.open { display: flex; }
    .find-bar input[type="search"] {
        font: inherit;
        font-family: var(--diff-mono);
        padding: 4px 8px;
        min-width: 220px;
        background: var(--vscode-input-background, transparent);
        color: var(--vscode-input-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 3px;
    }
    .find-bar .find-count {
        font-size: 11px;
        opacity: 0.75;
        min-width: 64px;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    .find-bar .find-count.error { color: var(--vscode-errorForeground, #f85149); }
    .find-bar button {
        font: inherit; font-size: 13px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--border);
        border-radius: 3px;
        padding: 2px 8px;
        cursor: pointer;
        line-height: 1;
    }
    .find-bar button:hover {
        background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.15));
    }
    .find-bar label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        font-size: 11px;
        cursor: pointer;
        user-select: none;
        border: 1px solid transparent;
        border-radius: 3px;
    }
    .find-bar label.active {
        background: rgba(255, 165, 0, 0.18);
        border-color: rgba(255, 165, 0, 0.5);
    }
    .find-bar label input { margin: 0; }

    /* Ctrl+D find-next highlight (no animation, just an outline that's removed after a timeout). */
    .find-flash {
        outline: 2px solid #ffff00 !important;
        outline-offset: -2px;
        position: relative;
        z-index: 1;
    }
    .find-status {
        position: fixed;
        bottom: 10px;
        right: 14px;
        z-index: 50;
        padding: 4px 10px;
        font-family: var(--diff-mono);
        font-size: 11px;
        background: rgba(0, 0, 0, 0.85);
        color: #ffff00;
        border: 1px solid #ffff00;
        border-radius: 3px;
        pointer-events: none;
        opacity: 0;
    }
    .find-status.show { opacity: 1; }

    .file-actions .ctx-btn {
        font-variant-numeric: tabular-nums;
    }

    /* Architect Doc — expandable change-review section at the top. */
    .arch-doc { border-bottom: 1px solid var(--border); background: var(--vscode-sideBar-background, rgba(128,128,128,0.04)); }
    .arch-bar { display: flex; align-items: center; gap: 8px; padding: 5px 12px; cursor: pointer; user-select: none; font-size: 12px; }
    .arch-caret { opacity: .7; width: 10px; flex: none; }
    .arch-title { font-weight: 600; white-space: nowrap; flex: none; }
    .arch-tldr { opacity: .85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
    .arch-status { font-size: 11px; opacity: .75; white-space: nowrap; flex: none; }
    .arch-status.error { color: var(--vscode-errorForeground, #f85149); opacity: 1; }
    .arch-auto { display: flex; gap: 3px; align-items: center; font-size: 11px; opacity: .85; flex: none; cursor: pointer; }
    .arch-usage { font-size: 11px; opacity: .7; white-space: nowrap; flex: none; font-variant-numeric: tabular-nums; }
    .arch-actions { display: flex; gap: 4px; flex: none; }
    .arch-actions button { background: none; border: 1px solid var(--border); border-radius: 3px; color: inherit; cursor: pointer; font-size: 11px; padding: 1px 7px; }
    .arch-actions button:hover { background: var(--expand-bg-hover, rgba(128,128,128,0.15)); }
    .arch-body { padding: 6px 14px 12px; max-height: 45vh; overflow: auto; font-size: 12px; }
    .arch-overview { margin-bottom: 8px; }
    .arch-files { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
    .arch-file-row { display: flex; gap: 8px; align-items: baseline; padding: 2px 6px; border-radius: 3px; cursor: pointer; }
    .arch-file-row:hover { background: var(--expand-bg-hover, rgba(128,128,128,0.12)); }
    .arch-file-row .p { font-family: var(--vscode-editor-font-family, monospace); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 34%; opacity: .9; flex: none; }
    .arch-file-row .s { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .8; }
    .arch-file-row .flags { opacity: .65; font-size: 11px; }
    .risk-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex: none; align-self: center; }
    .risk-low .risk-dot { background: #2ea043; }
    .risk-medium .risk-dot { background: #d29922; }
    .risk-high .risk-dot { background: #f85149; }
    .risk-unknown .risk-dot { background: #8b949e; }
    .arch-static { border-top: 1px dashed var(--border); padding-top: 6px; opacity: .9; }
    .arch-static ul { margin: 4px 0; padding-left: 18px; }
    .arch-static .verdict-pass { color: #2ea043; }
    .arch-static .verdict-warn { color: #d29922; }
    .arch-static .verdict-fail { color: #f85149; }
    .arch-note { font-size: 11px; opacity: .75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px; }
    .arch-note.risk-high { color: #f85149; opacity: 1; }
    .arch-note.risk-medium { color: #d29922; }
    .arch-doc.stale .arch-body, .arch-doc.stale .arch-tldr { opacity: .45; }

    /* Code Map — three.js circle-packed repo view. */
    #map-view { display: none; position: relative; flex: 1; min-height: 0; overflow: hidden; }
    body.map-mode { display: flex; flex-direction: column; overflow: hidden; }
    body.map-mode > * { flex: none; }
    body.map-mode #content { display: none !important; }
    body.map-mode #map-view { display: flex; flex-direction: column; flex: 1; }
    .map-topbar {
        display: flex; align-items: center; gap: 10px; padding: 4px 12px;
        border-bottom: 1px solid var(--border); font-size: 12px; flex: none;
        background: var(--vscode-sideBar-background, rgba(128,128,128,0.04));
    }
    .map-topbar input[type="search"] {
        background: var(--vscode-input-background, #1e1e1e); color: inherit;
        border: 1px solid var(--border); border-radius: 3px; padding: 2px 8px; font-size: 12px; width: 200px;
    }
    .map-topbar label { display: flex; align-items: center; gap: 4px; cursor: pointer; opacity: .85; }
    .map-topbar button {
        background: none; border: 1px solid var(--border); border-radius: 3px;
        color: inherit; cursor: pointer; font-size: 11px; padding: 2px 8px;
    }
    .map-topbar button:hover { background: var(--expand-bg-hover, rgba(128,128,128,0.15)); }
    .map-quality { display: flex; gap: 4px; }
    .q-chip { border: 1px solid var(--border); border-radius: 9px; padding: 0 8px; font-size: 11px; cursor: pointer; opacity: .8; }
    .q-chip:hover, .q-chip.on { opacity: 1; }
    .q-chip.on { outline: 1px solid currentColor; }
    .q-chip.q-clean { color: #2ea043; border-color: #2ea043; }
    .q-chip.q-review { color: #d29922; border-color: #d29922; }
    .q-chip.q-concern { color: #f85149; border-color: #f85149; }
    .map-progress { font-variant-numeric: tabular-nums; opacity: .8; }
    .map-note { opacity: .6; font-size: 11px; }
    #map-canvas-wrap { flex: 1; min-height: 0; position: relative; cursor: grab;
        /* Deep-space backdrop — never pure black; the starfield sits on top. */
        background: radial-gradient(120% 90% at 50% 30%, #161c28 0%, #0c1016 55%, #06080c 100%);
    }
    body.vscode-light #map-canvas-wrap {
        background: radial-gradient(120% 90% at 50% 30%, #ffffff 0%, #f2f4f7 60%, #e8ebf0 100%);
    }
    #map-canvas-wrap.dragging { cursor: grabbing; }
    #map-canvas-wrap canvas { display: block; }
    #map-tooltip {
        position: absolute; display: none; pointer-events: none; z-index: 40;
        max-width: 460px; padding: 9px 12px; border-radius: 6px; font-size: 13px;
        background: var(--vscode-editorHoverWidget-background, #252526);
        border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
        box-shadow: 0 6px 18px rgba(0,0,0,0.5);
        line-height: 1.45;
    }
    #map-tooltip .t-path { font-family: var(--diff-mono, monospace); font-size: 11px; opacity: .65; margin-top: 1px; }
    #map-tooltip .t-sum { margin-top: 6px; font-size: 13px; opacity: .95; white-space: normal; }
    #map-tooltip .t-meta { margin-top: 5px; font-size: 12px; opacity: .75; }
    /* Hover diff window — the hunk living at the slab under the cursor. */
    #map-tooltip .t-hunk {
        margin-top: 7px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
        font-family: var(--diff-mono, monospace); font-size: 11px; line-height: 1.45;
        background: var(--vscode-editor-background, #1e1e1e);
    }
    #map-tooltip .t-hunk .th-head {
        padding: 2px 7px; font-size: 10px; opacity: .7;
        background: var(--expand-bg-hover, rgba(128,128,128,0.12));
    }
    #map-tooltip .t-hunk .th-line { padding: 0 7px; white-space: pre; overflow: hidden; text-overflow: ellipsis; }
    #map-tooltip .t-hunk .th-add { background: rgba(46,160,67,0.18); color: #7ee787; }
    #map-tooltip .t-hunk .th-del { background: rgba(248,81,73,0.18); color: #ffa198; }
    #map-tooltip .t-hunk .th-ctx { opacity: .55; }
    /* Light theme: the dark-theme diff colors are unreadable on white. */
    body.vscode-light #map-tooltip .t-hunk .th-add { background: rgba(46,160,67,0.12); color: #1a7f37; }
    body.vscode-light #map-tooltip .t-hunk .th-del { background: rgba(248,81,73,0.12); color: #cf222e; }
    #map-tooltip .t-hunk .th-more { padding: 1px 7px; font-size: 10px; opacity: .55; }
    #map-card {
        position: absolute; top: 10px; right: 10px; width: 330px; z-index: 41; display: none;
        background: var(--vscode-sideBar-background, #1f1f1f);
        border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; font-size: 12px;
        box-shadow: 0 6px 22px rgba(0,0,0,0.5);
    }
    #map-card .c-path { font-family: var(--diff-mono, monospace); font-size: 11px; word-break: break-all; }
    #map-card .c-badges { display: flex; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
    #map-card .c-badge { border: 1px solid var(--border); border-radius: 8px; padding: 0 7px; font-size: 11px; }
    #map-card .c-badge.q-clean { color: #2ea043; border-color: #2ea043; }
    #map-card .c-badge.q-review { color: #d29922; border-color: #d29922; }
    #map-card .c-badge.q-concern { color: #f85149; border-color: #f85149; }
    #map-card .c-sum { opacity: .95; margin: 8px 0; font-size: 13px; line-height: 1.5; }
    #map-card .c-flags { opacity: .8; font-size: 11px; margin-bottom: 6px; }
    #map-card .c-actions { display: flex; gap: 6px; }
    #map-card .c-actions button {
        background: none; border: 1px solid var(--border); border-radius: 3px;
        color: inherit; cursor: pointer; font-size: 11px; padding: 2px 9px;
    }
    #map-card .c-actions button:hover { background: var(--expand-bg-hover, rgba(128,128,128,0.15)); }
    #map-legend {
        position: absolute; left: 10px; bottom: 10px; z-index: 40; font-size: 11px;
        background: var(--vscode-sideBar-background, rgba(30,30,30,0.9));
        border: 1px solid var(--border); border-radius: 5px; padding: 6px 10px; opacity: .92;
        display: flex; flex-direction: column; gap: 3px;
        pointer-events: none; /* never a dead-zone — panning/picking pass through */
    }
    #map-legend .lg-row { display: flex; align-items: center; gap: 6px; }
    #map-legend .lg-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; display: inline-block; }
    #map-empty {
        position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
        z-index: 39; font-size: 13px; opacity: .75; text-align: center; padding: 30px;
    }
    #map-view.stale #map-canvas-wrap { opacity: .55; }
    .map-topbar #map-root { width: 110px; background: var(--vscode-input-background, #1e1e1e); color: inherit;
        border: 1px solid var(--border); border-radius: 3px; padding: 2px 8px; font-size: 12px;
        font-family: var(--diff-mono, monospace); }
    /* Anchored diff panel — a floating window glued to the clicked sphere.
       map.js repositions it every rendered frame; the connector line ties it
       back to its planet. */
    #map-connector { position: absolute; inset: 0; display: none; pointer-events: none; z-index: 44; }
    #map-connector line { stroke: var(--vscode-focusBorder, #58a6ff); stroke-width: 1.5; stroke-dasharray: 5 4; opacity: .8; }
    #map-panel {
        position: absolute; left: 40px; top: 40px;
        width: clamp(280px, 46vw, 480px); max-width: calc(100% - 16px); max-height: 68%;
        display: none; flex-direction: column; z-index: 45;
        background: var(--vscode-editor-background, #1e1e1e);
        border: 1px solid var(--vscode-focusBorder, #58a6ff); border-radius: 8px;
        box-shadow: 0 10px 34px rgba(0,0,0,0.5);
        overflow: hidden;
    }
    #map-panel.open { display: flex; }
    #map-panel .mp-bar {
        display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 10px; flex: none;
        border-bottom: 1px solid var(--border);
        background: var(--vscode-sideBar-background, rgba(128,128,128,0.05));
    }
    #map-panel .mp-path { font-family: var(--diff-mono, monospace); font-size: 11px; flex: 1; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #map-panel .mp-actions { display: flex; gap: 5px; }
    #map-panel .mp-actions button, #map-panel .mp-note-actions button {
        background: none; border: 1px solid var(--border); border-radius: 3px;
        color: inherit; cursor: pointer; font-size: 11px; padding: 2px 9px;
    }
    #map-panel .mp-actions button:hover, #map-panel .mp-note-actions button:hover { background: var(--expand-bg-hover, rgba(128,128,128,0.15)); }
    #map-panel .mp-body { flex: 1; overflow: auto; padding: 8px; min-height: 80px; }
    #map-panel .mp-body .file { border: 1px solid var(--border); border-radius: 6px; }
    /* Notes: review remarks stored on the file and sent with AI analysis. */
    #map-panel .mp-notes { flex: none; border-top: 1px solid var(--border); padding: 6px 10px 8px;
        background: var(--vscode-sideBar-background, rgba(128,128,128,0.04)); }
    #map-panel .mp-notes-list { max-height: 110px; overflow: auto; }
    #map-panel .mp-note { display: flex; gap: 6px; align-items: baseline; font-size: 11.5px; padding: 2px 0; }
    #map-panel .mp-note .n-body { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-word; }
    #map-panel .mp-note .n-line { opacity: .55; font-family: var(--diff-mono, monospace); font-size: 10px; flex: none; }
    #map-panel .mp-note .n-del { opacity: .5; cursor: pointer; border: none; background: none; color: inherit; flex: none; }
    #map-panel .mp-note .n-del:hover { opacity: 1; }
    #map-panel .mp-note.ai .n-body { opacity: .85; }
    #map-panel .mp-note-compose textarea {
        width: 100%; box-sizing: border-box; resize: vertical; margin-top: 4px;
        background: var(--vscode-input-background, #1e1e1e); color: inherit;
        border: 1px solid var(--border); border-radius: 4px; padding: 4px 7px; font-size: 12px;
        font-family: inherit;
    }
    #map-panel .mp-note-actions { display: flex; gap: 6px; margin-top: 4px; justify-content: flex-end; }
</style>
</head>
<body>
    <div class="toolbar">
        <div class="meta">
            <div class="branch" id="branch">—</div>
            <div class="repo" id="repo">Loading…</div>
        </div>
        <input type="search" id="search" placeholder="Filter files…" />
        <button id="expand-all" title="Expand all files">Expand All</button>
        <button id="collapse-all" title="Collapse all files">Collapse All</button>
        <button id="toggle-all" title="Show / hide all changes">Hide All</button>
        <label class="toolbar-toggle" id="auto-expand-toggle" title="Sort by last modified and auto-expand the most recent file">
            <input type="checkbox" id="auto-expand-cb"> Auto-expand recent
        </label>
        <button id="refresh" title="Refresh">↻ Refresh</button>
        <button id="grid-size-toggle" title="Cycle default tile width (sm / md / lg)">Size: md</button>
        <button id="grid-reset" title="Reset grid layout — clears all custom positions/sizes back to defaults">⟳ Reset Layout</button>
        <button id="diff-orient-toggle" title="Switch diff layout between side-by-side and unified top/bottom">↔ Side-by-side</button>
        <button id="review-all-btn" title="Run senior-architect review across all changed files (OpenRouter model, configurable)">🧠 Review All</button>
        <button id="map-toggle" title="Code Map — bubble view of the repo with change heat and review progress" style="display:none">◉ Map</button>
        <span id="hidden-pill" class="hidden-pill" title="Click to manage hidden files">
            <span id="hidden-count">0</span> hidden
        </span>
        <span class="summary" id="summary"></span>
    </div>
    <div class="commit-bar">
        <div class="commit-msg-wrap">
            <div class="commit-msg-container">
                <textarea id="commit-msg" title="⌘/Ctrl+Enter — stage all, commit, push. Empty? Generate a message AND ship it. ⌘/Ctrl+Shift+Enter — push only." placeholder="Commit message — ⌘+Enter to stage+commit+push (empty? generates AND ships)"></textarea>
                <div class="commit-msg-floating">
                    <button id="commit-generate" title="Generate commit message from diff (OpenRouter model, configurable)">✨</button>
                    <button id="commit-key-toggle" title="Set / change OpenRouter API key">⚙</button>
                </div>
            </div>
            <div id="commit-key-row" class="commit-key-row" style="display:none;">
                <input type="text" id="commit-key-input" placeholder="OpenRouter API key (sk-or-...)" autocomplete="off" spellcheck="false" />
                <button id="commit-key-save" type="button">Save</button>
                <button id="commit-key-clear" type="button">Clear</button>
                <button id="commit-key-settings" type="button" title="Open VS Code Settings for this key">Open in Settings</button>
                <span id="commit-key-status" class="commit-key-status"></span>
            </div>
        </div>
        <div class="commit-actions">
            <label><input type="checkbox" id="amend"> Amend last commit</label>
            <button id="stage-all-only-btn" class="secondary" title="git add --all">Stage All</button>
            <button id="commit-btn" title="Commit currently staged files (⌘/Ctrl+Enter)">Commit Staged</button>
            <button id="commit-push-btn" class="secondary" title="git push (⌘/Ctrl+Shift+Enter)">Push</button>
            <span id="commit-status" class="commit-status"></span>
        </div>
    </div>
    <div id="arch-doc" class="arch-doc">
        <div class="arch-bar" id="arch-bar" role="button" aria-expanded="false" title="Expand / collapse change review">
            <span class="arch-caret" id="arch-caret">▸</span>
            <span class="arch-title">🏛 Change Review</span>
            <span class="arch-tldr" id="arch-tldr"></span>
            <span class="arch-status" id="arch-status"></span>
            <label class="arch-auto" title="Run AI per-file summaries and the architecture overview automatically when changes appear"><input type="checkbox" id="arch-auto-cb"> AI</label>
            <span id="ai-usage" class="arch-usage" title="Session AI usage: input / output tokens · cost (set prices: gitDiffViewer.priceInputPerM / priceOutputPerM)"></span>
            <span class="arch-actions">
                <button id="arch-rerun" title="Re-run change analysis now">⟳</button>
                <button id="arch-cancel" title="Cancel running analysis" style="display:none">✕</button>
            </span>
        </div>
        <div class="arch-body" id="arch-body" style="display:none">
            <div class="arch-overview" id="arch-overview"></div>
            <div class="arch-files" id="arch-files"></div>
            <div class="arch-static" id="arch-static"></div>
        </div>
    </div>
    <div id="hidden-list" class="hidden-list">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <strong>Hidden files</strong>
            <button id="unhide-all-btn">Unhide all</button>
            <button id="close-hidden-btn">Close</button>
        </div>
        <div id="hidden-rows"></div>
    </div>
    <div id="content" class="files">
        <div class="empty">Loading…</div>
    </div>
    <div id="map-view" aria-label="Code Map">
        <div class="map-topbar">
            <label title="Scope the map to a folder (e.g. src). Empty = whole repo.">Root
                <input type="text" id="map-root" placeholder="whole repo" autocomplete="off" spellcheck="false" />
            </label>
            <input type="search" id="map-filter" placeholder="Filter files… ( / )" autocomplete="off" spellcheck="false" />
            <label><input type="checkbox" id="map-unreviewed-cb"> Unreviewed only</label>
            <label><input type="checkbox" id="map-changed-cb" checked> Dim unchanged</label>
            <label title="Show every file — off collapses folders with no changes into their platform"><input type="checkbox" id="map-all-cb"> All files</label>
            <button id="map-frame" title="Frame the changeset (F)">⤢ Frame</button>
            <button id="map-next" title="Fly to next unreviewed file (N)">▶ Next</button>
            <span class="map-progress" id="map-progress"></span>
            <span id="map-quality" class="map-quality"></span>
            <span class="map-note" id="map-note"></span>
        </div>
        <div id="map-canvas-wrap">
            <div id="map-tooltip"></div>
            <div id="map-card"></div>
            <div id="map-legend">
                <div class="lg-row" style="opacity:.75">ring = folder orbit · sphere = file · height = depth</div>
                <div class="lg-row"><span class="lg-dot" style="background:#3fb960"></span> added <span class="lg-dot" style="background:#e0a53c"></span> modified <span class="lg-dot" style="background:#e0455a"></span> deleted <span class="lg-dot" style="background:#4f8fe8"></span> renamed</div>
                <div class="lg-row"><span class="lg-dot" style="border:2px solid #c678dd; width:5px; height:5px; background:transparent"></span> hub — imported by many files</div>
                <div class="lg-row"><span class="lg-dot" style="border:2px solid #63d8c9; width:5px; height:5px; background:transparent"></span> ring appears when reviewed / AI verdict</div>
                <div class="lg-row"><span class="lg-dot" style="background:#39c5cf"></span> imports →&nbsp; <span class="lg-dot" style="background:#ffa657"></span> imported by</div>
                <div class="lg-row" style="opacity:.7">hover → diff peek + import lines · click → diff window</div>
                <div class="lg-row" style="opacity:.7">drag pan · wheel zoom · Q/E rotate · dblclick folder → focus</div>
            </div>
            <div id="map-empty"></div>
            <svg id="map-connector" aria-hidden="true"><line id="map-connector-line" /></svg>
            <div id="map-panel">
                <div class="mp-bar">
                    <span class="mp-path" id="map-panel-path"></span>
                    <span class="mp-actions">
                        <button id="map-panel-viewed">✓ Reviewed</button>
                        <button id="map-panel-grid" title="Open in grid view">▤ Grid</button>
                        <button id="map-panel-close" title="Close (Esc)">✕</button>
                    </span>
                </div>
                <div class="mp-body files" id="map-panel-body"></div>
                <div class="mp-notes">
                    <div class="mp-notes-list" id="map-panel-notes-list"></div>
                    <div class="mp-note-compose">
                        <textarea id="map-note-input" rows="2" placeholder="Note for the AI review… (Ctrl+Enter to add)"></textarea>
                        <div class="mp-note-actions">
                            <button id="map-note-save" title="Save this note on the file">💬 Add note</button>
                            <button id="map-note-ai" title="Re-run AI analysis on this diff — saved notes are sent along">🔍 Analyze with notes</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="find-status" class="find-status" role="status"></div>
    <div id="find-bar" class="find-bar" role="search">
        <input type="search" id="find-input" placeholder="Find in diffs…" autocomplete="off" spellcheck="false" />
        <span id="find-count" class="find-count">0 / 0</span>
        <label id="find-case" title="Match case"><input type="checkbox" id="find-case-cb"> Aa</label>
        <button id="find-prev" title="Previous match (Shift+Enter)">↑</button>
        <button id="find-next" title="Next match (Enter)">↓</button>
        <button id="find-close" title="Close (Esc)">✕</button>
    </div>
    <div id="term-launcher" title="Show embedded terminals">▲ Terminals (<span id="term-launcher-count">0</span>)</div>
    <div id="review-panel" role="region" aria-label="Diff review">
        <div class="review-resize" id="review-resize" title="Drag to resize"></div>
        <div class="review-bar">
            <div class="review-title">🧠 Diff review <span id="review-status" class="review-status"></span></div>
            <div class="review-controls">
                <button id="review-copy" title="Copy review markdown to clipboard">Copy</button>
                <button id="review-min" title="Minimize">─</button>
                <button id="review-close" title="Close">✕</button>
            </div>
        </div>
        <div class="review-body" id="review-body"></div>
    </div>
    <div id="term-panel" role="region" aria-label="Embedded terminals">
        <div class="term-resize" id="term-resize" title="Drag to resize"></div>
        <div class="term-bar">
            <div class="term-tabs" id="term-tabs"></div>
            <div class="term-controls">
                <button id="term-new" title="New shell terminal">＋</button>
                <button id="term-min" title="Minimize">─</button>
                <button id="term-close" title="Close all terminals">✕</button>
            </div>
        </div>
        <div class="term-body" id="term-body"></div>
    </div>
    <div id="ai-dialog" class="ai-dialog" role="dialog" aria-modal="true">
        <div class="ai-dialog-content">
            <h3 id="ai-dialog-title">Send to AI</h3>
            <div class="row">
                <label for="ai-target">Target:</label>
                <select id="ai-target">
                    <optgroup label="Embedded (in this panel)">
                        <option value="embedded-claude">🤖 Claude — embedded terminal</option>
                        <option value="embedded-gemini">✨ Gemini — embedded terminal</option>
                        <option value="embedded-shell">$ Shell — embedded terminal</option>
                    </optgroup>
                    <optgroup label="External">
                        <option value="antigravity">Antigravity (built-in chat)</option>
                        <option value="claude-code">Claude Code (VS Code terminal)</option>
                        <option value="gemini-cli">Gemini CLI (VS Code terminal)</option>
                    </optgroup>
                </select>
                <span style="opacity: 0.65; font-size: 11px;">Prompt is also copied to your clipboard.</span>
            </div>
            <textarea id="ai-message" placeholder="Prompt to send…"></textarea>
            <div class="ai-actions">
                <button id="ai-cancel">Cancel</button>
                <button id="ai-send" class="primary">Send</button>
            </div>
        </div>
    </div>

<script>
(function () {
    const vscode = acquireVsCodeApi();
    const contentEl = document.getElementById('content');
    const branchEl = document.getElementById('branch');
    const repoEl = document.getElementById('repo');
    const summaryEl = document.getElementById('summary');
    const searchEl = document.getElementById('search');
    const toggleBtn = document.getElementById('toggle-all');

    let lastChanges = [];
    let allHidden = false;
    let hiddenSet = new Set();
    let allComments = [];
    let autoExpandRecent = false;
    let editingCommentId = null;
    let composingFor = null; // { path, side, lineNum, lineText } when adding a new comment
    const collapsedComments = new Set();
    const analyzePathInflight = new Set();
    let pendingScrollPath = null; // file we just approved/rejected a hunk on; jump to next button after refresh
    const fileActionStatus = new Map(); // path -> 'approved' | 'rejected' (session-only)
    const expandedFiles = new Set();
    const CONTEXT_CYCLE = [3, 10, 50, 99999];
    const CONTEXT_LABELS = { 3: '3', 10: '10', 50: '50', 99999: 'All' };
    const COPY_CONTEXT_LINES = 5;

    const commitMsgEl = document.getElementById('commit-msg');
    const commitBtn = document.getElementById('commit-btn');
    const commitPushBtn = document.getElementById('commit-push-btn');
    const amendEl = document.getElementById('amend');
    const commitStatusEl = document.getElementById('commit-status');
    const hiddenPillEl = document.getElementById('hidden-pill');
    const hiddenCountEl = document.getElementById('hidden-count');
    const hiddenListEl = document.getElementById('hidden-list');
    const hiddenRowsEl = document.getElementById('hidden-rows');
    const autoExpandCb = document.getElementById('auto-expand-cb');
    const autoExpandToggle = document.getElementById('auto-expand-toggle');
    const gridSizeBtn = document.getElementById('grid-size-toggle');
    const gridResetBtn = document.getElementById('grid-reset');
    // Stack mode was removed — grid is the only layout. Kept as a const so
    // downstream guards (renderFile wrap, gridstack init, etc.) keep working
    // without a sweep through every call site.
    const gridMode = true;
    let gridMinColWidth = 840;
    let gridSize = 'md';
    const GRID_SIZE_CYCLE = ['sm', 'md', 'lg'];

    // Per-file GridStack layout (path -> { x, y, w, h } in grid units).
    // Persisted via vscode.setState so a panel reload preserves the user's
    // tile arrangement. w/h are column/row counts, not pixels — GridStack
    // converts via its column count + cellHeight.
    const persistedState = (typeof vscode.getState === 'function' && vscode.getState()) || {};
    const fileGridLayout = (persistedState && persistedState.fileGridLayout) || {};
    const GRID_COLUMN_COUNT = 12;
    const GRID_CELL_HEIGHT = 60;       // px per row unit
    const GRID_DEFAULT_H = 12;         // ~720px tall — bigger so a tile shows several hunks
    const GRID_MIN_H = 6;              // floor at ~360px so tiles stay readable
    const GRID_MIN_W = 3;              // floor at ~25% width
    const GRID_DEFAULT_W = { sm: 4, md: 6, lg: 12 };
    let persistTimer = null;
    function persistFileGridLayout() {
        const cur = (typeof vscode.getState === 'function' && vscode.getState()) || {};
        cur.fileGridLayout = fileGridLayout;
        try { vscode.setState(cur); } catch (e) { /* ignore */ }
    }
    function schedulePersistLayout() {
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(persistFileGridLayout, 300);
    }
    function captureGridLayout() {
        if (!gridStack) return;
        // grid.save(false) returns a serializable layout (no DOM content) —
        // safer than reaching into grid.engine.nodes directly.
        let items;
        try { items = gridStack.save(false) || []; } catch (e) { return; }
        let changed = false;
        for (const node of items) {
            const id = node.id;
            if (!id) continue;
            const next = { x: node.x | 0, y: node.y | 0, w: node.w | 0, h: node.h | 0 };
            const prev = fileGridLayout[id] || {};
            if (prev.x !== next.x || prev.y !== next.y || prev.w !== next.w || prev.h !== next.h) {
                fileGridLayout[id] = next;
                changed = true;
            }
        }
        if (changed) schedulePersistLayout();
    }

    // Snapshot/restore scroll positions across the destructive innerHTML rebuild
    // that render() does. Without this every state push from the extension
    // would slam the page (and every grid-mode file body) back to scrollTop 0.
    function snapshotScroll(scope) {
        const snap = {
            docX: window.scrollX,
            docY: window.scrollY,
            bodies: {},
        };
        const root = scope || contentEl;
        for (const fileEl of root.querySelectorAll('.file')) {
            const p = fileEl.getAttribute('data-path');
            if (!p) continue;
            const body = fileEl.querySelector(':scope > .file-body');
            if (!body) continue;
            // Only worth saving when the body actually scrolled.
            if (body.scrollTop || body.scrollLeft) {
                snap.bodies[p] = { top: body.scrollTop, left: body.scrollLeft };
            }
        }
        return snap;
    }
    /**
     * Scroll the next/previous hunk into view. When scope is a .file element
     * navigation stays inside that file (and stops at its boundaries); when
     * scope is null (keyboard shortcut) navigation walks all visible hunks
     * across the whole panel. The "current" hunk is whichever one is closest
     * to the viewport center, so jumping always moves you forward/backward
     * relative to where you're actually looking.
     */
    function scrollHunk(direction, scope) {
        const root = scope || contentEl;
        const hunks = Array.from(root.querySelectorAll('.hunk'))
            .filter(h => h.offsetParent !== null); // skip hidden files
        if (!hunks.length) return;
        const center = window.innerHeight / 2;
        let curIdx = 0;
        let bestDist = Infinity;
        hunks.forEach((h, i) => {
            const r = h.getBoundingClientRect();
            const mid = (r.top + r.bottom) / 2;
            const d = Math.abs(mid - center);
            if (d < bestDist) { bestDist = d; curIdx = i; }
        });
        const nextIdx = Math.max(0, Math.min(hunks.length - 1, curIdx + direction));
        const target = hunks[nextIdx];
        if (!target) return;
        // Briefly outline the destination so it's obvious where you landed.
        target.classList.remove('hunk-flash');
        // Re-flow then re-add so the animation restarts on repeat presses.
        void target.offsetWidth;
        target.classList.add('hunk-flash');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function restoreScroll(snap, scope) {
        if (!snap) return;
        const root = scope || contentEl;
        for (const p of Object.keys(snap.bodies || {})) {
            const fileEl = root.querySelector(\`.file[data-path="\${CSS.escape(p)}"]\`);
            if (!fileEl) continue;
            const body = fileEl.querySelector(':scope > .file-body');
            if (!body) continue;
            const s = snap.bodies[p];
            body.scrollTop = s.top;
            body.scrollLeft = s.left;
        }
        // Restore document scroll last so any layout shifts from the per-body
        // restores don't bump it again.
        window.scrollTo(snap.docX || 0, snap.docY || 0);
    }

    function refreshGridSizeBtn() {
        if (!gridSizeBtn) return;
        gridSizeBtn.textContent = 'Size: ' + gridSize;
        gridSizeBtn.title = 'Default tile width (cycle sm → md → lg). Currently: ' + gridSize;
    }

    function applyViewSettings(v) {
        if (!v) return;
        if (typeof v.gridMinColumnWidth === 'number' && v.gridMinColumnWidth > 0) {
            gridMinColWidth = v.gridMinColumnWidth;
            document.documentElement.style.setProperty('--grid-min-col', gridMinColWidth + 'px');
        }
        if (v.gridSize === 'sm' || v.gridSize === 'md' || v.gridSize === 'lg') {
            gridSize = v.gridSize;
        }
        // viewMode is no longer honored — stack mode was removed. Always grid.
        contentEl.classList.add('grid-mode');
        refreshGridSizeBtn();
    }
    // GridStack instance (created when entering grid mode, destroyed on exit).
    let gridStack = null;
    function teardownGridStack() {
        if (!gridStack) return;
        try { gridStack.destroy(false); } catch (e) { /* ignore */ }
        gridStack = null;
        contentEl.classList.remove('grid-stack');
    }
    function initGridStackOnContent() {
        if (!window.GridStack || !gridMode) return;
        contentEl.classList.add('grid-stack');
        gridStack = window.GridStack.init({
            column: GRID_COLUMN_COUNT,
            cellHeight: GRID_CELL_HEIGHT,
            margin: 6,
            float: false,
            disableOneColumnMode: true,
            handle: '.grid-drag-handle',
            resizable: { handles: 'e, se, s, sw, w' },
            animate: true,
        }, contentEl);
        gridStack.on('change', () => captureGridLayout());
        gridStack.on('resizestop dragstop', () => captureGridLayout());
    }

    // Reset grid layout — wipe persisted positions/sizes and rerender so
    // gridstack auto-places every tile at its default size.
    function resetGridLayout() {
        const keys = Object.keys(fileGridLayout);
        if (!keys.length) {
            // Nothing persisted, but a current GridStack instance may still
            // be holding modified positions from this session — destroy it
            // and rerender so defaults apply.
            teardownGridStack();
            rerenderFromLast();
            return;
        }
        for (const k of keys) delete fileGridLayout[k];
        persistFileGridLayout();
        teardownGridStack();
        rerenderFromLast();
    }
    if (gridResetBtn) {
        gridResetBtn.addEventListener('click', () => resetGridLayout());
    }
    if (gridSizeBtn) {
        gridSizeBtn.addEventListener('click', () => {
            const idx = GRID_SIZE_CYCLE.indexOf(gridSize);
            const next = GRID_SIZE_CYCLE[(idx + 1) % GRID_SIZE_CYCLE.length];
            gridSize = next;
            refreshGridSizeBtn();
            // Persist via setting; the extension will echo back applyViewSettings
            // with the resolved px width.
            vscode.postMessage({ type: 'setGridSize', size: next });
        });
    }
    refreshGridSizeBtn();

    // ---- Vertical (unified) diff orientation toggle ----
    // Defaults to vertical (top/bottom) when the user hasn't set a preference.
    const diffOrientBtn = document.getElementById('diff-orient-toggle');
    let verticalDiff = (persistedState && typeof persistedState.verticalDiff === 'boolean')
        ? persistedState.verticalDiff
        : true;
    function applyVerticalDiff() {
        document.body.classList.toggle('diff-vertical', verticalDiff);
        if (diffOrientBtn) {
            diffOrientBtn.textContent = verticalDiff ? '↕ Top/Bottom' : '↔ Side-by-side';
            diffOrientBtn.title = verticalDiff
                ? 'Switch diff layout to side-by-side'
                : 'Switch diff layout to unified top/bottom';
            diffOrientBtn.classList.toggle('active', verticalDiff);
        }
    }
    function persistVerticalDiff() {
        const cur = (typeof vscode.getState === 'function' && vscode.getState()) || {};
        cur.verticalDiff = verticalDiff;
        try { vscode.setState(cur); } catch (e) { /* ignore */ }
    }
    applyVerticalDiff();
    if (diffOrientBtn) {
        diffOrientBtn.addEventListener('click', () => {
            verticalDiff = !verticalDiff;
            applyVerticalDiff();
            persistVerticalDiff();
            // The two layouts emit different markup from renderHunk, so we
            // need a full re-render — toggling a class isn't enough.
            rerenderFromLast();
        });
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    /**
     * Highlight \`code\` (multi-line) with hljs. Returns array of HTML strings, one per line.
     * Spans that cross newlines are closed at line ends and reopened on the next line so
     * each line's HTML is self-contained and safely insertable into a single <td>.
     */
    function highlightLines(code, language) {
        const fallback = () => code.split('\\n').map(escapeHtml);
        if (!language || !window.hljs) return fallback();
        if (!window.hljs.getLanguage || !window.hljs.getLanguage(language)) return fallback();
        let html;
        try {
            html = window.hljs.highlight(code, { language, ignoreIllegals: true }).value;
        } catch (e) {
            return fallback();
        }
        const lines = [];
        const stack = [];
        let buf = '';
        let i = 0;
        const len = html.length;
        while (i < len) {
            const c = html[i];
            if (c === '<') {
                const end = html.indexOf('>', i);
                if (end === -1) { buf += html.slice(i); break; }
                const tag = html.slice(i, end + 1);
                buf += tag;
                if (tag.startsWith('</')) {
                    stack.pop();
                } else if (!tag.endsWith('/>')) {
                    stack.push(tag);
                }
                i = end + 1;
            } else if (c === '\\n') {
                const closing = stack.map(() => '</span>').join('');
                lines.push(buf + closing);
                buf = stack.join('');
                i++;
            } else {
                buf += c;
                i++;
            }
        }
        lines.push(buf);
        return lines;
    }

    function parseDiff(diff) {
        const sections = [];
        const lines = diff.split('\\n');
        let currentSection = { title: '', hunks: [], binary: false };
        let currentHunk = null;

        const pushSection = () => {
            if (currentSection.hunks.length || currentSection.binary || currentSection.title) {
                sections.push(currentSection);
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('### ')) {
                pushSection();
                currentSection = { title: line.slice(4), hunks: [], binary: false };
                currentHunk = null;
                continue;
            }
            if (line.startsWith('diff --git') || line.startsWith('index ') ||
                line.startsWith('new file') || line.startsWith('deleted file') ||
                line.startsWith('similarity ') || line.startsWith('rename ') ||
                line.startsWith('+++ ') || line.startsWith('--- ') ||
                line.startsWith('old mode') || line.startsWith('new mode')) {
                if (line.startsWith('Binary files')) currentSection.binary = true;
                continue;
            }
            if (line.startsWith('Binary files')) {
                currentSection.binary = true;
                continue;
            }
            if (line.startsWith('@@')) {
                const m = line.match(/^@@ -(\\d+)(?:,(\\d+))? \\+(\\d+)(?:,(\\d+))? @@(.*)$/);
                currentHunk = {
                    header: line,
                    context: m ? (m[5] || '') : '',
                    oldStart: m ? parseInt(m[1], 10) : 0,
                    newStart: m ? parseInt(m[3], 10) : 0,
                    rows: [],
                };
                currentSection.hunks.push(currentHunk);
                continue;
            }
            if (!currentHunk) continue;
            if (line.length === 0) continue;
            const c = line[0];
            const text = line.slice(1);
            if (c === '+') currentHunk.rows.push({ kind: 'add', text });
            else if (c === '-') currentHunk.rows.push({ kind: 'del', text });
            else if (c === ' ') currentHunk.rows.push({ kind: 'ctx', text });
            else if (c === '\\\\') { /* "\\ No newline at end of file" — skip */ }
        }
        pushSection();
        return sections;
    }

    function pairRows(hunk) {
        const pairs = [];
        let oldNum = hunk.oldStart;
        let newNum = hunk.newStart;
        let pendingDel = [];
        let pendingAdd = [];

        const flush = () => {
            const max = Math.max(pendingDel.length, pendingAdd.length);
            for (let i = 0; i < max; i++) {
                const d = pendingDel[i];
                const a = pendingAdd[i];
                pairs.push({
                    leftKind: d ? 'del' : 'empty',
                    leftNum: d ? d.num : '',
                    leftText: d ? d.text : '',
                    rightKind: a ? 'add' : 'empty',
                    rightNum: a ? a.num : '',
                    rightText: a ? a.text : '',
                });
            }
            pendingDel = [];
            pendingAdd = [];
        };

        for (const row of hunk.rows) {
            if (row.kind === 'del') pendingDel.push({ num: oldNum++, text: row.text });
            else if (row.kind === 'add') pendingAdd.push({ num: newNum++, text: row.text });
            else {
                flush();
                pairs.push({
                    leftKind: 'ctx', leftNum: oldNum++, leftText: row.text,
                    rightKind: 'ctx', rightNum: newNum++, rightText: row.text,
                });
            }
        }
        flush();
        return pairs;
    }

    /**
     * Compute per-line intra-diff ranges for a pair of changed lines.
     * Uses common-prefix + common-suffix detection — O(n), no DP table — to
     * find the smallest substring on each side that actually differs. Returns
     * { aStart, aEnd, bStart, bEnd } where [Start, End) on each string is the
     * differing range, or null when the lines are identical / one is empty.
     */
    function intraDiffSpans(a, b) {
        if (!a || !b || a === b) return null;
        const m = a.length, n = b.length;
        let p = 0;
        const min = m < n ? m : n;
        while (p < min && a.charCodeAt(p) === b.charCodeAt(p)) p++;
        let s = 0;
        while (s < (m - p) && s < (n - p)
               && a.charCodeAt(m - 1 - s) === b.charCodeAt(n - 1 - s)) s++;
        return { aStart: p, aEnd: m - s, bStart: p, bEnd: n - s };
    }

    /**
     * Walk hljs-highlighted HTML and wrap text characters in [start, end) with
     * <strong class="intra-diff">. Tags pass through verbatim; HTML entities
     * (&amp;, &lt;, &gt;, &quot;, &#39;) count as one source character so the
     * indices line up with the plain text used in intraDiffSpans(). The strong
     * is closed at every tag boundary to keep markup well-nested.
     */
    function wrapDiffHtml(html, start, end) {
        if (start >= end) return html;
        let out = '';
        let textIdx = 0;
        let i = 0;
        const len = html.length;
        let inDiff = false;
        const openIfNeeded = () => {
            if (!inDiff && textIdx >= start && textIdx < end) {
                out += '<strong class="intra-diff">';
                inDiff = true;
            } else if (inDiff && (textIdx < start || textIdx >= end)) {
                out += '</strong>';
                inDiff = false;
            }
        };
        while (i < len) {
            const c = html[i];
            if (c === '<') {
                const tagEnd = html.indexOf('>', i);
                if (tagEnd === -1) { out += html.slice(i); break; }
                if (inDiff) { out += '</strong>'; inDiff = false; }
                out += html.slice(i, tagEnd + 1);
                i = tagEnd + 1;
            } else if (c === '&') {
                const entEnd = html.indexOf(';', i);
                if (entEnd === -1) { openIfNeeded(); out += c; i++; textIdx++; continue; }
                openIfNeeded();
                out += html.slice(i, entEnd + 1);
                i = entEnd + 1;
                textIdx++;
            } else {
                openIfNeeded();
                out += c;
                i++;
                textIdx++;
            }
        }
        if (inDiff) out += '</strong>';
        return out;
    }

    /**
     * Build per-row highlighted HTML for one side of a hunk by joining all the side's
     * code into a single block, highlighting once, and slicing back to lines.
     * (Hunk-only fallback — used when full-file content isn't available.)
     */
    function highlightSide(pairs, side, language) {
        const indices = [];
        const texts = [];
        pairs.forEach((p, i) => {
            const k = p[side + 'Kind'];
            if (k !== 'empty') {
                indices.push(i);
                texts.push(p[side + 'Text']);
            }
        });
        const code = texts.join('\\n');
        const highlighted = highlightLines(code, language);
        const out = pairs.map(() => '');
        indices.forEach((pairIdx, lineIdx) => {
            out[pairIdx] = highlighted[lineIdx] !== undefined ? highlighted[lineIdx] : '';
        });
        return out;
    }

    // Cache of full-file highlights keyed by content identity.
    const fullFileHighlightCache = new Map();
    function quickHash(s) {
        let h = 5381;
        const n = s.length;
        const step = Math.max(1, Math.floor(n / 256));
        for (let i = 0; i < n; i += step) h = ((h * 33) + s.charCodeAt(i)) | 0;
        return h;
    }
    function getFullFileHighlight(filePath, version, content, language) {
        if (!content || !language) return null;
        const key = filePath + '|' + version + '|' + content.length + '|' + quickHash(content);
        let cached = fullFileHighlightCache.get(key);
        if (cached) return cached;
        cached = highlightLines(content, language);
        if (fullFileHighlightCache.size > 64) {
            const k0 = fullFileHighlightCache.keys().next().value;
            fullFileHighlightCache.delete(k0);
        }
        fullFileHighlightCache.set(key, cached);
        return cached;
    }
    function pickBaseContents(change, section) {
        // For each section, the diff is between two specific revisions of the file.
        if (change.untracked) {
            return { left: null, leftVersion: null, right: change.worktreeContent, rightVersion: 'worktree' };
        }
        if (section === 'staged') {
            return {
                left: change.headContent, leftVersion: 'head',
                right: change.indexContent, rightVersion: 'index',
            };
        }
        // unstaged section: index → worktree
        return {
            left: change.indexContent, leftVersion: 'index',
            right: change.worktreeContent, rightVersion: 'worktree',
        };
    }
    function highlightSideWithFullContext(pairs, side, change, section, language) {
        const bases = pickBaseContents(change, section);
        const baseContent = bases[side];
        const version = bases[side + 'Version'];
        const fullLines = getFullFileHighlight(change.path, version, baseContent, language);
        if (!fullLines) {
            // Fall back to per-hunk highlight when we can't see the whole file.
            return highlightSide(pairs, side, language);
        }
        return pairs.map(p => {
            const num = side === 'left' ? p.leftNum : p.rightNum;
            const text = side === 'left' ? p.leftText : p.rightText;
            const kind = side === 'left' ? p.leftKind : p.rightKind;
            if (kind === 'empty') return '';
            const idx = (typeof num === 'number' ? num : parseInt(num, 10)) - 1;
            if (idx < 0 || idx >= fullLines.length) return escapeHtml(text || '');
            // Defensive: if the displayed text doesn't match the base file line
            // (rare — file changed mid-render), fall back to escaped raw text
            // so users don't see HTML for a wrong line.
            // Stripping highlight tags to compare would be costly, so just trust
            // the line-number mapping; mismatches happen for at most one render.
            return fullLines[idx];
        });
    }

    function commentsForRow(filePath, p) {
        const matches = [];
        for (const c of allComments) {
            if (c.file !== filePath) continue;
            const num = c.side === 'right' ? p.rightNum : p.leftNum;
            const text = c.side === 'right' ? p.rightText : p.leftText;
            const kind = c.side === 'right' ? p.rightKind : p.leftKind;
            if (kind === 'empty') continue;
            // Anchor: prefer exact text match on remembered line; fall back to line number.
            if (c.lineText && c.lineText === text) matches.push({ comment: c, stale: false });
            else if (Number(num) === Number(c.lineNum)) matches.push({ comment: c, stale: c.lineText !== text });
        }
        return matches;
    }

    function truncateText(s, n) {
        const flat = (s || '').replace(/\\s+/g, ' ').trim();
        return flat.length > n ? flat.slice(0, n - 1) + '…' : flat;
    }

    function renderCommentRow(filePath, side, lineNum, lineText, entries, isComposingHere) {
        const blocks = entries.map(({ comment, stale }) => {
            if (editingCommentId === comment.id) {
                return \`
                    <div class="comment-block editing" data-comment-id="\${comment.id}">
                        <div class="meta"><span>✎ Editing comment on \${comment.side === 'right' ? '+' : '-'}line \${comment.lineNum}</span></div>
                        <textarea data-role="edit-input">\${escapeHtml(comment.body)}</textarea>
                        <div class="actions">
                            <button class="primary" data-c-action="save-edit" data-id="\${comment.id}">Save</button>
                            <button data-c-action="cancel-edit">Cancel</button>
                        </div>
                    </div>
                \`;
            }
            const isCollapsed = collapsedComments.has(comment.id);
            const peek = isCollapsed ? \`<span class="peek">\${escapeHtml(truncateText(comment.body, 80))}</span>\` : '';
            const aiCls = comment.aiGenerated && comment.severity ? ' ai-' + comment.severity : '';
            return \`
                <div class="comment-block \${isCollapsed ? 'collapsed' : ''}\${aiCls}" data-comment-id="\${comment.id}">
                    <div class="meta" data-c-action="toggle-collapse" data-id="\${comment.id}" title="Click to \${isCollapsed ? 'expand' : 'minimize'}">
                        <span class="chevron">▶</span>
                        <span>💬 \${comment.side === 'right' ? '+' : '-'}line \${comment.lineNum}</span>
                        \${stale ? '<span class="stale" title="Source line no longer matches the original text">(line shifted)</span>' : ''}
                        \${peek}
                    </div>
                    <div class="body">\${escapeHtml(comment.body)}</div>
                    <div class="actions">
                        <button data-c-action="copy" data-id="\${comment.id}" title="Copy diff context + this comment as markdown">📋 Copy with context</button>
                        <button data-c-action="edit" data-id="\${comment.id}">Edit</button>
                        <button data-c-action="delete" data-id="\${comment.id}">Delete</button>
                    </div>
                </div>
            \`;
        }).join('');

        let composer = '';
        if (isComposingHere) {
            composer = \`
                <div class="comment-block" data-composing="1">
                    <div class="meta">New comment on \${side === 'right' ? '+' : '-'}line \${lineNum}</div>
                    <textarea data-role="new-input" autofocus placeholder="Write a review comment…"></textarea>
                    <div class="actions">
                        <button class="primary" data-c-action="save-new"
                            data-file="\${escapeHtml(filePath)}"
                            data-side="\${side}"
                            data-line-num="\${lineNum}"
                            data-line-text="\${escapeHtml(lineText)}">Save (⌘+Enter)</button>
                        <button data-c-action="cancel-new">Cancel</button>
                    </div>
                </div>
            \`;
        }
        // Comment row spans both columns regardless of orientation; vertical
        // mode uses 2 cols, side-by-side uses 4. colspan="4" works for both
        // because tables ignore extra colspan beyond the actual column count.
        return \`<tr class="comment-row"><td colspan="4">\${blocks}\${composer}</td></tr>\`;
    }

    function renderHunk(hunk, language, section, hunkIndex, options) {
        const pairs = pairRows(hunk);
        const leftHtml = options.change
            ? highlightSideWithFullContext(pairs, 'left', options.change, section, language)
            : highlightSide(pairs, 'left', language);
        const rightHtml = options.change
            ? highlightSideWithFullContext(pairs, 'right', options.change, section, language)
            : highlightSide(pairs, 'right', language);

        const isVert = !!verticalDiff;
        const rowsHtml = [];

        const commentsForPair = (p) => {
            if (!options.filePath) return { left: [], right: [], composingLeft: false, composingRight: false };
            const allEntries = commentsForRow(options.filePath, p);
            const composingLeft = composingFor && composingFor.path === options.filePath
                && composingFor.side === 'left' && composingFor.lineNum === p.leftNum;
            const composingRight = composingFor && composingFor.path === options.filePath
                && composingFor.side === 'right' && composingFor.lineNum === p.rightNum;
            return {
                left: allEntries.filter(e => e.comment.side === 'left'),
                right: allEntries.filter(e => e.comment.side === 'right'),
                composingLeft,
                composingRight,
            };
        };

        pairs.forEach((p, i) => {
            const trClass = (p.leftKind === p.rightKind) ? p.leftKind : 'mixed';
            // For modification pairs (line on both sides but changed), bold
            // the differing chars on each side using a prefix/suffix diff.
            let leftLineHtml = leftHtml[i];
            let rightLineHtml = rightHtml[i];
            if (p.leftKind === 'del' && p.rightKind === 'add') {
                const d = intraDiffSpans(p.leftText || '', p.rightText || '');
                if (d) {
                    leftLineHtml = wrapDiffHtml(leftLineHtml, d.aStart, d.aEnd);
                    rightLineHtml = wrapDiffHtml(rightLineHtml, d.bStart, d.bEnd);
                }
            }
            const cmt = commentsForPair(p);

            if (isVert) {
                // Unified layout: a 2-column table where each side becomes its
                // own row. Context lines (both sides identical) render once.
                // Pure adds/dels render only the populated side. Modifications
                // render the old line above the new line. Comment rows are
                // injected directly under the side they were authored on.
                if (p.leftKind === 'ctx' && p.rightKind === 'ctx') {
                    rowsHtml.push(\`
                        <tr class="code-row ctx" data-row-index="\${i}">
                            <td class="num ctx" data-side="left" data-line="\${p.leftNum}">\${p.leftNum}<span class="add-comment" title="Add comment">+</span></td>
                            <td class="code del-side ctx"><span class="code-inner hljs">\${leftLineHtml}</span></td>
                        </tr>
                    \`);
                    // Show BOTH left- and right-side comments under the
                    // unified context row. A comment authored on the right
                    // side in side-by-side mode (c.side === 'right') would
                    // otherwise vanish in unified view since context lines
                    // collapse into a single left-anchored row here.
                    if (cmt.left.length || cmt.composingLeft) {
                        rowsHtml.push(renderCommentRow(options.filePath, 'left', p.leftNum, p.leftText, cmt.left, cmt.composingLeft));
                    }
                    if (cmt.right.length || cmt.composingRight) {
                        rowsHtml.push(renderCommentRow(options.filePath, 'right', p.rightNum, p.rightText, cmt.right, cmt.composingRight));
                    }
                } else {
                    if (p.leftKind !== 'empty') {
                        rowsHtml.push(\`
                            <tr class="code-row mixed" data-row-index="\${i}">
                                <td class="num \${p.leftKind}" data-side="left" data-line="\${p.leftNum}">\${p.leftNum}<span class="add-comment" title="Add comment">+</span></td>
                                <td class="code del-side \${p.leftKind}"><span class="code-inner hljs">\${leftLineHtml}</span></td>
                            </tr>
                        \`);
                        if (cmt.left.length || cmt.composingLeft) {
                            rowsHtml.push(renderCommentRow(options.filePath, 'left', p.leftNum, p.leftText, cmt.left, cmt.composingLeft));
                        }
                    }
                    if (p.rightKind !== 'empty') {
                        rowsHtml.push(\`
                            <tr class="code-row mixed" data-row-index="\${i}">
                                <td class="num \${p.rightKind}" data-side="right" data-line="\${p.rightNum}">\${p.rightNum}<span class="add-comment" title="Add comment">+</span></td>
                                <td class="code add-side \${p.rightKind}"><span class="code-inner hljs">\${rightLineHtml}</span></td>
                            </tr>
                        \`);
                        if (cmt.right.length || cmt.composingRight) {
                            rowsHtml.push(renderCommentRow(options.filePath, 'right', p.rightNum, p.rightText, cmt.right, cmt.composingRight));
                        }
                    }
                }
            } else {
                rowsHtml.push(\`
                    <tr class="code-row \${trClass}" data-row-index="\${i}">
                        <td class="num \${p.leftKind}" data-side="left" data-line="\${p.leftNum}">\${p.leftNum}\${p.leftKind !== 'empty' ? '<span class="add-comment" title="Add comment">+</span>' : ''}</td>
                        <td class="code del-side \${p.leftKind}"><span class="code-inner hljs">\${leftLineHtml}</span></td>
                        <td class="num \${p.rightKind}" data-side="right" data-line="\${p.rightNum}">\${p.rightNum}\${p.rightKind !== 'empty' ? '<span class="add-comment" title="Add comment">+</span>' : ''}</td>
                        <td class="code add-side \${p.rightKind}"><span class="code-inner hljs">\${rightLineHtml}</span></td>
                    </tr>
                \`);
                if (cmt.left.length || cmt.composingLeft) {
                    rowsHtml.push(renderCommentRow(options.filePath, 'left', p.leftNum, p.leftText, cmt.left, cmt.composingLeft));
                }
                if (cmt.right.length || cmt.composingRight) {
                    rowsHtml.push(renderCommentRow(options.filePath, 'right', p.rightNum, p.rightText, cmt.right, cmt.composingRight));
                }
            }
        });
        const rows = rowsHtml.join('');

        const actions = options.allowHunkActions ? \`
            <span class="hunk-actions">
                \${section === 'unstaged'
                    ? '<button class="approve" data-hunk-action="approve" title="Stage this hunk">✓ Approve</button>'
                    : ''}
                <button class="reject" data-hunk-action="reject" title="Discard this hunk">✗ Reject</button>
            </span>
        \` : '';

        const colgroup = isVert
            ? '<col class="num"><col class="code">'
            : '<col class="num"><col class="code"><col class="num"><col class="code">';

        return \`
            <div class="hunk" data-section="\${section}" data-hunk-index="\${hunkIndex}">
                <div class="hunk-header">
                    <span class="hunk-text">\${escapeHtml(hunk.header)}</span>
                    \${actions}
                </div>
                <div class="diff-scroll">
                    <table class="diff-table\${isVert ? ' vertical' : ''}">
                        <colgroup>\${colgroup}</colgroup>
                        <tbody>\${rows}</tbody>
                    </table>
                </div>
            </div>
        \`;
    }

    function sectionKey(title) {
        const t = (title || '').toLowerCase();
        if (t.startsWith('staged')) return 'staged';
        return 'unstaged';
    }

    function nextContext(current) {
        const idx = CONTEXT_CYCLE.indexOf(current);
        const next = CONTEXT_CYCLE[(idx + 1) % CONTEXT_CYCLE.length];
        return next;
    }

    // flat=true skips the GridStack wrapper — used by the map's anchored
    // diff panel, which injects the file into its own container.
    function renderFile(change, flat) {
        const sections = parseDiff(change.diff || '');
        const lang = change.language || '';
        const allowHunkActions = !change.untracked && !change.binary;
        const sectionsHtml = sections.length === 0
            ? '<div class="binary-note">No diff content available.</div>'
            : sections.map(sec => {
                const title = sec.title ? \`<div class="section-title">\${escapeHtml(sec.title)}</div>\` : '';
                if (sec.binary) return \`\${title}<div class="binary-note">Binary file — diff not shown.</div>\`;
                if (sec.hunks.length === 0) return \`\${title}<div class="binary-note">No textual changes.</div>\`;
                const sk = sec.title ? sectionKey(sec.title) : (change.staged ? 'staged' : 'unstaged');
                return title + sec.hunks
                    .map((h, idx) => renderHunk(h, lang, sk, idx, { allowHunkActions, filePath: change.path, change }))
                    .join('');
            }).join('');

        const tags = [];
        const actionStatus = fileActionStatus.get(change.path);
        if (actionStatus === 'approved') tags.push('<span class="action-tag approved">✓ approved</span>');
        if (actionStatus === 'rejected') tags.push('<span class="action-tag rejected">✗ rejected</span>');
        if (change.staged) tags.push('<span class="stage-tag">staged</span>');
        if (change.unstaged) tags.push('<span class="stage-tag">unstaged</span>');
        if (change.untracked) tags.push('<span class="stage-tag">untracked</span>');
        if (change.isMostRecent) tags.push('<span class="recent-tag" title="Most recently modified">↑ recent</span>');

        const statusClass = change.status === '?' ? '\\\\?' : change.status;
        const ctxLabel = CONTEXT_LABELS[change.context] || String(change.context);
        const isExpanded = expandedFiles.has(change.path);
        const fileCommentCount = allComments.filter(c => c.file === change.path).length;
        const statusCls = actionStatus === 'approved' ? 'file-approved'
            : actionStatus === 'rejected' ? 'file-rejected' : '';
        // Header stripe color keys off git status; untracked reads as added,
        // matching the Code Map's color language.
        const stKey = (change.untracked || change.status === '?') ? 'A' : String(change.status || 'M').charAt(0).toUpperCase();
        const pCut = change.path.lastIndexOf('/');
        const pDir = pCut > 0 ? change.path.slice(0, pCut + 1) : '';
        const pName = pCut > 0 ? change.path.slice(pCut + 1) : change.path;
        const pathHtml = (pDir ? '<span class="p-dir">' + escapeHtml(pDir) + '</span>' : '')
            + '<span class="p-name">' + escapeHtml(pName) + '</span>';
        const inner = \`
            <div class="file st-\${stKey} \${isExpanded ? 'expanded' : ''} \${change.isMostRecent ? 'most-recent' : ''} \${statusCls}" data-path="\${escapeHtml(change.path)}" data-context="\${change.context}">
                <div class="file-header">
                    <span class="grid-drag-handle" title="Drag to rearrange">⋮⋮</span>
                    <span class="chevron">▶</span>
                    <span class="badge \${statusClass}">\${escapeHtml(change.statusLabel)}</span>
                    \${tags.join('')}
                    <span class="path" title="\${escapeHtml(change.path)}">\${pathHtml}</span>
                    <span class="stats">
                        <span class="add">+\${change.additions}</span>
                        <span class="del">-\${change.deletions}</span>
                    </span>
                    <span class="file-actions">
                        <span class="action-group" data-group="nav" title="Navigate hunks in this file">
                            <button data-action="prevHunk" title="Scroll to previous hunk in this file (Alt+↑ for global)">↑ Prev</button>
                            <button data-action="nextHunk" title="Scroll to next hunk in this file (Alt+↓ for global)">↓ Next</button>
                            <button class="ctx-btn" data-action="cycleContext" title="Cycle visible context lines (also: Alt+scroll on the diff)">Context: \${ctxLabel}</button>
                        </span>
                        <span class="action-group" data-group="file">
                            <button data-action="openFile">Open</button>
                            <button data-action="openNativeDiff">Native Diff</button>
                            \${change.staged
                                ? '<button data-action="unstage">Unstage</button>'
                                : (change.untracked || change.unstaged)
                                    ? '<button data-action="stage">Stage</button>'
                                    : ''}
                            \${(change.unstaged || change.untracked)
                                ? '<button class="approve-all-btn" data-action="approveAll" title="Approve every hunk in this file (git add)">✓ Approve All</button>'
                                : ''}
                            <button class="danger" data-action="discard" title="Discard ALL changes to this file">Discard</button>
                            <button class="icon-btn" data-action="hide" title="Hide this file from the list">×</button>
                        </span>
                        <span class="action-group" data-group="ai">
                            <button data-action="sendToAi" title="Open a chat with this file's diff + your comments">🤖 Send to AI</button>
                            <button data-action="analyzeDiff" title="Run senior-architect code review on this file's diff and add inline comments for issues found">🔍 Analyze</button>
                            \${fileCommentCount > 0 ? \`<button data-action="copyReview" title="Copy all commented regions + comments as markdown">📋 Copy (\${fileCommentCount})</button>\` : ''}
                        </span>
                    </span>
                </div>
                <div class="file-body">\${sectionsHtml}</div>
            </div>
        \`;
        if (flat || !gridMode) return inner;
        // In grid mode each file is wrapped in GridStack's expected markup.
        // gs-id keys the widget to its file path so layout persistence and
        // diff-based DOM updates can find it. gs-x/y/w/h come from saved
        // layout; if absent GridStack auto-places the widget.
        const layout = fileGridLayout[change.path] || {};
        const defaultW = GRID_DEFAULT_W[gridSize] || 6;
        const defaultH = GRID_DEFAULT_H;
        const gsW = Number.isFinite(layout.w) ? layout.w : defaultW;
        const gsH = Number.isFinite(layout.h) ? layout.h : defaultH;
        const posAttrs = (Number.isFinite(layout.x) && Number.isFinite(layout.y))
            ? \`gs-x="\${layout.x}" gs-y="\${layout.y}"\`
            : '';
        return \`
            <div class="grid-stack-item" gs-id="\${escapeHtml(change.path)}" \${posAttrs} gs-w="\${gsW}" gs-h="\${gsH}" gs-min-w="\${GRID_MIN_W}" gs-min-h="\${GRID_MIN_H}">
                <div class="grid-stack-item-content">\${inner}</div>
            </div>
        \`;
    }

    let lastState = null;
    function rerenderFromLast() {
        if (lastState) render(lastState);
    }
    function render(state) {
        lastState = state;
        lastChanges = state.changes || [];
        hiddenSet = new Set(state.hidden || []);
        // Drop per-file UI state for files that no longer have any pending changes.
        const livePaths = new Set(lastChanges.map(c => c.path));
        for (const p of Array.from(fileActionStatus.keys())) {
            if (!livePaths.has(p)) fileActionStatus.delete(p);
        }
        for (const p of Array.from(expandedFiles)) {
            if (!livePaths.has(p)) expandedFiles.delete(p);
        }
        // Drop saved per-file grid layout for paths that are no longer present
        // so the persisted state doesn't grow unbounded over time.
        let layoutChanged = false;
        for (const p of Object.keys(fileGridLayout)) {
            if (!livePaths.has(p)) { delete fileGridLayout[p]; layoutChanged = true; }
        }
        if (layoutChanged) schedulePersistLayout();
        if (Array.isArray(state.comments)) allComments = state.comments;
        if (state.view) applyViewSettings(state.view);
        if (typeof state.autoExpandRecent === 'boolean') {
            autoExpandRecent = state.autoExpandRecent;
            autoExpandCb.checked = autoExpandRecent;
            autoExpandToggle.classList.toggle('active', autoExpandRecent);
        }
        if (typeof state.draft === 'string' && document.activeElement !== commitMsgEl) {
            commitMsgEl.value = state.draft;
        }
        updateHiddenUi();

        branchEl.textContent = state.branch?.branch || '(detached)';
        if (state.branch) {
            const ab = [];
            if (state.branch.ahead) ab.push(\`↑\${state.branch.ahead}\`);
            if (state.branch.behind) ab.push(\`↓\${state.branch.behind}\`);
            if (ab.length) {
                branchEl.innerHTML = escapeHtml(state.branch.branch || '(detached)') +
                    \` <span class="ahead-behind">\${ab.join(' ')}</span>\`;
            }
        }
        repoEl.textContent = state.repoRoot || '';

        let visible = lastChanges.filter(c => !hiddenSet.has(c.path));
        // Sort by mtime desc when auto-expand mode is on; otherwise alphabetical (extension already sorts).
        if (autoExpandRecent) {
            visible = visible.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
            // Tag the top file and force-expand it; collapse others.
            visible.forEach((c, i) => { c.isMostRecent = i === 0 && (c.mtime || 0) > 0; });
            expandedFiles.clear();
            if (visible[0]) expandedFiles.add(visible[0].path);
        } else {
            visible.forEach(c => { c.isMostRecent = false; });
            // Grid organizes like the Code Map: folder-grouped — root files
            // first, then each directory's files clustered together.
            if (gridMode) {
                visible = visible.slice().sort((a, b) => {
                    const da = a.path.slice(0, a.path.lastIndexOf('/') + 1);
                    const db = b.path.slice(0, b.path.lastIndexOf('/') + 1);
                    return da === db ? a.path.localeCompare(b.path) : da.localeCompare(db);
                });
            }
        }
        // In grid mode, every visible file should be expanded — including ones
        // that just appeared from a refresh. setGridMode() only fires on toggle,
        // so without this newly-arrived files would render collapsed.
        if (gridMode) {
            for (const c of visible) expandedFiles.add(c.path);
        }

        const totalAdd = visible.reduce((n, c) => n + c.additions, 0);
        const totalDel = visible.reduce((n, c) => n + c.deletions, 0);
        const hiddenCount = lastChanges.length - visible.length;
        const hiddenSuffix = hiddenCount > 0 ? \` • \${hiddenCount} hidden\` : '';
        summaryEl.textContent = \`\${visible.length} file\${visible.length === 1 ? '' : 's'} • +\${totalAdd} / -\${totalDel}\${hiddenSuffix}\`;

        if (visible.length === 0) {
            contentEl.innerHTML = lastChanges.length === 0
                ? '<div class="empty">Working tree is clean. ✨</div>'
                : '<div class="empty">All changed files are hidden. Use the “hidden” pill above to bring them back.</div>';
            return;
        }
        const snaps = snapshotComposers(contentEl);
        const scrollSnap = snapshotScroll(contentEl);
        withTransition(() => {
            // Tear down any existing GridStack before innerHTML replacement —
            // otherwise gridstack's internal node list points at orphan DOM.
            if (gridStack) teardownGridStack();
            contentEl.innerHTML = visible.map(renderFile).join('');
            restoreComposers(contentEl, snaps);
            applySearchFilter();
            if (gridMode) initGridStackOnContent();
            // Restore scroll after layout is applied so per-body max-scroll is
            // already correct when we set scrollTop/scrollLeft.
            restoreScroll(scrollSnap, contentEl);
        });
    }

    function updateHiddenUi() {
        const n = hiddenSet.size;
        hiddenCountEl.textContent = String(n);
        hiddenPillEl.classList.toggle('has-hidden', n > 0);
        if (n === 0) {
            hiddenListEl.classList.remove('open');
            return;
        }
        const rows = Array.from(hiddenSet).sort().map(p => \`
            <div class="h-row">
                <span class="path" title="\${escapeHtml(p)}">\${escapeHtml(p)}</span>
                <button data-unhide="\${escapeHtml(p)}">Unhide</button>
            </div>
        \`).join('');
        hiddenRowsEl.innerHTML = rows;
    }

    function replaceFile(change) {
        const idx = lastChanges.findIndex(c => c.path === change.path);
        if (idx >= 0) lastChanges[idx] = change;
        // In grid mode, fall back to a full re-render so GridStack stays in
        // sync with its DOM. Per-file surgical replacement would orphan the
        // widget node it tracks. The full render preserves layout via
        // fileGridLayout + scroll snapshot so the user shouldn't notice.
        if (gridMode) {
            if (gridMode) expandedFiles.add(change.path);
            rerenderFromLast();
            return;
        }
        const existing = contentEl.querySelector(\`.file[data-path="\${CSS.escape(change.path)}"]\`);
        if (!existing) return;
        const snaps = snapshotComposers(existing);
        const scrollSnap = snapshotScroll(existing.parentElement || contentEl);
        withTransition(() => {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = renderFile(change);
            const replacement = wrapper.firstElementChild;
            existing.replaceWith(replacement);
            restoreComposers(replacement, snaps);
            restoreScroll(scrollSnap, contentEl);
        });
    }

    function applySearchFilter() {
        const q = (searchEl.value || '').toLowerCase().trim();
        for (const fileEl of contentEl.querySelectorAll('.file')) {
            const p = (fileEl.getAttribute('data-path') || '').toLowerCase();
            fileEl.classList.toggle('hidden-by-search', q && !p.includes(q));
        }
    }

    function withTransition(fn) {
        // Animations were intentionally removed — DOM mutations happen instantly.
        fn();
    }

    // ---- Composer / edit-textarea state preservation across re-renders ----

    function snapshotComposers(scope) {
        const snaps = [];
        const tas = scope.querySelectorAll(
            'textarea[data-role="new-input"], textarea[data-role="edit-input"]'
        );
        for (const ta of tas) {
            const role = ta.getAttribute('data-role');
            const block = ta.closest('.comment-block');
            if (!block) continue;
            let anchor = '';
            if (role === 'edit-input') {
                anchor = 'edit:' + (block.getAttribute('data-comment-id') || '');
            } else {
                const saveBtn = block.querySelector('button[data-c-action="save-new"]');
                if (!saveBtn) continue;
                const f = saveBtn.getAttribute('data-file') || '';
                const s = saveBtn.getAttribute('data-side') || '';
                const ln = saveBtn.getAttribute('data-line-num') || '';
                anchor = 'new:' + f + '\\u0001' + s + '\\u0001' + ln;
            }
            snaps.push({
                role,
                anchor,
                value: ta.value,
                selStart: ta.selectionStart,
                selEnd: ta.selectionEnd,
                scrollTop: ta.scrollTop,
                focused: document.activeElement === ta,
            });
        }
        return snaps;
    }

    function restoreComposers(scope, snaps) {
        if (!snaps || !snaps.length) return;
        for (const snap of snaps) {
            let ta = null;
            if (snap.role === 'edit-input') {
                const id = snap.anchor.slice('edit:'.length);
                const block = scope.querySelector(
                    \`.comment-block[data-comment-id="\${CSS.escape(id)}"]\`
                );
                if (block) ta = block.querySelector('textarea[data-role="edit-input"]');
            } else {
                const parts = snap.anchor.slice('new:'.length).split('\\u0001');
                const [file, side, line] = parts;
                const sel = \`button[data-c-action="save-new"]\` +
                    \`[data-file="\${CSS.escape(file || '')}"]\` +
                    \`[data-side="\${CSS.escape(side || '')}"]\` +
                    \`[data-line-num="\${CSS.escape(line || '')}"]\`;
                const btn = scope.querySelector(sel);
                if (btn) {
                    const block = btn.closest('.comment-block');
                    if (block) ta = block.querySelector('textarea[data-role="new-input"]');
                }
            }
            if (!ta) continue;
            ta.value = snap.value;
            try { ta.setSelectionRange(snap.selStart, snap.selEnd); } catch (e) { /* ignore */ }
            ta.scrollTop = snap.scrollTop;
            if (snap.focused) ta.focus({ preventScroll: true });
        }
    }

    // Shared delegation — used by the grid (#content) and the map's diff drawer,
    // so hunk approve/reject/comment actions work identically in both places.
    const onContentClick = (e) => {
        const target = e.target;
        const fileEl = target.closest('.file');
        if (!fileEl) return;
        const p = fileEl.getAttribute('data-path');
        // The map's anchored panel reuses this delegation. Local re-renders
        // and focus must stay inside the panel there, not hit the grid.
        const inPanel = !!target.closest('#map-panel-body');
        const scopeEl = inPanel ? mapPanelBody : contentEl;
        const rerenderHere = () => {
            if (inPanel) refreshMapPanel();
            else replaceFile(lastChanges.find(c => c.path === p));
        };

        const hunkBtn = target.closest('button[data-hunk-action]');
        if (hunkBtn) {
            e.stopPropagation();
            const hunkEl = hunkBtn.closest('.hunk');
            if (!hunkEl) return;
            const section = hunkEl.getAttribute('data-section') || 'unstaged';
            const hunkIndex = parseInt(hunkEl.getAttribute('data-hunk-index') || '0', 10);
            const action = hunkBtn.getAttribute('data-hunk-action');
            const change = lastChanges.find(c => c.path === p);
            const isUntracked = change && change.untracked;
            if (isUntracked) return; // shouldn't render, but guard anyway
            if (action === 'approve' || action === 'reject') {
                pendingScrollPath = p;
                expandedFiles.add(p);
                fileActionStatus.set(p, action === 'approve' ? 'approved' : 'rejected');
                vscode.postMessage({
                    type: action === 'approve' ? 'approveHunk' : 'rejectHunk',
                    path: p, section, hunkIndex,
                });
            }
            return;
        }

        // Click "+" affordance to start composing a new comment.
        const addBtn = target.closest('.add-comment');
        if (addBtn) {
            e.stopPropagation();
            const numCell = addBtn.closest('td.num');
            if (!numCell) return;
            const side = numCell.getAttribute('data-side');
            const lineNum = parseInt(numCell.getAttribute('data-line') || '0', 10);
            const tr = numCell.closest('tr.code-row');
            const rowIndex = parseInt(tr.getAttribute('data-row-index') || '0', 10);
            // Recover the line text from the corresponding code cell.
            const codeCell = tr.querySelector(side === 'left' ? 'td.del-side' : 'td.add-side');
            const lineText = codeCell ? codeCell.innerText : '';
            composingFor = { path: p, side, lineNum, lineText };
            rerenderHere();
            // Focus the new textarea
            setTimeout(() => {
                const ta = scopeEl.querySelector(\`.file[data-path="\${CSS.escape(p)}"] textarea[data-role="new-input"]\`);
                if (ta) ta.focus();
            }, 0);
            return;
        }

        // Comment-block actions (save / edit / delete / copy / cancel / toggle-collapse).
        const cBtn = target.closest('[data-c-action]');
        if (cBtn) {
            e.stopPropagation();
            const cAction = cBtn.getAttribute('data-c-action');
            if (cAction === 'save-new') {
                const ta = cBtn.closest('.comment-block').querySelector('textarea[data-role="new-input"]');
                const body = (ta && ta.value || '').trim();
                if (!body) { ta && ta.focus(); return; }
                vscode.postMessage({
                    type: 'addComment',
                    file: cBtn.getAttribute('data-file'),
                    side: cBtn.getAttribute('data-side'),
                    lineNum: parseInt(cBtn.getAttribute('data-line-num') || '0', 10),
                    lineText: cBtn.getAttribute('data-line-text') || '',
                    body,
                });
                composingFor = null;
            } else if (cAction === 'cancel-new') {
                composingFor = null;
                rerenderHere();
            } else if (cAction === 'edit') {
                editingCommentId = cBtn.getAttribute('data-id');
                rerenderHere();
                setTimeout(() => {
                    const ta = scopeEl.querySelector(\`textarea[data-role="edit-input"]\`);
                    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
                }, 0);
            } else if (cAction === 'cancel-edit') {
                editingCommentId = null;
                rerenderHere();
            } else if (cAction === 'save-edit') {
                const ta = cBtn.closest('.comment-block').querySelector('textarea[data-role="edit-input"]');
                const body = (ta && ta.value || '').trim();
                vscode.postMessage({
                    type: 'editComment',
                    id: cBtn.getAttribute('data-id'),
                    body,
                });
                editingCommentId = null;
            } else if (cAction === 'delete') {
                const id = cBtn.getAttribute('data-id');
                vscode.postMessage({ type: 'deleteComment', id });
            } else if (cAction === 'copy') {
                const id = cBtn.getAttribute('data-id');
                const md = buildSingleCommentMarkdown(p, id);
                if (md) {
                    vscode.postMessage({ type: 'copyToClipboard', text: md, label: 'comment' });
                }
            } else if (cAction === 'toggle-collapse') {
                const id = cBtn.getAttribute('data-id');
                if (collapsedComments.has(id)) collapsedComments.delete(id);
                else collapsedComments.add(id);
                rerenderHere();
            }
            return;
        }

        const actionBtn = target.closest('button[data-action]');
        if (actionBtn) {
            e.stopPropagation();
            const action = actionBtn.getAttribute('data-action');
            if (action === 'openFile') vscode.postMessage({ type: 'openFile', path: p });
            else if (action === 'openNativeDiff') vscode.postMessage({ type: 'openNativeDiff', path: p });
            else if (action === 'stage') vscode.postMessage({ type: 'stage', path: p });
            else if (action === 'unstage') vscode.postMessage({ type: 'unstage', path: p });
            else if (action === 'cycleContext') {
                const cur = parseInt(fileEl.getAttribute('data-context') || '3', 10);
                const next = nextContext(cur);
                actionBtn.textContent = 'Context: ' + (CONTEXT_LABELS[next] || next) + '…';
                vscode.postMessage({ type: 'setContext', path: p, context: next });
            }
            else if (action === 'prevHunk') { scrollHunk(-1, fileEl); }
            else if (action === 'nextHunk') { scrollHunk(1, fileEl); }
            else if (action === 'hide') {
                vscode.postMessage({ type: 'hideFile', path: p });
            }
            else if (action === 'discard') {
                const change = lastChanges.find(c => c.path === p);
                vscode.postMessage({
                    type: 'discardFile',
                    path: p,
                    untracked: !!(change && change.untracked),
                });
            }
            else if (action === 'copyReview') {
                const md = buildFileReviewMarkdown(p);
                if (md) vscode.postMessage({ type: 'copyToClipboard', text: md, label: 'review' });
            }
            else if (action === 'sendToAi') {
                openAiDialog(p);
            }
            else if (action === 'analyzeDiff') {
                const original = actionBtn.textContent;
                actionBtn.disabled = true;
                actionBtn.textContent = '⌛ Analyzing…';
                actionBtn.dataset.originalLabel = original;
                analyzePathInflight.add(p);
                vscode.postMessage({ type: 'analyzeDiff', path: p });
            }
            else if (action === 'approveAll') {
                // Collapse the file once the user has approved everything in it —
                // signals "done with this one" and clears space for the next file.
                expandedFiles.delete(p);
                fileActionStatus.set(p, 'approved');
                pendingScrollPath = null;
                vscode.postMessage({ type: 'approveAllInFile', path: p });
            }
            return;
        }

        if (target.closest('.file-header')) {
            // Don't toggle when clicking the drag-grip — that's GridStack's
            // drag handle, and a stray collapse here would also break the cell
            // height the user just set.
            if (target.closest('.grid-drag-handle')) return;
            const expanded = fileEl.classList.toggle('expanded');
            if (expanded) expandedFiles.add(p); else expandedFiles.delete(p);
        }
    };
    contentEl.addEventListener('click', onContentClick);

    document.getElementById('expand-all').addEventListener('click', () => {
        for (const f of contentEl.querySelectorAll('.file')) {
            f.classList.add('expanded');
            expandedFiles.add(f.getAttribute('data-path'));
        }
    });
    document.getElementById('collapse-all').addEventListener('click', () => {
        for (const f of contentEl.querySelectorAll('.file')) f.classList.remove('expanded');
        expandedFiles.clear();
    });
    toggleBtn.addEventListener('click', () => {
        allHidden = !allHidden;
        contentEl.style.display = allHidden ? 'none' : '';
        toggleBtn.textContent = allHidden ? 'Show All' : 'Hide All';
    });
    document.getElementById('refresh').addEventListener('click', () => {
        vscode.postMessage({ type: 'refresh' });
    });
    searchEl.addEventListener('input', applySearchFilter);

    let draftSaveTimer = null;
    commitMsgEl.addEventListener('input', () => {
        if (draftSaveTimer) clearTimeout(draftSaveTimer);
        draftSaveTimer = setTimeout(() => {
            vscode.postMessage({ type: 'saveDraft', draft: commitMsgEl.value });
        }, 400);
    });
    // Cmd/Ctrl+Enter → Commit Staged. Cmd/Ctrl+Shift+Enter → Push.
    // When set, the next successful commitMessageGenerated will auto-fire
    // stage+commit+push without a second keystroke. Cmd+Enter on an empty
    // textarea sets this so "generate then ship" is one user action.
    let autoShipAfterGenerate = false;
    function shipIt() {
        commitBtn.disabled = true;
        commitPushBtn.disabled = true;
        setCommitStatus('Staging, committing, pushing…', null);
        vscode.postMessage({
            type: 'commit',
            message: commitMsgEl.value,
            amend: !!amendEl.checked,
            stageAll: true,
            push: true,
        });
    }
    commitMsgEl.addEventListener('keydown', (e) => {
        if (!((e.metaKey || e.ctrlKey) && e.key === 'Enter')) return;
        e.preventDefault();
        // Cmd+Shift+Enter — push-only legacy shortcut (after committing in UI).
        if (e.shiftKey) { commitPushBtn.click(); return; }
        const message = commitMsgEl.value.trim();
        if (!message) {
            // Empty → generate AND auto-ship when the message lands.
            const genBtn = document.getElementById('commit-generate');
            if (genBtn) {
                autoShipAfterGenerate = true;
                setCommitStatus('Generating message…', null);
                genBtn.click();
            }
            return;
        }
        // Has text → ship-it path: stage all + commit + push in one shot.
        shipIt();
    });

    function setCommitStatus(text, kind) {
        commitStatusEl.textContent = text || '';
        commitStatusEl.classList.remove('ok', 'error');
        if (kind) commitStatusEl.classList.add(kind);
    }

    function doCommit() {
        const message = commitMsgEl.value;
        const amend = !!amendEl.checked;
        if (!message.trim() && !amend) {
            setCommitStatus('Enter a commit message.', 'error');
            commitMsgEl.focus();
            return;
        }
        commitBtn.disabled = true;
        commitPushBtn.disabled = true;
        setCommitStatus('Committing…', null);
        vscode.postMessage({ type: 'commit', message, amend, stageAll: false, push: false });
    }
    commitBtn.addEventListener('click', () => doCommit());
    commitPushBtn.addEventListener('click', () => {
        commitPushBtn.disabled = true;
        commitBtn.disabled = true;
        setCommitStatus('Pushing…', null);
        vscode.postMessage({ type: 'pushOnly' });
    });

    const stageAllBtn = document.getElementById('stage-all-only-btn');
    if (stageAllBtn) {
        stageAllBtn.addEventListener('click', () => {
            stageAllBtn.disabled = true;
            setCommitStatus('Staging all…', null);
            vscode.postMessage({ type: 'stageAll' });
            setTimeout(() => {
                stageAllBtn.disabled = false;
                setCommitStatus('✓ All staged', 'ok');
                setTimeout(() => setCommitStatus(''), 2500);
            }, 250);
        });
    }

    // ---- Generate commit message via OpenRouter ----
    const generateBtn = document.getElementById('commit-generate');
    const keyToggleBtn = document.getElementById('commit-key-toggle');
    const keyRowEl = document.getElementById('commit-key-row');
    const keyInputEl = document.getElementById('commit-key-input');
    const keySaveBtn = document.getElementById('commit-key-save');
    const keyClearBtn = document.getElementById('commit-key-clear');
    const keySettingsBtn = document.getElementById('commit-key-settings');
    const keyStatusEl = document.getElementById('commit-key-status');

    function setKeyStatus(text, kind) {
        if (!keyStatusEl) return;
        keyStatusEl.textContent = text || '';
        keyStatusEl.classList.remove('ok', 'error');
        if (kind) keyStatusEl.classList.add(kind);
    }
    function showKeyRow(show) {
        keyRowEl.style.display = show ? 'flex' : 'none';
        if (show) setTimeout(() => keyInputEl.focus(), 0);
    }
    keyToggleBtn.addEventListener('click', () => {
        showKeyRow(keyRowEl.style.display === 'none');
    });
    keySaveBtn.addEventListener('click', () => {
        const k = (keyInputEl.value || '').trim();
        if (!k) {
            setKeyStatus('Paste your key first', 'error');
            keyInputEl.focus();
            return;
        }
        keySaveBtn.disabled = true;
        setKeyStatus('Saving to settings…', null);
        // Don't clear input until we hear back — otherwise a failed save loses
        // the key the user just typed.
        vscode.postMessage({ type: 'setOpenRouterKey', key: k });
    });
    keyClearBtn.addEventListener('click', () => {
        keyInputEl.value = '';
        setKeyStatus('Clearing…', null);
        vscode.postMessage({ type: 'setOpenRouterKey', key: '' });
    });
    keySettingsBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openOpenRouterSettings' });
    });
    keyInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); keySaveBtn.click(); }
        if (e.key === 'Escape') { e.preventDefault(); showKeyRow(false); }
    });

    generateBtn.addEventListener('click', () => {
        generateBtn.disabled = true;
        const original = generateBtn.textContent;
        generateBtn.textContent = '⌛';
        generateBtn.title = 'Generating…';
        setCommitStatus('Asking model…', null);
        vscode.postMessage({ type: 'generateCommitMessage' });
        generateBtn.dataset.originalLabel = original;
        generateBtn.dataset.originalTitle = 'Generate commit message from diff (OpenRouter model, configurable)';
    });

    // Ask the extension whether a key is configured on startup.
    vscode.postMessage({ type: 'getOpenRouterKeyStatus' });

    hiddenPillEl.addEventListener('click', () => {
        hiddenListEl.classList.toggle('open');
    });
    document.getElementById('close-hidden-btn').addEventListener('click', () => {
        hiddenListEl.classList.remove('open');
    });
    document.getElementById('unhide-all-btn').addEventListener('click', () => {
        vscode.postMessage({ type: 'unhideAll' });
    });
    hiddenRowsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-unhide]');
        if (!btn) return;
        vscode.postMessage({ type: 'unhideFile', path: btn.getAttribute('data-unhide') });
    });

    // ---- Send to AI dialog ----
    const aiDialogEl = document.getElementById('ai-dialog');
    const aiTitleEl = document.getElementById('ai-dialog-title');
    const aiTargetEl = document.getElementById('ai-target');
    const aiMessageEl = document.getElementById('ai-message');
    const aiSendBtn = document.getElementById('ai-send');
    const aiCancelBtn = document.getElementById('ai-cancel');
    const AI_DEFAULT_INTRO = 'fix these issues as listed in the diff comments below:\\n\\n';

    function buildAiPrompt(filePath) {
        const change = lastChanges.find(c => c.path === filePath);
        let body = buildFileReviewMarkdown(filePath);
        if (!body) {
            // No comments — fall back to the file's full diff so the AI has context.
            body = '## ' + filePath + '\\n\\n\\\`\\\`\\\`diff\\n' + (change && change.diff || '(no diff)') + '\\n\\\`\\\`\\\`\\n';
        }
        return AI_DEFAULT_INTRO + body;
    }

    function openAiDialog(filePath) {
        aiTitleEl.textContent = 'Send to AI — ' + filePath;
        aiMessageEl.value = buildAiPrompt(filePath);
        aiDialogEl.classList.add('open');
        // Persist target choice across opens within the session.
        try {
            const saved = sessionStorage && sessionStorage.getItem('gdv.aiTarget');
            if (saved) aiTargetEl.value = saved;
        } catch (e) { /* ignore */ }
        setTimeout(() => aiMessageEl.focus(), 0);
    }
    function closeAiDialog() { aiDialogEl.classList.remove('open'); }
    aiCancelBtn.addEventListener('click', closeAiDialog);
    aiDialogEl.addEventListener('click', (e) => {
        if (e.target === aiDialogEl) closeAiDialog();
    });
    aiSendBtn.addEventListener('click', () => {
        const target = aiTargetEl.value;
        const message = aiMessageEl.value.trim();
        if (!message) { aiMessageEl.focus(); return; }
        try { sessionStorage.setItem('gdv.aiTarget', target); } catch (e) { /* ignore */ }
        vscode.postMessage({ type: 'sendToAi', target, message });
        closeAiDialog();
    });
    aiMessageEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); closeAiDialog(); }
        else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); aiSendBtn.click(); }
    });

    autoExpandCb.addEventListener('change', () => {
        autoExpandRecent = autoExpandCb.checked;
        autoExpandToggle.classList.toggle('active', autoExpandRecent);
        vscode.postMessage({ type: 'setAutoExpandRecent', value: autoExpandRecent });
        vscode.postMessage({ type: 'refresh' });
    });

    // Cmd+Enter saves the in-progress comment.
    contentEl.addEventListener('keydown', (e) => {
        if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
        const ta = e.target;
        if (!(ta instanceof HTMLTextAreaElement)) return;
        const role = ta.getAttribute('data-role');
        if (role === 'new-input' || role === 'edit-input') {
            e.preventDefault();
            const block = ta.closest('.comment-block');
            const btn = block && block.querySelector(\`button[data-c-action="\${role === 'new-input' ? 'save-new' : 'save-edit'}"]\`);
            if (btn) btn.click();
        }
    });

    // CSS Custom Highlight API — shared by find-bar + selection word-match.
    const supportsHighlights = typeof window.Highlight !== 'undefined' && CSS.highlights;

    // ---- Cmd/Ctrl + F find bar ----
    const findBarEl = document.getElementById('find-bar');
    const findInputEl = document.getElementById('find-input');
    const findCountEl = document.getElementById('find-count');
    const findPrevBtn = document.getElementById('find-prev');
    const findNextBtn = document.getElementById('find-next');
    const findCloseBtn = document.getElementById('find-close');
    const findCaseEl = document.getElementById('find-case');
    const findCaseCb = document.getElementById('find-case-cb');

    const findMatchHl = supportsHighlights ? new window.Highlight() : null;
    const findCurrentHl = supportsHighlights ? new window.Highlight() : null;
    if (findMatchHl) CSS.highlights.set('find-match', findMatchHl);
    if (findCurrentHl) CSS.highlights.set('find-match-current', findCurrentHl);
    let findRanges = [];
    let findCurrentIdx = -1;
    let findRebuildTimer = null;

    function setFindCount(text, isError) {
        findCountEl.textContent = text;
        findCountEl.classList.toggle('error', !!isError);
    }

    function rebuildFindMatches() {
        if (findMatchHl) findMatchHl.clear();
        if (findCurrentHl) findCurrentHl.clear();
        findRanges = [];
        findCurrentIdx = -1;
        const term = (findInputEl.value || '');
        if (!term) {
            setFindCount('0 / 0');
            return;
        }
        const caseSensitive = !!findCaseCb.checked;
        const cmpTerm = caseSensitive ? term : term.toLowerCase();
        const MAX = 5000;
        const cells = contentEl.querySelectorAll('.diff-table td.code');
        for (const cell of cells) {
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
            let node;
            while ((node = walker.nextNode())) {
                const v = node.nodeValue;
                if (!v) continue;
                const hay = caseSensitive ? v : v.toLowerCase();
                let idx = 0;
                while (true) {
                    const f = hay.indexOf(cmpTerm, idx);
                    if (f === -1) break;
                    try {
                        const r = new Range();
                        r.setStart(node, f);
                        r.setEnd(node, f + term.length);
                        findRanges.push(r);
                        if (findMatchHl) findMatchHl.add(r);
                    } catch (e) { /* ignore */ }
                    if (findRanges.length >= MAX) break;
                    idx = f + term.length;
                }
                if (findRanges.length >= MAX) break;
            }
            if (findRanges.length >= MAX) break;
        }
        if (findRanges.length === 0) {
            setFindCount('No results', true);
        } else {
            setFindCount('1 / ' + findRanges.length);
            findCurrentIdx = 0;
            highlightCurrent(true);
        }
    }

    function highlightCurrent(scroll) {
        if (findCurrentHl) findCurrentHl.clear();
        if (findCurrentIdx < 0 || findCurrentIdx >= findRanges.length) return;
        const range = findRanges[findCurrentIdx];
        if (findCurrentHl) findCurrentHl.add(range);
        setFindCount((findCurrentIdx + 1) + ' / ' + findRanges.length);
        if (scroll) {
            const startNode = range.startContainer;
            const elem = startNode.nodeType === 1 ? startNode : startNode.parentElement;
            if (elem && elem.scrollIntoView) {
                // Make sure containing file is expanded so the row is visible.
                const fileEl = elem.closest('.file');
                if (fileEl && !fileEl.classList.contains('expanded')) {
                    fileEl.classList.add('expanded');
                    const p = fileEl.getAttribute('data-path');
                    if (p) expandedFiles.add(p);
                }
                requestAnimationFrame(() => elem.scrollIntoView({ behavior: 'smooth', block: 'center' }));
            }
        }
    }

    function findStep(direction) {
        if (findRanges.length === 0) return;
        findCurrentIdx = (findCurrentIdx + direction + findRanges.length) % findRanges.length;
        highlightCurrent(true);
    }

    function openFindBar(initial) {
        findBarEl.classList.add('open');
        if (typeof initial === 'string' && initial) findInputEl.value = initial;
        findInputEl.focus();
        findInputEl.select();
        rebuildFindMatches();
    }
    function closeFindBar() {
        findBarEl.classList.remove('open');
        if (findMatchHl) findMatchHl.clear();
        if (findCurrentHl) findCurrentHl.clear();
        findRanges = [];
        findCurrentIdx = -1;
    }

    findInputEl.addEventListener('input', () => {
        if (findRebuildTimer) clearTimeout(findRebuildTimer);
        findRebuildTimer = setTimeout(rebuildFindMatches, 100);
    });
    findInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            findStep(e.shiftKey ? -1 : 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeFindBar();
        }
    });
    findCaseCb.addEventListener('change', () => {
        findCaseEl.classList.toggle('active', findCaseCb.checked);
        rebuildFindMatches();
    });
    findPrevBtn.addEventListener('click', () => findStep(-1));
    findNextBtn.addEventListener('click', () => findStep(1));
    findCloseBtn.addEventListener('click', closeFindBar);

    // Alt+ArrowUp / Alt+ArrowDown — jump to previous / next hunk across the
    // whole panel (per-file Prev/Next buttons stay scoped to the file). Skip
    // when typing in any input so the keys don't fight the comment composer.
    document.addEventListener('keydown', (e) => {
        if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const t = e.target;
        if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) return;
        e.preventDefault();
        scrollHunk(e.key === 'ArrowDown' ? 1 : -1, null);
    });

    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.key.toLowerCase() !== 'f') return;
        // Allow native browser find inside textareas/inputs (e.g., comment composer).
        const t = e.target;
        if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) {
            // But still allow our find bar if user is in OUR find input.
            if (t === findInputEl) return;
            return;
        }
        e.preventDefault();
        const sel = window.getSelection();
        const selText = sel ? sel.toString() : '';
        const useSel = selText && !selText.includes('\\n') && selText.length < 200;
        openFindBar(useSel ? selText : (findInputEl.value || ''));
    });

    // ---- Word-match selection highlighting (CSS Custom Highlight API) ----
    const wordHl = supportsHighlights ? new window.Highlight() : null;
    if (wordHl) CSS.highlights.set('word-match', wordHl);
    let wordHlTimer = null;

    function updateWordMatches() {
        if (!wordHl) return;
        const sel = window.getSelection();
        wordHl.clear();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
        const text = sel.toString();
        if (!text || text.length < 2 || text.length > 200) return;
        if (/[\\n\\r]/.test(text)) return;
        if (text !== text.trim()) return; // ignore whitespace-only / padded
        // Limit search to code cells inside the diff (skip toolbar / comments).
        const cells = contentEl.querySelectorAll('.diff-table td.code');
        let added = 0;
        const MAX_MATCHES = 1000;
        for (const cell of cells) {
            if (added >= MAX_MATCHES) break;
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
            let node;
            while ((node = walker.nextNode())) {
                const v = node.nodeValue;
                if (!v) continue;
                let idx = 0;
                while (true) {
                    const found = v.indexOf(text, idx);
                    if (found === -1) break;
                    try {
                        const r = new Range();
                        r.setStart(node, found);
                        r.setEnd(node, found + text.length);
                        wordHl.add(r);
                        added++;
                    } catch (e) { /* ignore */ }
                    if (added >= MAX_MATCHES) break;
                    idx = found + text.length;
                }
                if (added >= MAX_MATCHES) break;
            }
        }
    }
    document.addEventListener('selectionchange', () => {
        if (wordHlTimer) clearTimeout(wordHlTimer);
        wordHlTimer = setTimeout(updateWordMatches, 90);
    });

    // ---- Ctrl/Cmd + D: jump to next matching occurrence in the diffs ----
    let lastFindTerm = '';
    let lastFindIndex = -1;
    let findStatusTimer = null;
    const findStatusEl = document.getElementById('find-status');

    function showFindStatus(text) {
        if (!findStatusEl) return;
        findStatusEl.textContent = text;
        findStatusEl.classList.add('show');
        if (findStatusTimer) clearTimeout(findStatusTimer);
        findStatusTimer = setTimeout(() => findStatusEl.classList.remove('show'), 1500);
    }

    function findAndScrollNext(term, direction, scopeEl) {
        if (!term) return;
        // Search scope: the file the user is currently in (where Ctrl+D was
        // pressed). Falls back to the whole panel if no scope was passed
        // (e.g., repeat-press without a fresh selection in a file).
        const root = scopeEl || contentEl;
        const cells = Array.from(root.querySelectorAll('.diff-table td.code'));
        const matches = [];
        for (const cell of cells) {
            const text = cell.textContent || '';
            if (text.includes(term)) matches.push(cell);
        }
        if (matches.length === 0) {
            const fileName = scopeEl ? scopeEl.getAttribute('data-path') : '';
            showFindStatus(\`"\${term.length > 30 ? term.slice(0, 30) + '…' : term}" — no matches\${fileName ? ' in ' + fileName : ''}\`);
            return;
        }
        if (term !== lastFindTerm) {
            lastFindTerm = term;
            lastFindIndex = direction > 0 ? -1 : matches.length;
        }
        lastFindIndex = (lastFindIndex + direction + matches.length) % matches.length;
        const cell = matches[lastFindIndex];
        const fileEl = cell.closest('.file');
        if (fileEl && !fileEl.classList.contains('expanded')) {
            fileEl.classList.add('expanded');
            const p = fileEl.getAttribute('data-path');
            if (p) expandedFiles.add(p);
        }
        // Wait one frame so the now-expanded file lays out before we scroll.
        requestAnimationFrame(() => {
            cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cell.classList.remove('find-flash');
            // re-trigger animation
            void cell.offsetWidth;
            cell.classList.add('find-flash');
            setTimeout(() => cell.classList.remove('find-flash'), 1600);
        });
        showFindStatus(\`\${lastFindIndex + 1} / \${matches.length} — \${term.length > 30 ? term.slice(0, 30) + '…' : term}\`);
    }

    let lastFindScopeEl = null;
    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'd') return;
        const t = e.target;
        if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) return;
        e.preventDefault();

        // Determine which file the user pressed Ctrl+D in. Prefer the file
        // containing the current selection; fall back to the file containing
        // the focused element; fall back to the previously-used scope so
        // repeated Ctrl+D cycles through matches in the same file.
        let scopeEl = null;
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const node = sel.anchorNode;
            const elem = node && (node.nodeType === 1 ? node : node.parentElement);
            if (elem && elem.closest) scopeEl = elem.closest('.file');
        }
        if (!scopeEl && t && t.closest) scopeEl = t.closest('.file');
        if (!scopeEl) scopeEl = lastFindScopeEl;

        let term = sel ? sel.toString() : '';
        if (!term || !term.trim()) term = lastFindTerm;
        if (!term) {
            showFindStatus('Select text first, then ⌘/Ctrl+D');
            return;
        }
        // If we got a fresh selection, lock the scope to the file it's in.
        if (scopeEl) lastFindScopeEl = scopeEl;
        findAndScrollNext(term, e.shiftKey ? -1 : 1, lastFindScopeEl);
    });

    // Alt + wheel on a file body cycles its context level.
    let altWheelCooldown = 0;
    contentEl.addEventListener('wheel', (e) => {
        if (!e.altKey) return;
        const fileEl = e.target.closest('.file');
        if (!fileEl) return;
        e.preventDefault();
        const now = performance.now();
        if (now - altWheelCooldown < 220) return;
        altWheelCooldown = now;
        const cur = parseInt(fileEl.getAttribute('data-context') || '3', 10);
        const idx = CONTEXT_CYCLE.indexOf(cur);
        const direction = e.deltaY < 0 ? 1 : -1; // scroll up = more context
        const safeIdx = idx === -1 ? 0 : idx;
        const nextIdx = Math.max(0, Math.min(CONTEXT_CYCLE.length - 1, safeIdx + direction));
        const next = CONTEXT_CYCLE[nextIdx];
        if (next === cur) return;
        fileEl.setAttribute('data-context', String(next));
        const btn = fileEl.querySelector('button[data-action="cycleContext"]');
        if (btn) btn.textContent = 'Context: ' + (CONTEXT_LABELS[next] || next) + '…';
        vscode.postMessage({
            type: 'setContext',
            path: fileEl.getAttribute('data-path'),
            context: next,
        });
    }, { passive: false });

    // ---- markdown copy builders ----

    function getDiffRowsForFile(filePath) {
        // Flatten all sections+hunks into a single ordered list of pair rows + section markers.
        const change = lastChanges.find(c => c.path === filePath);
        if (!change) return null;
        const sections = parseDiff(change.diff || '');
        const all = [];
        for (const sec of sections) {
            if (sec.binary) continue;
            for (const hunk of sec.hunks) {
                const pairs = pairRows(hunk);
                pairs.forEach(p => all.push({
                    section: sec.title || (change.staged ? 'Staged' : 'Unstaged'),
                    pair: p,
                }));
            }
        }
        return { change, rows: all };
    }

    function findRowIndexForComment(rows, comment) {
        let bestIdx = -1;
        let bestDist = Infinity;
        rows.forEach((entry, i) => {
            const p = entry.pair;
            const text = comment.side === 'right' ? p.rightText : p.leftText;
            const num = comment.side === 'right' ? p.rightNum : p.leftNum;
            if (comment.side === 'right' && p.rightKind === 'empty') return;
            if (comment.side === 'left' && p.leftKind === 'empty') return;
            const exact = comment.lineText && comment.lineText === text;
            const matchByNum = Number(num) === Number(comment.lineNum);
            if (exact) {
                const dist = Math.abs((num || 0) - comment.lineNum);
                if (dist < bestDist) { bestDist = dist; bestIdx = i; }
            } else if (matchByNum && bestIdx === -1) {
                bestIdx = i;
            }
        });
        return bestIdx;
    }

    function pairToDiffLine(pair, side) {
        if (side === 'left') {
            if (pair.leftKind === 'empty') return null;
            const prefix = pair.leftKind === 'del' ? '-' : ' ';
            return { num: pair.leftNum, text: prefix + pair.leftText, kind: pair.leftKind };
        } else {
            if (pair.rightKind === 'empty') return null;
            const prefix = pair.rightKind === 'add' ? '+' : ' ';
            return { num: pair.rightNum, text: prefix + pair.rightText, kind: pair.rightKind };
        }
    }

    function fenceLang(lang) {
        return lang || '';
    }

    function buildSnippetForRange(rows, fromIdx, toIdx, side, lang) {
        const lines = [];
        const startNum = (() => {
            for (let i = fromIdx; i <= toIdx; i++) {
                const ln = pairToDiffLine(rows[i].pair, side);
                if (ln && ln.num) return ln.num;
            }
            return null;
        })();
        const endNum = (() => {
            for (let i = toIdx; i >= fromIdx; i--) {
                const ln = pairToDiffLine(rows[i].pair, side);
                if (ln && ln.num) return ln.num;
            }
            return null;
        })();
        for (let i = fromIdx; i <= toIdx; i++) {
            const ln = pairToDiffLine(rows[i].pair, side);
            if (ln) lines.push(ln.text);
        }
        const header = startNum && endNum
            ? \`\\n_Lines \${startNum}–\${endNum} (\${side === 'right' ? 'after' : 'before'} change)_\\n\`
            : '';
        return \`\${header}\\n\\\`\\\`\\\`diff\\n\${lines.join('\\n')}\\n\\\`\\\`\\\`\`;
    }

    function buildSingleCommentMarkdown(filePath, commentId) {
        const comment = allComments.find(c => c.id === commentId);
        if (!comment) return '';
        const data = getDiffRowsForFile(filePath);
        if (!data) return '';
        const idx = findRowIndexForComment(data.rows, comment);
        if (idx === -1) {
            // Comment line is not in any visible hunk — copy comment alone.
            return \`### Comment on \${filePath} (line \${comment.lineNum} \${comment.side})\\n\\n\${comment.body}\\n\`;
        }
        const from = Math.max(0, idx - COPY_CONTEXT_LINES);
        const to = Math.min(data.rows.length - 1, idx + COPY_CONTEXT_LINES);
        const snippet = buildSnippetForRange(data.rows, from, to, comment.side, data.change.language);
        return \`### \${filePath}\\n\${snippet}\\n\\n**Comment:** \${comment.body}\\n\`;
    }

    function buildFileReviewMarkdown(filePath) {
        const data = getDiffRowsForFile(filePath);
        if (!data) return '';
        const fileComments = allComments
            .filter(c => c.file === filePath)
            .map(c => ({ comment: c, idx: findRowIndexForComment(data.rows, c) }))
            .filter(x => x.idx !== -1)
            .sort((a, b) => a.idx - b.idx);
        if (fileComments.length === 0) return '';

        // Merge overlapping windows into ranges.
        const ranges = [];
        for (const { comment, idx } of fileComments) {
            const from = Math.max(0, idx - COPY_CONTEXT_LINES);
            const to = Math.min(data.rows.length - 1, idx + COPY_CONTEXT_LINES);
            const last = ranges[ranges.length - 1];
            if (last && from <= last.to + 1 && comment.side === last.side) {
                last.to = Math.max(last.to, to);
                last.comments.push({ comment, idx });
            } else {
                ranges.push({ from, to, side: comment.side, comments: [{ comment, idx }] });
            }
        }

        const parts = [\`## Review of \${filePath}\`];
        for (const r of ranges) {
            parts.push(buildSnippetForRange(data.rows, r.from, r.to, r.side, data.change.language));
            for (const { comment } of r.comments) {
                parts.push(\`**Comment on \${comment.side === 'right' ? '+' : '-'}line \${comment.lineNum}:** \${comment.body}\`);
            }
        }
        return parts.join('\\n\\n') + '\\n';
    }

    function expandFileEl(fileEl) {
        if (!fileEl) return;
        if (!fileEl.classList.contains('expanded')) {
            fileEl.classList.add('expanded');
            const p = fileEl.getAttribute('data-path');
            if (p) expandedFiles.add(p);
        }
    }

    function findNextHunkButton(targetPath) {
        const allFiles = Array.from(contentEl.querySelectorAll('.file'));
        const targetEl = contentEl.querySelector(\`.file[data-path="\${CSS.escape(targetPath)}"]\`);
        const startIdx = targetEl ? allFiles.indexOf(targetEl) : -1;
        const SELECTOR = 'button[data-hunk-action="approve"], button[data-hunk-action="reject"]';

        // 1. Same file — most common case (next remaining hunk).
        if (targetEl) {
            expandFileEl(targetEl);
            const btn = targetEl.querySelector(SELECTOR);
            if (btn) return btn;
        }
        // 2. Files AFTER the target in document order.
        for (let i = startIdx + 1; i < allFiles.length; i++) {
            const f = allFiles[i];
            const btn = f.querySelector(SELECTOR);
            if (btn) {
                expandFileEl(f);
                // querySelector ran before expanding, so re-query inside the
                // newly-expanded file to make sure we return a layout-able node.
                return f.querySelector(SELECTOR) || btn;
            }
        }
        // 3. Wrap around — files BEFORE the target.
        for (let i = 0; i < startIdx; i++) {
            const f = allFiles[i];
            const btn = f.querySelector(SELECTOR);
            if (btn) {
                expandFileEl(f);
                return f.querySelector(SELECTOR) || btn;
            }
        }
        return null;
    }

    function maybeScrollToNextHunkAction() {
        if (!pendingScrollPath) return;
        const target = pendingScrollPath;
        pendingScrollPath = null;

        const btn = findNextHunkButton(target);
        if (!btn) return;

        // Wait a tick so any newly-expanded file body finishes laying out before
        // the scroll calculation kicks in. Two rAFs > one because some browsers
        // commit layout on the second frame after style changes.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }));
    }

    function applyEditorConfig(e) {
        if (!e) return;
        const FALLBACK = "ui-monospace, 'SF Mono', 'SFMono-Regular', Menlo, Monaco, 'Cascadia Mono', 'Cascadia Code', Consolas, 'Liberation Mono', 'DejaVu Sans Mono', 'Courier New', monospace";
        const userFont = (e.fontFamily || '').trim();
        const monoStack = userFont ? userFont + ', ' + FALLBACK : FALLBACK;
        const fontSize = (Number.isFinite(e.fontSize) && e.fontSize > 0) ? e.fontSize : 14;
        const lh = e.lineHeight > 0
            ? (e.lineHeight < 8 ? String(e.lineHeight) : e.lineHeight + 'px')
            : '1.5';
        const tabSize = (Number.isFinite(e.tabSize) && e.tabSize > 0) ? e.tabSize : 4;
        const root = document.documentElement;
        root.style.setProperty('--diff-mono', monoStack);
        root.style.setProperty('--editor-font-size', fontSize + 'px');
        root.style.setProperty('--editor-line-height', lh);
        root.style.setProperty('--editor-tab-size', String(tabSize));
    }

    // === Architect Doc — async change review fed by the extension host ===
    const archDocEl = document.getElementById('arch-doc');
    const archBarEl = document.getElementById('arch-bar');
    const archCaretEl = document.getElementById('arch-caret');
    const archTldrEl = document.getElementById('arch-tldr');
    const archStatusEl = document.getElementById('arch-status');
    const archBodyEl = document.getElementById('arch-body');
    const archOverviewEl = document.getElementById('arch-overview');
    const archFilesEl = document.getElementById('arch-files');
    const archStaticEl = document.getElementById('arch-static');
    const archRerunBtn = document.getElementById('arch-rerun');
    const archCancelBtn = document.getElementById('arch-cancel');
    let archExpanded = false;
    let archFiles = new Map();

    function archSetStatus(text, kind) {
        archStatusEl.textContent = text || '';
        archStatusEl.className = 'arch-status' + (kind === 'error' ? ' error' : '');
    }
    function archToggle(open) {
        archExpanded = open === undefined ? !archExpanded : open;
        archBodyEl.style.display = archExpanded ? 'block' : 'none';
        archCaretEl.textContent = archExpanded ? '▾' : '▸';
        archBarEl.setAttribute('aria-expanded', archExpanded ? 'true' : 'false');
    }
    if (archBarEl) {
        archBarEl.addEventListener('click', (e) => {
            if (e.target === archRerunBtn || e.target === archCancelBtn) return;
            archToggle();
        });
        archRerunBtn.addEventListener('click', () => {
            archSetStatus('restarting…');
            vscode.postMessage({ type: 'archDocRun' });
        });
        archCancelBtn.addEventListener('click', () => vscode.postMessage({ type: 'archDocCancel' }));
    }
    function archRiskRank(r) { return r === 'high' ? 0 : r === 'medium' ? 1 : r === 'unknown' ? 2 : 3; }
    function archRenderFiles() {
        const rows = Array.from(archFiles.entries())
            .sort((a, b) => archRiskRank(a[1].risk) - archRiskRank(b[1].risk) || a[0].localeCompare(b[0]));
        archFilesEl.innerHTML = rows.map(([p, r]) => {
            const flags = (r.flags && r.flags.length) ? ' <span class="flags">⚑ ' + escapeHtml(r.flags.join(' · ')) + '</span>' : '';
            const sum = r.error ? '⚠ ' + escapeHtml(r.error) : escapeHtml(r.summary || '');
            return '<div class="arch-file-row risk-' + escapeHtml(r.risk || 'unknown') + '" data-path="' + escapeHtml(p) + '" title="Jump to diff">'
                + '<span class="risk-dot"></span><span class="p">' + escapeHtml(p) + '</span>'
                + '<span class="s">' + sum + flags + '</span></div>';
        }).join('');
    }
    if (archFilesEl) {
        archFilesEl.addEventListener('click', (e) => {
            const row = e.target.closest('.arch-file-row');
            if (!row) return;
            const p = row.getAttribute('data-path');
            if (mapActive && window.GitMap && window.GitMap.flyToPath) {
                window.GitMap.flyToPath(p);
                return;
            }
            const fileEl = contentEl.querySelector('.file[data-path="' + CSS.escape(p) + '"]');
            if (!fileEl) return;
            if (!fileEl.classList.contains('expanded')) {
                const header = fileEl.querySelector('.file-header');
                if (header) header.click();
            }
            fileEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
    // One-line AI note in each file panel header — inserted via DOM so the
    // renderFile template stays untouched; re-applied after every re-render.
    function archApplyNote(p) {
        const r = archFiles.get(p);
        if (!r) return;
        const header = contentEl.querySelector('.file[data-path="' + CSS.escape(p) + '"] .file-header');
        if (!header) return;
        let note = header.querySelector('.arch-note');
        if (!note) {
            note = document.createElement('span');
            const stats = header.querySelector('.stats');
            if (stats && stats.parentNode) stats.parentNode.insertBefore(note, stats.nextSibling);
            else header.appendChild(note);
        }
        const icon = r.risk === 'high' ? '🔴 ' : r.risk === 'medium' ? '🟡 ' : r.risk === 'unknown' ? '⚪ ' : '🟢 ';
        note.className = 'arch-note risk-' + (r.risk || 'unknown');
        note.textContent = r.summary ? icon + r.summary : (r.error ? '⚠ analysis failed' : '');
        note.title = (r.summary || '') + ((r.flags && r.flags.length) ? '\\nFlags: ' + r.flags.join('; ') : '');
    }
    function archApplyAllNotes() { for (const p of archFiles.keys()) archApplyNote(p); }
    function archRenderStatic(msg) {
        if (!archStaticEl) return;
        if (msg.skipped) { archStaticEl.innerHTML = ''; return; }
        if (!msg.installed) {
            archStaticEl.innerHTML = '<em>fallow not installed — local static analysis skipped. Install: <code>npm i -g fallow</code> (or set gitDiffViewer.fallowPath).</em>';
            return;
        }
        if (!msg.ok) {
            archStaticEl.innerHTML = '<em>fallow: ' + escapeHtml(msg.error || 'failed') + '</em>';
            return;
        }
        const rep = msg.report || {};
        const verdict = String(rep.verdict || '').toLowerCase();
        const vCls = verdict === 'pass' ? 'verdict-pass' : verdict === 'warn' ? 'verdict-warn' : verdict ? 'verdict-fail' : '';
        const issues = Array.isArray(rep.issues) ? rep.issues : [];
        let html = '<strong>fallow static analysis</strong>'
            + (verdict ? ' — <span class="' + vCls + '">' + escapeHtml(verdict) + '</span>' : '');
        if (!issues.length) {
            html += ' · no issues on changed files';
        } else {
            html += ' · ' + issues.length + ' issue' + (issues.length === 1 ? '' : 's') + '<ul>'
                + issues.slice(0, 20).map(it => {
                    const loc = it.file ? escapeHtml(String(it.file)) + (it.line ? ':' + escapeHtml(String(it.line)) : '') : '';
                    const kind = escapeHtml(String(it.rule || it.kind || it.category || ''));
                    const m = escapeHtml(String(it.message || it.title || it.summary || JSON.stringify(it).slice(0, 120)));
                    return '<li><code>' + loc + '</code> ' + (kind ? '[' + kind + '] ' : '') + m + '</li>';
                }).join('')
                + (issues.length > 20 ? '<li>… ' + (issues.length - 20) + ' more</li>' : '')
                + '</ul>';
        }
        archStaticEl.innerHTML = html;
    }
    // === Code Map glue — renderer lives in the module script (window.GitMap);
    // this side owns vscode messaging, view switching, and jump-to-diff. ===
    const mapToggleBtn = document.getElementById('map-toggle');
    const mapViewEl = document.getElementById('map-view');
    const mapEmptyEl = document.getElementById('map-empty');
    const mapNoteEl = document.getElementById('map-note');
    const mapFilterEl = document.getElementById('map-filter');
    const mapUnrevCb = document.getElementById('map-unreviewed-cb');
    const mapChangedCb = document.getElementById('map-changed-cb');
    let mapActive = false;
    let pendingMapPayload = null;

    function mapJumpToDiff(p) {
        mapHidePanel();
        setMapActive(false);
        const fileEl = contentEl.querySelector('.file[data-path="' + CSS.escape(p) + '"]');
        if (!fileEl) return;
        if (!fileEl.classList.contains('expanded')) {
            const header = fileEl.querySelector('.file-header');
            if (header) header.click();
        }
        fileEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Anchored diff panel — the diff window that floats next to the clicked
    // sphere. Content is owned here; positioning is owned by map.js.
    const mapPanelEl = document.getElementById('map-panel');
    const mapPanelBody = document.getElementById('map-panel-body');
    const mapPanelPathEl = document.getElementById('map-panel-path');
    const mapPanelViewedBtn = document.getElementById('map-panel-viewed');
    const mapPanelGridBtn = document.getElementById('map-panel-grid');
    const mapPanelCloseBtn = document.getElementById('map-panel-close');
    const mapPanelNotesList = document.getElementById('map-panel-notes-list');
    const mapNoteInput = document.getElementById('map-note-input');
    const mapNoteSaveBtn = document.getElementById('map-note-save');
    const mapNoteAiBtn = document.getElementById('map-note-ai');
    let mapPanelCurrent = null;

    function updateMapPanelViewedBtn() {
        if (!mapPanelViewedBtn) return;
        const viewed = !!(mapPanelCurrent && window.GitMap && window.GitMap.isViewed && window.GitMap.isViewed(mapPanelCurrent));
        mapPanelViewedBtn.textContent = viewed ? '✓ Reviewed ·  unmark' : '✓ Mark reviewed';
    }

    // Notes list: every comment on the file (yours and the AI's) in one
    // strip under the diff. File-level notes are comments at line 0.
    function renderMapPanelNotes() {
        if (!mapPanelNotesList || !mapPanelCurrent) return;
        const notes = allComments.filter((c) => c.file === mapPanelCurrent);
        let html = '';
        for (const c of notes) {
            const line = c.lineNum > 0 ? 'L' + c.lineNum : 'file';
            const firstLine = String(c.body || '').split('\\n')[0].slice(0, 160);
            html += '<div class="mp-note' + (c.aiGenerated ? ' ai' : '') + '">'
                + '<span class="n-line">' + escapeHtml(line) + '</span>'
                + '<span class="n-body">' + escapeHtml(firstLine) + '</span>'
                + '<button class="n-del" data-note-id="' + escapeHtml(c.id) + '" title="Delete note">✕</button>'
                + '</div>';
        }
        mapPanelNotesList.innerHTML = html || '<div class="mp-note" style="opacity:.55">No notes yet — add one below; 🔍 sends them to the AI.</div>';
    }

    function mapHidePanel() {
        if (mapPanelEl) mapPanelEl.classList.remove('open');
        if (mapPanelBody) mapPanelBody.innerHTML = '';
        mapPanelCurrent = null;
        if (window.GitMap && window.GitMap.anchorPanel) window.GitMap.anchorPanel(null);
    }

    function mapShowPanel(p) {
        const change = lastChanges.find(c => c.path === p);
        if (!change) { mapJumpToDiff(p); return; }
        mapPanelCurrent = p;
        mapPanelBody.innerHTML = renderFile(change, true);
        const fileEl = mapPanelBody.querySelector('.file');
        if (fileEl) fileEl.classList.add('expanded');
        mapPanelPathEl.textContent = p;
        updateMapPanelViewedBtn();
        renderMapPanelNotes();
        syncMapNoteAiBtn();
        if (!mapPanelBody.dataset.wired) {
            // Same delegation as the grid — hunk approve/reject, comments,
            // stage/unstage all work inside the panel.
            mapPanelBody.addEventListener('click', onContentClick);
            mapPanelBody.dataset.wired = '1';
        }
        mapPanelEl.classList.add('open');
        if (window.GitMap && window.GitMap.anchorPanel) window.GitMap.anchorPanel(p);
    }

    // Re-render the open panel in place (comments changed, diff refreshed).
    function refreshMapPanel() {
        if (!mapPanelCurrent || !mapPanelEl || !mapPanelEl.classList.contains('open')) return;
        const p = mapPanelCurrent;
        const change = lastChanges.find(c => c.path === p);
        if (!change) { mapHidePanel(); return; }
        const scrollTop = mapPanelBody.scrollTop;
        // Keep half-typed inline comments alive across the swap — same
        // dance render()/replaceFile() do for the grid.
        const snaps = snapshotComposers(mapPanelBody);
        mapPanelBody.innerHTML = renderFile(change, true);
        const fileEl = mapPanelBody.querySelector('.file');
        if (fileEl) fileEl.classList.add('expanded');
        restoreComposers(mapPanelBody, snaps);
        mapPanelBody.scrollTop = scrollTop;
        updateMapPanelViewedBtn();
        renderMapPanelNotes();
    }

    if (mapPanelCloseBtn) mapPanelCloseBtn.addEventListener('click', () => {
        mapHidePanel();
        if (window.GitMap && window.GitMap.clearSelection) window.GitMap.clearSelection();
    });
    if (mapPanelGridBtn) mapPanelGridBtn.addEventListener('click', () => { if (mapPanelCurrent) mapJumpToDiff(mapPanelCurrent); });
    if (mapPanelViewedBtn) mapPanelViewedBtn.addEventListener('click', () => {
        if (mapPanelCurrent && window.GitMap && window.GitMap.toggleViewedPath) {
            window.GitMap.toggleViewedPath(mapPanelCurrent);
            updateMapPanelViewedBtn();
        }
    });
    if (mapPanelNotesList) mapPanelNotesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.n-del');
        if (btn) vscode.postMessage({ type: 'deleteComment', id: btn.getAttribute('data-note-id') });
    });
    function mapSaveNote() {
        if (!mapPanelCurrent || !mapNoteInput) return;
        const body = mapNoteInput.value.trim();
        if (!body) return;
        // File-level note = comment anchored at line 0; the host stores it
        // with the same machinery as inline comments and hands every
        // non-AI note to analyzeDiff as reviewer guidance.
        vscode.postMessage({ type: 'addComment', file: mapPanelCurrent, side: 'right', lineNum: 0, lineText: '', body });
        mapNoteInput.value = '';
    }
    if (mapNoteSaveBtn) mapNoteSaveBtn.addEventListener('click', mapSaveNote);
    if (mapNoteInput) mapNoteInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); mapSaveNote(); return; }
        // Escape must still leave the composer — swallow everything else so
        // single-letter map shortcuts don't fire while typing.
        if (e.key === 'Escape') { mapNoteInput.blur(); return; }
        e.stopPropagation();
    });
    if (mapNoteAiBtn) mapNoteAiBtn.addEventListener('click', () => {
        if (!mapPanelCurrent) return;
        analyzePathInflight.add(mapPanelCurrent);
        syncMapNoteAiBtn();
        vscode.postMessage({ type: 'analyzeDiff', path: mapPanelCurrent });
    });
    // Static button — derive its state from the inflight set so it can
    // never wedge when the panel closes or switches mid-analysis.
    function syncMapNoteAiBtn() {
        if (!mapNoteAiBtn) return;
        const busy = !!(mapPanelCurrent && analyzePathInflight.has(mapPanelCurrent));
        mapNoteAiBtn.disabled = busy;
        mapNoteAiBtn.textContent = busy ? '⌛ Analyzing…' : '🔍 Analyze with notes';
    }

    const mapRootEl = document.getElementById('map-root');
    function mapSetRoot(root) {
        if (mapRootEl) mapRootEl.value = root || '';
        vscode.postMessage({ type: 'archMapRequest', root: root || '' });
    }
    if (mapRootEl) {
        mapRootEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { mapSetRoot(mapRootEl.value.trim()); mapRootEl.blur(); }
        });
    }

    window.__gdvMapBridge = {
        jumpToDiff: mapJumpToDiff,
        showDiff: mapShowPanel,
        hidePanel: mapHidePanel,
        // Raw unified diff + file length so the map can render the hover
        // diff peek without another host round-trip.
        getChange: (p) => {
            const c = lastChanges.find((x) => x.path === p);
            if (!c) return null;
            const body = c.worktreeContent || c.headContent || '';
            return { diff: c.diff || '', lines: body ? body.split('\\n').length : 0, binary: !!c.binary };
        },
        setRoot: mapSetRoot,
        openFile: (p) => vscode.postMessage({ type: 'openFile', path: p }),
        setViewed: (p, v) => vscode.postMessage({ type: 'mapViewed', path: p, viewed: !!v }),
        analyze: (p) => vscode.postMessage({ type: 'analyzeDiff', path: p }),
    };

    function setMapActive(on) {
        mapActive = !!on;
        document.body.classList.toggle('map-mode', mapActive);
        if (mapToggleBtn) mapToggleBtn.textContent = mapActive ? '▤ Grid' : '◉ Map';
        if (mapActive) {
            vscode.postMessage({ type: 'archMapRequest' });
            if (window.GitMap) window.GitMap.resize();
        }
    }
    if (mapToggleBtn) mapToggleBtn.addEventListener('click', () => setMapActive(!mapActive));

    function mapReplayAnalysis() {
        if (!window.GitMap) return;
        for (const entry of archFiles.entries()) window.GitMap.analysis(entry[0], entry[1]);
    }

    function mapDeliver() {
        if (!window.GitMap || !pendingMapPayload) return;
        window.GitMap.setData(pendingMapPayload);
        mapReplayAnalysis();
        if (mapRootEl && document.activeElement !== mapRootEl) {
            mapRootEl.value = pendingMapPayload.root || '';
        }
        if (mapNoteEl) {
            mapNoteEl.textContent = pendingMapPayload.truncated
                ? 'showing ' + pendingMapPayload.shownFiles + '/' + pendingMapPayload.totalFiles + ' files'
                : pendingMapPayload.totalFiles + ' files';
        }
        if (mapEmptyEl) {
            if (pendingMapPayload.changedCount === 0) {
                mapEmptyEl.textContent = 'Working tree clean — map shows repo structure only.';
                mapEmptyEl.style.display = 'flex';
                setTimeout(() => { mapEmptyEl.style.display = 'none'; }, 3500);
            } else {
                mapEmptyEl.style.display = 'none';
            }
        }
    }
    window.addEventListener('gitmap-ready', mapDeliver);

    function pushMapFilter() {
        if (window.GitMap) {
            window.GitMap.setFilter({
                text: (mapFilterEl && mapFilterEl.value) || '',
                unreviewedOnly: !!(mapUnrevCb && mapUnrevCb.checked),
                dimUnchanged: !!(mapChangedCb && mapChangedCb.checked),
            });
        }
    }
    if (mapFilterEl) {
        mapFilterEl.addEventListener('input', pushMapFilter);
        mapUnrevCb.addEventListener('change', pushMapFilter);
        mapChangedCb.addEventListener('change', pushMapFilter);
    }

    document.addEventListener('keydown', (e) => {
        if (!mapActive || !window.GitMap) return;
        const tag = ((e.target && e.target.tagName) || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
            if (e.key === 'Escape' && e.target.blur) e.target.blur();
            return;
        }
        // Cmd+V must never toggle "reviewed", Cmd+F must not reframe —
        // chorded keys belong to the app/OS, not the map.
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === '/') { e.preventDefault(); if (mapFilterEl) mapFilterEl.focus(); }
        else if (e.key === 'Escape') {
            if (mapPanelEl && mapPanelEl.classList.contains('open')) { mapHidePanel(); window.GitMap.clearSelection(); }
            else window.GitMap.clearSelection();
        }
        else if (e.key === 'v') {
            if (mapPanelCurrent && window.GitMap.toggleViewedPath) { window.GitMap.toggleViewedPath(mapPanelCurrent); updateMapPanelViewedBtn(); }
            else window.GitMap.toggleViewedSelected();
        }
        else if (e.key === 'Enter') { window.GitMap.diffSelected(); }
        else if (e.key === 'f') { window.GitMap.frameChangeset(); }
        else if (e.key === 'n') { window.GitMap.nextUnreviewed(1); }
        else if (e.key === 'p') { window.GitMap.nextUnreviewed(-1); }
        else if (e.key === 'q') { window.GitMap.rotate(-1); }
        else if (e.key === 'e') { window.GitMap.rotate(1); }
    });

    const archAutoCb = document.getElementById('arch-auto-cb');
    const aiUsageEl = document.getElementById('ai-usage');
    if (archAutoCb) {
        archAutoCb.addEventListener('change', () => {
            vscode.postMessage({ type: 'archDocSetAuto', on: archAutoCb.checked });
        });
    }
    function fmtTok(n) {
        n = Number(n) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }
    function handleAiUsage(msg) {
        if (!aiUsageEl) return;
        if (!msg.requests) { aiUsageEl.textContent = ''; return; }
        let text = fmtTok(msg.promptTokens) + '↑ ' + fmtTok(msg.completionTokens) + '↓';
        if (msg.hasPrices) {
            const c = Number(msg.cost) || 0;
            text += ' · $' + (c < 0.1 ? c.toFixed(4) : c.toFixed(2));
        }
        aiUsageEl.textContent = text;
    }

    function handleArchMap(msg) {
        if (msg.error) {
            if (mapEmptyEl) {
                mapEmptyEl.textContent = 'Map failed: ' + msg.error;
                mapEmptyEl.style.display = 'flex';
            }
            return;
        }
        pendingMapPayload = msg.payload;
        mapDeliver();
    }

    function handleArchDoc(msg) {
        if (window.GitMap) {
            if (msg.phase === 'start') { window.GitMap.setStale(true); }
            else if (msg.phase === 'file') { window.GitMap.analysis(msg.path, msg.result || {}); }
            else if (msg.phase === 'done' || msg.phase === 'error' || msg.phase === 'cancelled' || msg.phase === 'empty') {
                window.GitMap.setStale(false);
            }
        }
        if (msg.phase === 'start') {
            archDocEl.classList.remove('stale');
            archFiles = new Map();
            archFilesEl.innerHTML = '';
            archOverviewEl.innerHTML = '<div class="review-loading">Analyzing ' + msg.total + ' file' + (msg.total === 1 ? '' : 's') + '…</div>';
            archTldrEl.textContent = '';
            archCancelBtn.style.display = '';
            archSetStatus('analyzing 0/' + msg.total + '…');
            contentEl.querySelectorAll('.arch-note').forEach(n => n.remove());
        } else if (msg.phase === 'file') {
            archFiles.set(msg.path, msg.result || {});
            archSetStatus('analyzing ' + msg.completed + '/' + msg.total + '…');
            archRenderFiles();
            archApplyNote(msg.path);
        } else if (msg.phase === 'static') {
            archRenderStatic(msg);
        } else if (msg.phase === 'overview') {
            const md = String(msg.markdown || '');
            archOverviewEl.innerHTML = renderMarkdown(md);
            const m = md.match(/##\\s*TL;DR\\s*\\n+([^\\n#]+)/i);
            archTldrEl.textContent = m ? m[1].trim() : '';
        } else if (msg.phase === 'done') {
            archCancelBtn.style.display = 'none';
            archSetStatus(msg.localOnly ? '✓ current (local only)' : '✓ current');
            if (msg.localOnly) archOverviewEl.innerHTML = '';
        } else if (msg.phase === 'error') {
            archCancelBtn.style.display = 'none';
            archSetStatus('error', 'error');
            archOverviewEl.innerHTML = '<div class="review-loading">' + escapeHtml(msg.error || 'Analysis failed.') + '</div>';
        } else if (msg.phase === 'cancelled') {
            archCancelBtn.style.display = 'none';
            archSetStatus('cancelled — ⟳ to re-run');
            archDocEl.classList.add('stale');
        } else if (msg.phase === 'empty') {
            archCancelBtn.style.display = 'none';
            archFiles = new Map();
            archFilesEl.innerHTML = '';
            archOverviewEl.innerHTML = '';
            archStaticEl.innerHTML = '';
            archTldrEl.textContent = '';
            archSetStatus('no changes');
        }
    }

    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'editorConfig') {
            applyEditorConfig(msg.editor);
            return;
        }
        if (msg.type === 'viewSettings') {
            applyViewSettings(msg.view);
            return;
        }
        if (msg.type === 'state') {
            render(msg);
            maybeScrollToNextHunkAction();
            archApplyAllNotes();
            // Panel actions that round-trip through refresh() (stage, hunk
            // approve/reject, discard) reply with 'state' — the anchored
            // panel must re-render or its hunk indices go stale and the
            // next approve stages the wrong hunk.
            refreshMapPanel();
            if (archAutoCb && msg.analysisAuto !== undefined) archAutoCb.checked = !!msg.analysisAuto;
            if (mapToggleBtn && msg.experimentalMap !== undefined) {
                mapToggleBtn.style.display = msg.experimentalMap ? '' : 'none';
                if (!msg.experimentalMap && mapActive) setMapActive(false);
            }
        }
        else if (msg.type === 'archDoc') {
            handleArchDoc(msg);
        }
        else if (msg.type === 'archMap') {
            handleArchMap(msg);
        }
        else if (msg.type === 'aiUsage') {
            handleAiUsage(msg);
        }
        else if (msg.type === 'fileUpdated') {
            replaceFile(msg.change);
            maybeScrollToNextHunkAction();
            if (msg.change) {
                archApplyNote(msg.change.path);
                const li = lastChanges.findIndex(c => c.path === msg.change.path);
                if (li >= 0) lastChanges[li] = msg.change; else lastChanges.push(msg.change);
                if (mapPanelCurrent === msg.change.path) refreshMapPanel();
            }
        }
        else if (msg.type === 'hiddenUpdated') {
            hiddenSet = new Set(msg.hidden || []);
            updateHiddenUi();
            // Re-render visible list with the new filter applied.
            render({
                changes: lastChanges,
                hidden: msg.hidden || [],
                branch: { branch: branchEl.textContent || '' },
                repoRoot: repoEl.textContent || '',
                draft: undefined,
            });
            archApplyAllNotes();
        }
        else if (msg.type === 'openRouterKeyStatus') {
            keySaveBtn.disabled = false;
            const sourceLabel =
                  msg.source === 'settings' ? 'saved in settings'
                : msg.source === 'state' ? 'saved (legacy)'
                : msg.source === 'env' ? 'from ~/.env'
                : '';
            if (msg.error) {
                setKeyStatus('Save failed: ' + msg.error, 'error');
            } else if (msg.hasKey) {
                if (msg.saved) {
                    // Successful save — clear the input and confirm.
                    keyInputEl.value = '';
                }
                setKeyStatus('✓ ' + sourceLabel, 'ok');
                keyToggleBtn.title = 'Change OpenRouter API key (' + sourceLabel + ')';
            } else {
                setKeyStatus('No key configured', null);
                keyToggleBtn.title = 'Set OpenRouter API key';
            }
        }
        else if (msg.type === 'commitMessageGenerated') {
            generateBtn.disabled = false;
            generateBtn.textContent = generateBtn.dataset.originalLabel || '✨';
            generateBtn.title = generateBtn.dataset.originalTitle
                || 'Generate commit message from diff (OpenRouter model, configurable)';
            if (msg.ok) {
                commitMsgEl.value = msg.message || '';
                vscode.postMessage({ type: 'saveDraft', draft: commitMsgEl.value });
                const tail = msg.truncated ? ' (diff truncated)' : '';
                if (autoShipAfterGenerate && commitMsgEl.value.trim()) {
                    autoShipAfterGenerate = false;
                    setCommitStatus('✓ Generated — staging, committing, pushing…', null);
                    shipIt();
                } else {
                    autoShipAfterGenerate = false;
                    commitMsgEl.focus();
                    setCommitStatus('✓ Generated' + tail, 'ok');
                    setTimeout(() => setCommitStatus(''), 4000);
                }
            } else {
                autoShipAfterGenerate = false;
                setCommitStatus(msg.error || 'Generation failed', 'error');
                if ((msg.error || '').includes('No OpenRouter API key')) {
                    showKeyRow(true);
                }
            }
        }
        else if (msg.type === 'reviewAllDiffsResult') {
            if (reviewBtn) {
                reviewBtn.disabled = false;
                reviewBtn.textContent = reviewBtn.dataset.originalLabel || '🧠 Review All';
            }
            if (msg.ok) {
                const md = String(msg.markdown || '');
                reviewLastMarkdown = md;
                reviewBodyEl.innerHTML = renderMarkdown(md);
                reviewBodyEl.scrollTop = 0;
                const tail = msg.truncated ? ' (some diffs truncated)' : '';
                setReviewStatus('✓ done' + tail, null);
            } else {
                reviewLastMarkdown = '';
                reviewBodyEl.innerHTML = '<div class="review-loading">' + escapeHtml(msg.error || 'Review failed.') + '</div>';
                setReviewStatus('error', 'error');
            }
        }
        else if (msg.type === 'analyzeDiffResult') {
            analyzePathInflight.delete(msg.path);
            // Restore the button (it may have been re-rendered by commentsUpdated;
            // querying live to reflect current DOM).
            const btn = contentEl.querySelector(\`.file[data-path="\${CSS.escape(msg.path)}"] button[data-action="analyzeDiff"]\`);
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.dataset.originalLabel || '🔍 Analyze';
            }
            // Inflight already cleared above — sync unconditionally so the
            // button recovers even if the panel switched files meanwhile,
            // and refresh the panel body so its header Analyze button (a
            // re-rendered element) recovers too.
            syncMapNoteAiBtn();
            if (msg.path === mapPanelCurrent) refreshMapPanel();
            if (msg.ok) {
                const tail = msg.truncated ? ' (diff truncated)' : '';
                const text = msg.count === 0
                    ? \`✓ Analyzed \${msg.path} — no issues flagged\${tail}\`
                    : \`✓ Analyzed \${msg.path} — \${msg.count} comment\${msg.count === 1 ? '' : 's'} added\${tail}\`;
                showFindStatus(text);
            } else {
                showFindStatus(\`Analyze failed: \${msg.error || 'unknown error'}\`);
            }
        }
        else if (msg.type === 'commentsUpdated') {
            allComments = msg.comments || [];
            // Re-render visible files so comment rows update without losing other state.
            const visiblePaths = new Set(Array.from(contentEl.querySelectorAll('.file')).map(f => f.getAttribute('data-path')));
            for (const path of visiblePaths) {
                const change = lastChanges.find(c => c.path === path);
                if (change) replaceFile(change);
            }
            archApplyAllNotes();
            refreshMapPanel();
        }
        else if (msg.type === 'pushResult') {
            commitBtn.disabled = false;
            commitPushBtn.disabled = false;
            if (msg.ok) {
                setCommitStatus('✓ pushed', 'ok');
                setTimeout(() => setCommitStatus(''), 3500);
            } else {
                setCommitStatus(msg.error || 'Push failed', 'error');
            }
        }
        else if (msg.type === 'commitResult') {
            commitBtn.disabled = false;
            commitPushBtn.disabled = false;
            if (msg.ok) {
                commitMsgEl.value = '';
                amendEl.checked = false;
                lastChanges = [];
                fileActionStatus.clear();
                expandedFiles.clear();
                pendingScrollPath = null;
                composingFor = null;
                editingCommentId = null;
                const verb = msg.pushed ? 'Committed & pushed' : 'Committed';
                contentEl.innerHTML = \`<div class="empty">✓ \${verb} — refreshing…</div>\`;
                summaryEl.textContent = '';
                const pushedSuffix = msg.pushed ? ' & pushed' : '';
                setCommitStatus(\`✓ \${msg.head || 'committed'}\${pushedSuffix}\`, 'ok');
                setTimeout(() => setCommitStatus(''), 4000);
            } else {
                setCommitStatus(msg.error || 'Commit failed.', 'error');
            }
        }
        else if (msg.type === 'error') {
            contentEl.innerHTML = \`<div class="error">\${escapeHtml(msg.message)}</div>\`;
        }
    });

    // ============================================================
    //  Diff review panel (OpenRouter)
    // ============================================================
    const reviewPanelEl = document.getElementById('review-panel');
    const reviewBodyEl = document.getElementById('review-body');
    const reviewStatusEl = document.getElementById('review-status');
    const reviewBtn = document.getElementById('review-all-btn');
    const reviewCloseBtn = document.getElementById('review-close');
    const reviewMinBtn = document.getElementById('review-min');
    const reviewCopyBtn = document.getElementById('review-copy');
    const reviewResizeEl = document.getElementById('review-resize');
    let reviewLastMarkdown = '';

    function setReviewStatus(text, kind) {
        reviewStatusEl.textContent = text || '';
        reviewStatusEl.classList.remove('error');
        if (kind === 'error') reviewStatusEl.classList.add('error');
    }
    function showReviewPanel() {
        reviewPanelEl.classList.add('open');
        reviewPanelEl.classList.remove('minimized');
    }

    /**
     * Tiny markdown → HTML converter. Not feature-complete; just enough for
     * a typical AI-written code review (headers, lists, code, bold, italic,
     * blockquotes, fenced blocks).
     */
    function renderMarkdown(text) {
        if (!text) return '';
        // Extract fenced code blocks first to a placeholder so other regexes
        // don't munge them.
        const blocks = [];
        text = text.replace(/\\\`\\\`\\\`([a-zA-Z0-9_+-]*)\\n([\\s\\S]*?)\\n\\\`\\\`\\\`/g, (_, lang, code) => {
            blocks.push({ lang: lang || '', code });
            return '\\u0000BLOCK' + (blocks.length - 1) + '\\u0000';
        });
        // Escape HTML in the rest.
        text = escapeHtml(text);
        // Headers
        text = text.replace(/^###### (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^##### (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^#### (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        // Blockquotes
        text = text.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
        // Bold + italic
        text = text.replace(/\\*\\*([^*]+?)\\*\\*/g, '<strong>$1</strong>');
        text = text.replace(/\\*([^*\\n]+?)\\*/g, '<em>$1</em>');
        // Inline code
        text = text.replace(/\\\`([^\\\`]+?)\\\`/g, '<code>$1</code>');
        // Numbered lists (1. xxx)
        text = text.replace(/^(\\d+)\\.\\s+(.+)$/gm, '<li>$2</li>');
        // Bulleted lists
        text = text.replace(/^[-*]\\s+(.+)$/gm, '<li>$1</li>');
        // Wrap consecutive <li> in <ul>
        text = text.replace(/(?:<li>.+?<\\/li>(?:\\n|$))+/g, m => '<ul>' + m + '</ul>');
        // Paragraphs: split on blank lines, wrap loose text in <p>.
        text = text.split(/\\n\\n+/).map(chunk => {
            const c = chunk.trim();
            if (!c) return '';
            if (/^<(h\\d|ul|ol|li|blockquote|pre)/i.test(c)) return c;
            return '<p>' + c.replace(/\\n/g, '<br>') + '</p>';
        }).join('\\n');
        // Restore code blocks.
        text = text.replace(/\\u0000BLOCK(\\d+)\\u0000/g, (_, idx) => {
            const b = blocks[Number(idx)];
            const langClass = b.lang ? ' class="language-' + b.lang + '"' : '';
            return '<pre><code' + langClass + '>' + escapeHtml(b.code) + '</code></pre>';
        });
        return text;
    }

    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
            reviewBtn.disabled = true;
            const original = reviewBtn.textContent;
            reviewBtn.dataset.originalLabel = original;
            reviewBtn.textContent = '⌛ Reviewing…';
            showReviewPanel();
            reviewBodyEl.innerHTML = '<div class="review-loading">Sending all diffs to review model…</div>';
            setReviewStatus('thinking…', null);
            vscode.postMessage({ type: 'reviewAllDiffs' });
        });
    }
    reviewCloseBtn.addEventListener('click', () => {
        reviewPanelEl.classList.remove('open');
    });
    reviewMinBtn.addEventListener('click', () => {
        reviewPanelEl.classList.toggle('minimized');
    });
    reviewCopyBtn.addEventListener('click', () => {
        if (reviewLastMarkdown) {
            vscode.postMessage({ type: 'copyToClipboard', text: reviewLastMarkdown, label: 'review' });
        }
    });
    (function setupReviewResize() {
        let dragging = false, startY = 0, startH = 0;
        reviewResizeEl.addEventListener('mousedown', (e) => {
            dragging = true;
            startY = e.clientY;
            startH = reviewPanelEl.getBoundingClientRect().height;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dy = startY - e.clientY;
            const newH = Math.max(140, Math.min(window.innerHeight * 0.9, startH + dy));
            reviewPanelEl.style.height = newH + 'px';
        });
        window.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                document.body.style.cursor = '';
            }
        });
    })();

    // ============================================================
    //  Embedded terminal panel (xterm.js + node-pty bridge)
    // ============================================================
    const termPanelEl = document.getElementById('term-panel');
    const termTabsEl = document.getElementById('term-tabs');
    const termBodyEl = document.getElementById('term-body');
    const termLauncherEl = document.getElementById('term-launcher');
    const termLauncherCountEl = document.getElementById('term-launcher-count');
    const termResizeEl = document.getElementById('term-resize');
    const termNewBtn = document.getElementById('term-new');
    const termMinBtn = document.getElementById('term-min');
    const termCloseBtn = document.getElementById('term-close');

    const ptys = new Map(); // id -> { id, label, pane, term, fitAddon, exited, command, args, pendingInput }
    let activePtyId = null;

    function uid() { return 'pty-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

    function termColors() {
        const isLight = document.body.classList.contains('vscode-light')
            || document.body.classList.contains('vscode-high-contrast-light');
        return {
            background: isLight ? '#ffffff' : '#0d1117',
            foreground: isLight ? '#1f2328' : '#e6edf3',
            cursor: isLight ? '#1f2328' : '#e6edf3',
            cursorAccent: isLight ? '#ffffff' : '#0d1117',
            selectionBackground: isLight ? 'rgba(0,86,197,0.18)' : 'rgba(0,212,255,0.30)',
        };
    }

    function setTermPanelOpen(open, options) {
        if (open) {
            termPanelEl.classList.add('open');
            termPanelEl.classList.remove('minimized');
            termLauncherEl.classList.remove('show');
            // After display flip, terminals need re-fit.
            requestAnimationFrame(() => fitActiveTerm());
        } else {
            termPanelEl.classList.remove('open');
            termPanelEl.classList.remove('minimized');
            updateLauncher();
        }
        if (options && options.suppressLauncher) termLauncherEl.classList.remove('show');
    }

    function updateLauncher() {
        if (!termPanelEl.classList.contains('open') && ptys.size > 0) {
            termLauncherEl.classList.add('show');
            termLauncherCountEl.textContent = String(ptys.size);
        } else {
            termLauncherEl.classList.remove('show');
        }
    }

    function fitActiveTerm() {
        const s = activePtyId && ptys.get(activePtyId);
        if (!s || !s.fitAddon) return;
        try {
            s.fitAddon.fit();
            const { cols, rows } = s.term;
            vscode.postMessage({ type: 'pty.resize', id: s.id, cols, rows });
        } catch (e) { /* ignore */ }
    }

    function activatePty(id) {
        activePtyId = id;
        for (const s of ptys.values()) {
            const isActive = s.id === id;
            s.pane.classList.toggle('active', isActive);
            const tab = termTabsEl.querySelector('[data-pty-tab="' + s.id + '"]');
            if (tab) tab.classList.toggle('active', isActive);
        }
        requestAnimationFrame(() => {
            fitActiveTerm();
            const s = ptys.get(id);
            if (s) try { s.term.focus(); } catch (e) { /* ignore */ }
        });
    }

    function renderTabs() {
        termTabsEl.innerHTML = '';
        for (const s of ptys.values()) {
            const tab = document.createElement('div');
            tab.className = 'term-tab' + (s.exited ? ' exited' : '') + (s.id === activePtyId ? ' active' : '');
            tab.setAttribute('data-pty-tab', s.id);
            tab.innerHTML = '<span class="term-status"></span>'
                + '<span class="label"></span>'
                + (s.pid ? '<span class="pid">#' + s.pid + '</span>' : '')
                + '<span class="close-btn" title="Close">×</span>';
            tab.querySelector('.label').textContent = s.label;
            tab.addEventListener('click', (e) => {
                if (e.target.classList.contains('close-btn')) {
                    e.stopPropagation();
                    closePty(s.id);
                    return;
                }
                activatePty(s.id);
            });
            termTabsEl.appendChild(tab);
        }
    }

    function spawnPty(opts) {
        const id = uid();
        const label = opts.label || 'Shell';
        // Empty command lets the extension default to user's $SHELL — that
        // way zsh users on macOS get their actual login shell with the right
        // PATH (where claude/gemini are installed).
        const command = opts.command || '';
        const args = Array.isArray(opts.args) ? opts.args : [];

        const pane = document.createElement('div');
        pane.className = 'term-pane';
        pane.setAttribute('data-pty-pane', id);
        termBodyEl.appendChild(pane);

        const term = new window.Terminal({
            convertEol: false,
            fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--diff-mono').trim() || 'monospace',
            fontSize: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size'), 10) || 13,
            cursorBlink: true,
            scrollback: 5000,
            theme: termColors(),
            allowProposedApi: true,
        });
        const fitAddon = new window.FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(pane);

        const session = {
            id, label, pane, term, fitAddon, exited: false, command, args,
            pid: null, pendingInput: opts.pendingInput || '',
        };
        ptys.set(id, session);

        term.onData((data) => {
            if (session.exited) return;
            vscode.postMessage({ type: 'pty.write', id, data });
        });
        term.onResize(({ cols, rows }) => {
            vscode.postMessage({ type: 'pty.resize', id, cols, rows });
        });

        // Trigger initial size & spawn the pty on the extension side.
        setTermPanelOpen(true);
        renderTabs();
        activatePty(id);
        requestAnimationFrame(() => {
            try { fitAddon.fit(); } catch (e) { /* ignore */ }
            const cols = term.cols, rows = term.rows;
            const payload = { type: 'pty.create', id, label, command, args, cols, rows };
            if (opts.agent && opts.agent.binary) payload.agent = opts.agent;
            vscode.postMessage(payload);
        });
        return session;
    }

    function closePty(id) {
        const s = ptys.get(id);
        if (!s) return;
        try { s.term.dispose(); } catch (e) { /* ignore */ }
        s.pane.remove();
        ptys.delete(id);
        vscode.postMessage({ type: 'pty.kill', id });
        if (activePtyId === id) {
            const next = ptys.values().next().value;
            activePtyId = next ? next.id : null;
        }
        renderTabs();
        if (activePtyId) activatePty(activePtyId);
        if (ptys.size === 0) setTermPanelOpen(false);
    }

    // === Resize drag ===
    (function setupResize() {
        let dragging = false;
        let startY = 0;
        let startH = 0;
        termResizeEl.addEventListener('mousedown', (e) => {
            dragging = true;
            startY = e.clientY;
            startH = termPanelEl.getBoundingClientRect().height;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dy = startY - e.clientY;
            const newH = Math.max(120, Math.min(window.innerHeight * 0.85, startH + dy));
            termPanelEl.style.height = newH + 'px';
            fitActiveTerm();
        });
        window.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                document.body.style.cursor = '';
                fitActiveTerm();
            }
        });
    })();

    // Keep terminals fit when window resizes.
    window.addEventListener('resize', () => fitActiveTerm());

    // Toolbar buttons
    termNewBtn.addEventListener('click', () => {
        spawnPty({ label: 'Shell', command: '', args: [] });
    });
    termMinBtn.addEventListener('click', () => {
        if (termPanelEl.classList.contains('minimized')) {
            termPanelEl.classList.remove('minimized');
            requestAnimationFrame(fitActiveTerm);
        } else {
            termPanelEl.classList.add('minimized');
            updateLauncher();
        }
    });
    termCloseBtn.addEventListener('click', () => {
        // Close all terminals
        for (const id of Array.from(ptys.keys())) closePty(id);
        setTermPanelOpen(false);
    });
    termLauncherEl.addEventListener('click', () => {
        setTermPanelOpen(true);
    });

    // === Pty message handlers (pty.* + embeddedAi.spawn) ===
    function handlePtyMessage(msg) {
        const s = msg.id ? ptys.get(msg.id) : null;
        if (msg.type === 'pty.ready') {
            if (s) {
                s.pid = msg.pid;
                renderTabs();
                if (s.pendingInput) {
                    // Give shell a beat to print prompt before sending input.
                    setTimeout(() => {
                        try { vscode.postMessage({ type: 'pty.write', id: s.id, data: s.pendingInput }); } catch (e) { /* ignore */ }
                    }, 150);
                    s.pendingInput = '';
                }
            }
        } else if (msg.type === 'pty.data') {
            if (s) try { s.term.write(msg.data); } catch (e) { /* ignore */ }
        } else if (msg.type === 'pty.exit') {
            if (s) {
                s.exited = true;
                renderTabs();
                try {
                    s.term.write('\\r\\n\\x1b[2;37m[process exited code=' + msg.code + ']\\x1b[0m\\r\\n');
                } catch (e) { /* ignore */ }
            }
        } else if (msg.type === 'pty.error') {
            if (s) {
                try { s.term.write('\\r\\n\\x1b[31m' + msg.error + '\\x1b[0m\\r\\n'); } catch (e) { /* ignore */ }
            } else {
                showFindStatus('Terminal error: ' + msg.error);
            }
        }
    }

    function handleEmbeddedAiSpawn(msg) {
        const target = msg.target;
        const promptText = msg.message || '';
        const isClaude = target === 'embedded-claude';
        const isGemini = target === 'embedded-gemini';
        const isShell = target === 'embedded-shell';

        const labelBase = isClaude ? 'Claude' : isGemini ? 'Gemini' : 'Shell';
        let n = 1;
        for (const s of ptys.values()) if (s.label.startsWith(labelBase)) n++;
        const label = n > 1 ? labelBase + ' #' + n : labelBase;

        if (isShell) {
            spawnPty({ label, command: '', args: [] });
            return;
        }
        const binary = isClaude ? 'claude' : 'gemini';
        // Spawn the user's actual login shell. The extension defaults to
        // process.env.SHELL (zsh on macOS, bash elsewhere) so PATH includes
        // wherever the agent CLI is installed (~/.local/bin, /opt/homebrew/bin).
        // The extension also writes the prompt to a temp file and types the
        // command "claude/gemini cat-of-tmpfile" into the shell after a delay.
        spawnPty({
            label,
            command: '',
            args: [],
            agent: { binary, promptText },
        });
    }

    // Patch in pty handling at the message dispatcher level.
    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg) return;
        if (typeof msg.type === 'string' && msg.type.indexOf('pty.') === 0) {
            handlePtyMessage(msg);
            return;
        }
        if (msg.type === 'embeddedAi.spawn') {
            handleEmbeddedAiSpawn(msg);
            return;
        }
    });

    vscode.postMessage({ type: 'ready' });
})();
</script>
<script type="importmap">{ "imports": { "three": "${a.threeUri}" } }</script>
<script type="module" src="${a.mapJsUri}"></script>
</body>
</html>`;
}
