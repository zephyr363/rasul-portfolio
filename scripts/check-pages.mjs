import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const index = await readFile(path.join(docs, 'index.html'), 'utf8');
await access(path.join(docs, '.nojekyll'));
for (const route of ['404.html', 'admin/index.html', 'admin/login/index.html', 'admin/leads/index.html', 'admin/cases/index.html', 'admin/content/index.html', 'admin/settings/index.html']) {
  assert.equal(await readFile(path.join(docs, route), 'utf8'), index, route);
}
assert(!/\/src\/|\.tsx?\b|sourceMappingURL/.test(index), 'No raw source modules');
const assets = [...index.matchAll(/(?:src|href)="([^"]+\/assets\/[^"?#]+)"/g)];
assert(assets.length > 0, 'Built assets exist');
for (const [, url] of assets) {
  assert(url.startsWith('/rasul-portfolio/assets/'), `Project absolute asset: ${url}`);
  await access(path.join(docs, url.slice('/rasul-portfolio/'.length)));
}
async function checkTree(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    assert(!entry.isSymbolicLink(), `No symlinks: ${file}`);
    assert(!/\.(?:map|tsx?|jsx)$/.test(entry.name), `No source/sourcemap: ${file}`);
    if (entry.isDirectory()) await checkTree(file);
    else if (entry.name.endsWith('.js')) assert(!(await readFile(file, 'utf8')).includes('sourceMappingURL='), `No sourcemap reference: ${file}`);
  }
}
await checkTree(docs);
console.log('Pages artifact PASS: absolute project assets, known route entrypoints, 404 fallback, no source/sourcemaps.');
