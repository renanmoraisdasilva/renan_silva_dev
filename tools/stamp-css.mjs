// Stamps a content hash onto the stylesheet URL in every page.
//
// Why: GitHub Pages serves assets/output.css with Cache-Control: max-age=600 and
// the filename never changes, so a deploy that adds new utility classes can be
// paired with an old stylesheet in a visitor's cache (or at the CDN edge). The
// new classes then have no rule at all and the element falls back to inherited
// size — the page looks wrong while every file on disk is right.
//
// The hash only changes when the CSS changes, so this rewrites the HTML only on
// builds that actually produced different CSS.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const pages = ['index.html', 'ai/index.html'];
const css = readFileSync('assets/output.css');
const version = createHash('sha256').update(css).digest('hex').slice(0, 8);
const pattern = /href="((?:\.\.\/)?assets\/output\.css)(?:\?v=[0-9a-f]+)?"/g;

let changed = 0;
for (const page of pages) {
  const before = readFileSync(page, 'utf8');
  const after = before.replace(pattern, `href="$1?v=${version}"`);
  if (after !== before) {
    writeFileSync(page, after);
    changed += 1;
  }
}

console.log(`output.css?v=${version} in ${pages.length} page(s), ${changed} rewritten`);
