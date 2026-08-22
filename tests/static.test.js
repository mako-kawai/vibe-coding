import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'tasks.html', 'courses.html', 'notes.html', 'schedule.html', 'grades.html', 'transcript.html', 'settings.html'];

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

test('grade page exposes paste and plain-text file import controls', async () => {
  const html = await readFile(resolve(root, 'grades.html'), 'utf8');
  assert.match(html, /id="portalGradeText"/);
  assert.match(html, /id="gradeTextInput"[^>]*\.txt/);
  assert.match(html, /id="loadGradeTextFile"/);
  assert.match(html, /id="exportTranscriptButton"/);
});

test('transcript page exposes print and CSV export controls', async () => {
  const html = await readFile(resolve(root, 'transcript.html'), 'utf8');
  const script = await readFile(resolve(root, 'js/transcript-page.js'), 'utf8');
  assert.match(html, /id="printTranscript"/);
  assert.match(html, /id="downloadTranscriptCsv"/);
  assert.match(script, /serializeGradeTranscriptCsv/);
  assert.match(script, /window\.print/);
});

test('dashboard uses the shared three-decimal GPA formatter', async () => {
  const script = await readFile(resolve(root, 'js/dashboard.js'), 'utf8');
  assert.match(script, /formatGpa/);
  assert.doesNotMatch(script, /estimatedGpa\.toFixed\(2\)/);
});

test('theme settings expose clarity, reading mask and responsive crop controls', async () => {
  const html = await readFile(resolve(root, 'settings.html'), 'utf8');
  const cropper = await readFile(resolve(root, 'js/image-cropper.js'), 'utf8');
  assert.match(html, /data-background-mode="clear"/);
  assert.match(html, /id="themeOverlayOpacity"/);
  assert.match(cropper, /data-crop-view/);
  assert.match(cropper, /preserve|selectBackgroundImage/);
});

test('clear background mode does not blur the full-page overlay by default', async () => {
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  assert.match(css, /data-background-mode="soft"[^}]+backdrop-filter:\s*blur\(3px\)/);
  const baseOverlay = css.match(/body::after\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.doesNotMatch(baseOverlay, /backdrop-filter/);
});

test('shared top bar has no inactive search or quick-task actions', async () => {
  const ui = await readFile(resolve(root, 'js/ui.js'), 'utf8');
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  assert.doesNotMatch(ui, /全局搜索|globalSearch|tasks\.html\?new=1/);
  assert.doesNotMatch(css, /search-dialog|search-results|search-hit/);
});
