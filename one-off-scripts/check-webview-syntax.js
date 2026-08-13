// One-off: syntax-check the JS that getWebviewHtml() emits. TypeScript can't
// see inside the template literal, so a broken map renderer compiles fine.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getWebviewHtml } = require(path.join(__dirname, '..', 'out', 'webview.js'));
const html = getWebviewHtml({
    cspSource: 'vscode-resource:',
    hlJsUri: 'https://x/hl.js', hlCssUri: 'https://x/hl.css',
    xtermJsUri: 'https://x/x.js', xtermCssUri: 'https://x/x.css', xtermFitUri: 'https://x/f.js',
    gridstackJsUri: 'https://x/gs.js', gridstackCssUri: 'https://x/gs.css',
    threeUri: 'https://x/three.js',
    editor: { fontFamily: 'Menlo', fontSize: 12, lineHeight: 18, tabSize: 4, insertSpaces: true },
});
const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let m, i = 0, bad = 0;
while ((m = re.exec(html)) !== null) {
    const attrs = m[1], body = m[2];
    if (/\bsrc=/.test(attrs) || !body.trim()) continue;
    if (/type=["']importmap["']/.test(attrs)) {
        try { JSON.parse(body); console.log(`importmap ok — ${Object.keys(JSON.parse(body).imports).join(', ')}`); }
        catch (e) { bad++; console.error('--- importmap FAILED ---', e.message); }
        continue;
    }
    i++;
    const isModule = /type=["']module["']/.test(attrs);
    const f = path.join(os.tmpdir(), `gdv-script-${i}.${isModule ? 'mjs' : 'js'}`);
    fs.writeFileSync(f, body);
    const r = require('child_process').spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) { bad++; console.error(`--- script #${i} (${isModule ? 'module' : 'classic'}) FAILED ---`); console.error(r.stderr.split('\n').slice(0, 12).join('\n')); }
    else console.log(`script #${i} (${isModule ? 'module' : 'classic'}) ok — ${body.split('\n').length} lines`);
}
process.exit(bad ? 1 : 0);
