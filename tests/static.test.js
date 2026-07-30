import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'tasks.html', 'courses.html', 'notes.html', 'schedule.html', 'grades.html', 'settings.html'];

test('core page script and stylesheet dependencies are local and present', async () => {
  for (const page of pages) {
    const html = await readFile(resolve(root, page), 'utf8');
    const dependencies = [
      ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
      ...html.matchAll(/<link[^>]+href="([^"]+)"/g)
    ].map(match => match[1].split('?')[0]).filter(path => !path.startsWith('data:'));
    for (const dependency of dependencies) {
      assert.equal(/^https?:/i.test(dependency), false, `${page} uses remote runtime dependency ${dependency}`);
      await access(resolve(root, dependency));
    }
  }
});

test('service worker precache paths exist', async () => {
  const source = await readFile(resolve(root, 'sw.js'), 'utf8');
  const paths = [...source.matchAll(/'\.\/([^']+)'/g)].map(match => match[1]).filter(path => path && !path.includes('${'));
  for (const path of paths) await access(resolve(root, path));
});
