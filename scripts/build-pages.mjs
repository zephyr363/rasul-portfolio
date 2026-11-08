// Local artifact preparation only. Never publishes or changes Pages settings.
import { cp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = path.join(root, 'docs');
const marker = '.pages-generated';
const signature = 'rasul-portfolio build:pages v1\n';
try {
  const stat = await lstat(docs);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      await readFile(path.join(docs, marker), 'utf8').catch(() => '') !== signature) {
    throw new Error('Refusing to replace docs/: not a generated Pages artifact.');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const build = spawnSync('npm run build', { cwd: root, shell: true, stdio: 'inherit' });
if (build.status !== 0 || build.signal) process.exit(build.status || 1);
await rm(docs, { recursive: true, force: true });
await cp(path.join(root, 'dist'), docs, { recursive: true });
const index = await readFile(path.join(docs, 'index.html'), 'utf8');
await writeFile(path.join(docs, marker), signature);
await writeFile(path.join(docs, '.nojekyll'), '');
await writeFile(path.join(docs, '404.html'), index);
for (const route of ['admin', 'admin/login', 'admin/leads', 'admin/cases', 'admin/content', 'admin/settings']) {
  await mkdir(path.join(docs, route), { recursive: true });
  await writeFile(path.join(docs, route, 'index.html'), index);
}
const check = spawnSync('node scripts/check-pages.mjs', { cwd: root, shell: true, stdio: 'inherit' });
process.exit(check.status || (check.signal ? 1 : 0));
