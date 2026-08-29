import { normalizePublicContentItem, normalizePublicSite, publicItemToManifest, safePublicAssetUrl, safePublicPath, safePublicUrl } from './logic.js?v=20260829';
import { publicNode, publicIcon } from './public-shell.js';

function contentUrl(path) {
  const safePath = safePublicPath(path);
  if (!safePath) return null;
  const contentPath = safePath.startsWith('content/') ? safePath.slice('content/'.length) : safePath;
  return new URL(`./content/${contentPath}`, document.baseURI);
}

export function publicAssetUrl(value) {
  const safe = safePublicAssetUrl(value);
  if (!safe) return '';
  if (/^https?:\/\//i.test(safe)) return safe;
  const path = safe.startsWith('content/') ? safe : safe.startsWith('media/') ? `content/${safe}` : safe;
  return new URL(`./${path}`, document.baseURI).href;
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`内容文件读取失败：${response.status}`);
  return response.json();
}

export async function loadPublicBundle() {
  const manifest = await readJson(contentUrl('manifest.json'));
  const site = normalizePublicSite(await readJson(contentUrl('site.json')));
  site.avatar = publicAssetUrl(site.avatar);
  const sourceItems = Array.isArray(manifest.items) ? manifest.items : [];
  const items = (await Promise.all(sourceItems.map(async raw => {
    const item = normalizePublicContentItem(raw);
    if (item.status !== 'published') return null;
    item.cover = publicAssetUrl(item.cover);
    let body = '';
    const url = contentUrl(item.bodyPath);
    if (url) {
      try {
        const response = await fetch(url);
        if (response.ok) body = await response.text();
      } catch { /* cached metadata remains useful when one body is unavailable */ }
    }
    return { ...item, body };
  }))).filter(Boolean);
  return { manifest, site, items };
}

export function renderPublicMarkdown(container, markdown = '') {
  container.replaceChildren();
  if (!globalThis.marked || !globalThis.DOMPurify) {
    container.textContent = markdown;
    return;
  }
  const raw = globalThis.marked.parse(String(markdown || ''), { breaks: true, gfm: true });
  // The only HTML assignment here is the output after DOMPurify sanitization.
  container.innerHTML = globalThis.DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload', 'onmouseover', 'srcset']
  });
  container.querySelectorAll('a').forEach(link => {
    const href = safePublicUrl(link.getAttribute('href'));
    if (!href) link.removeAttribute('href');
    else if (/^https?:\/\//i.test(href)) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  });
  container.querySelectorAll('img').forEach(image => {
    const src = publicAssetUrl(image.getAttribute('src'));
    if (!src) image.remove();
    else image.setAttribute('src', src);
  });
  globalThis.renderMathInElement?.(container, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    strict: 'ignore'
  });
}

export function publicDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export function publicItemHref(item) {
  const page = item.type === 'project' ? 'projects.html' : item.type === 'review' ? 'reviews.html' : item.type === 'interest' ? 'interests.html' : 'notes-public.html';
  return `${page}?slug=${encodeURIComponent(item.slug)}`;
}

export function publicTags(tags = []) {
  return publicNode('div', { class: 'public-tags' }, tags.map(tag => publicNode('span', { text: tag })));
}

export function publicCover(item, { detail = false } = {}) {
  const src = publicAssetUrl(item.cover);
  if (!src) return publicNode('div', { class: `public-cover public-cover-placeholder${detail ? ' detail' : ''}`, 'aria-hidden': 'true' }, [publicIcon(item.type === 'project' ? 'box' : item.type === 'review' ? 'book-open' : 'bookmark', detail ? 30 : 23)]);
  const image = publicNode('img', { src, alt: `${item.title} 封面`, loading: 'lazy' });
  return publicNode('div', { class: `public-cover${detail ? ' detail' : ''}` }, [image]);
}

export function publicManifestItem(item) {
  return publicItemToManifest(item);
}
