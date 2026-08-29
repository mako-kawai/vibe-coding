import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'dashboard.html', 'projects.html', 'reviews.html', 'interests.html', 'notes-public.html', 'about.html', 'content-studio.html', 'tasks.html', 'courses.html', 'notes.html', 'schedule.html', 'grades.html', 'transcript.html', 'settings.html'];

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
  for (const path of paths) await access(resolve(root, path.split('?')[0]));
});

test('service worker covers local scripts used by compatibility pages', async () => {
  const source = await readFile(resolve(root, 'sw.js'), 'utf8');
  for (const script of ['script.js', 'courses.js', 'utils.js']) assert.match(source, new RegExp(`['\"]\\./${script}['\"]`));
});

test('grade page exposes paste and plain-text file import controls', async () => {
  const html = await readFile(resolve(root, 'grades.html'), 'utf8');
  assert.match(html, /id="portalGradeText"/);
  assert.match(html, /id="gradeTextInput"[^>]*\.txt/);
  assert.match(html, /id="loadGradeTextFile"/);
  assert.match(html, /id="exportTranscriptButton"/);
  assert.match(html, /id="professionalGpa"/);
  assert.match(html, /课程类别/);
});

test('transcript page exposes print and CSV export controls', async () => {
  const html = await readFile(resolve(root, 'transcript.html'), 'utf8');
  const script = await readFile(resolve(root, 'js/transcript-page.js'), 'utf8');
  assert.match(html, /id="printTranscript"/);
  assert.match(html, /id="downloadTranscriptCsv"/);
  assert.match(script, /serializeGradeTranscriptCsv/);
  assert.match(script, /window\.print/);
  assert.match(script, /professionalRecords/);
  assert.match(html, /id="studentNameInput"/);
  assert.match(script, /updateState/);
  assert.match(html, /非专业必修/);
  assert.match(script, /nonProfessionalRecordCount/);
  assert.match(script, /termGroups/);
});

test('course page exposes the six official category options', async () => {
  const html = await readFile(resolve(root, 'courses.html'), 'utf8');
  for (const category of ['专业任选', '全校任选', '全校必修', '专业必修', '任选', '通选课']) assert.match(html, new RegExp(category));
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

test('top bar remains translucent so the wallpaper can show through', async () => {
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  const topbar = css.match(/\.app-topbar\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(topbar, /background:\s*rgba\([^)]*,\.16\)/);
  assert.match(topbar, /backdrop-filter:\s*blur\(5px\)/);
  assert.doesNotMatch(topbar, /background:\s*rgba\([^)]*,\.86\)/);
});

test('shared top bar has no inactive search or quick-task actions', async () => {
  const ui = await readFile(resolve(root, 'js/ui.js'), 'utf8');
  const css = await readFile(resolve(root, 'styles.css'), 'utf8');
  assert.doesNotMatch(ui, /全局搜索|globalSearch|tasks\.html\?new=1/);
  assert.doesNotMatch(css, /search-dialog|search-results|search-hit/);
});

test('public pages use static content only and keep the cockpit as a separate entry', async () => {
  const publicScripts = ['js/public-shell.js', 'js/public-content.js', 'js/public-page.js'];
  for (const path of publicScripts) assert.doesNotMatch(await readFile(resolve(root, path), 'utf8'), /from ['"]\.\/store\.js/);
  const index = await readFile(resolve(root, 'index.html'), 'utf8');
  const dashboard = await readFile(resolve(root, 'dashboard.html'), 'utf8');
  assert.match(index, /data-public-page="home"/);
  assert.match(index, /js\/public-page\.js/);
  assert.match(dashboard, /data-page="dashboard"/);
  assert.match(dashboard, /dashboard-jumpbar/);
  assert.match(await readFile(resolve(root, 'js/public-shell.js'), 'utf8'), /学习驾驶舱/);
});

test('public content manifest contains only published curated records with safe body paths', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'content/manifest.json'), 'utf8'));
  assert.equal(manifest.version, 1);
  assert.ok(manifest.items.length >= 4);
  for (const item of manifest.items) {
    assert.equal(item.status, 'published');
    assert.match(item.bodyPath, /^(?:projects|reviews|interests|notes)\/[^.\/]+\.md$/u);
    assert.doesNotMatch(item.bodyPath, /\.\./);
  }
});

test('legacy module course links point to the cockpit course page', async () => {
  const moduleFiles = ['module1.html', 'module2.html', 'module3.html', 'module4.html', 'module4plus.html', 'module5.html', 'module6.html', 'module7.html', 'module8.html', 'module9.html'];
  for (const file of moduleFiles) {
    const html = await readFile(resolve(root, 'modules', file), 'utf8');
    assert.doesNotMatch(html, /index\.html#courses/);
    assert.match(html, /\.\.\/courses\.html/);
  }
});
