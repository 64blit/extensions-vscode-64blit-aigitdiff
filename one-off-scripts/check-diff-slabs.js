// One-off: prove the map's hunk parser works on a real diff.
// parseHunks now lives in media/map.js (ES module) — lift it by name and
// validate its +/- totals against git --numstat ground truth.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const repo = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(repo, 'media', 'map.js'), 'utf8');

function lift(name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('not found: ' + name);
    let depth = 0;
    const i = src.indexOf('{', start);
    for (let j = i; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) return src.slice(start, j + 1); }
    }
    throw new Error('unbalanced: ' + name);
}

// eslint-disable-next-line no-eval
const parseHunks = eval('(' + lift('parseHunks') + ')');

const target = 'src/webview.ts';
const diff = execFileSync('git', ['diff', 'HEAD', '-U3', '--', target], { cwd: repo, encoding: 'utf8' });
if (!diff.trim()) { console.log('no diff for', target, '— nothing to check'); process.exit(0); }
const hunks = parseHunks(diff);
const totAdd = hunks.reduce((s, h) => s + h.adds, 0);
const totDel = hunks.reduce((s, h) => s + h.dels, 0);
const stat = execFileSync('git', ['diff', 'HEAD', '--numstat', '--', target], { cwd: repo, encoding: 'utf8' }).trim().split(/\s+/);
console.log('hunks:', hunks.length, '· parsed +' + totAdd + ' -' + totDel, '· numstat +' + stat[0] + ' -' + stat[1]);
if (String(totAdd) !== stat[0] || String(totDel) !== stat[1]) { console.error('MISMATCH'); process.exit(1); }
console.log('OK');
