import { assetUrl, deleteAsset, getAsset, loadState, putAsset, updateState } from './store.js';
import { createId, normalizePublicContentItem, normalizePublicSite, publicItemToManifest, publicSiteToManifest, safePublicAssetUrl, safePublicPath, safePublicUrl, slugifyPublic } from './logic.js?v=20260829';
import { initApp, icon, node, openDialog, refreshIcons, toast } from './ui.js';
import { publicAssetUrl, renderPublicMarkdown } from './public-content.js';

let editingId = null;
const MAX_PUBLIC_MEDIA_BYTES = 12 * 1024 * 1024;
const previewUrls = new Map();

const TYPE_LABELS = { project: '项目', review: '书评', interest: '兴趣', note: '公开笔记' };
const STATUS_LABELS = { draft: '草稿', ready: '待发布', published: '已发布' };

function bodyAssetId(item) {
  return item.bodyAssetId || `public_${item.id}`;
}

function mediaMimeFromPath(path) {
  const extension = String(path || '').split('.').pop()?.toLowerCase();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' })[extension] || 'application/octet-stream';
}

function mediaExtension(record, fallback = 'bin') {
  const fromName = String(record?.name || '').match(/\.([a-z\d]{1,8})$/i)?.[1]?.toLowerCase();
  if (fromName && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  const fromMime = String(record?.mimeType || '').split('/').pop()?.toLowerCase();
  return fromMime === 'jpeg' ? 'jpg' : (['png', 'jpg', 'webp', 'gif'].includes(fromMime) ? fromMime : fallback);
}

function linksFromInput(value) {
  return String(value || '').split(/\r?\n/).map(line => {
    const separator = line.indexOf('|');
    if (separator < 0) return null;
    const label = line.slice(0, separator).trim();
    const url = safePublicUrl(line.slice(separator + 1).trim());
    return label && url ? { label, url } : null;
  }).filter(Boolean).slice(0, 12);
}

function linksToInput(links = [], excludeUrl = '') {
  return links.filter(link => link.url !== excludeUrl).map(link => `${link.label} | ${link.url}`).join('\n');
}

function packageContentPath(value) {
  const safe = safePublicPath(value);
  return safe.startsWith('content/') ? safe.slice('content/'.length) : safe;
}

function packageMediaPath(value) {
  const safe = packageContentPath(value);
  return safe.startsWith('media/') ? safe : '';
}

async function renderMediaPreview(previewId, assetId, fallback, removeId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const previous = previewUrls.get(previewId);
  if (previous) URL.revokeObjectURL(previous);
  previewUrls.delete(previewId);
  preview.replaceChildren();
  let source = '';
  if (assetId) source = await assetUrl(assetId) || '';
  if (!source) source = publicAssetUrl(fallback);
  if (source) {
    const image = node('img', { src: source, alt: '公开素材预览' });
    preview.append(image);
    if (source.startsWith('blob:')) previewUrls.set(previewId, source);
  } else {
    preview.append(node('span', { text: preview.classList.contains('avatar') ? '未选择公开头像' : '未选择封面' }));
  }
  preview.classList.toggle('has-image', Boolean(source));
  if (removeId) document.getElementById(removeId)?.classList.toggle('hidden', !assetId);
}

async function readPublicMedia(file, purpose, ownerId) {
  if (!file) return null;
  if (!/^image\/(?:png|jpe?g|webp)$/i.test(file.type || '') || file.size > MAX_PUBLIC_MEDIA_BYTES) {
    toast('公开图片需为 PNG、JPG 或 WebP，且不超过 12MB', 'error');
    return null;
  }
  return putAsset({
    id: createId('public-media'), kind: 'public-media', publicMediaPurpose: purpose,
    publicContentId: ownerId || null, name: file.name, size: file.size,
    mimeType: file.type, data: file
  });
}

async function itemBody(item) {
  const record = await getAsset(bodyAssetId(item));
  return typeof record?.data === 'string' ? record.data : '';
}

function tagsFromInput(value) {
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function linesFromInput(value) {
  return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function renderDraftList() {
  const state = loadState();
  const filter = document.getElementById('publicDraftFilter').value;
  const items = state.publicContent.filter(item => !filter || item.status === filter).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  document.getElementById('publicDraftSummary').textContent = `${state.publicContent.length} 条本地条目`;
  const list = document.getElementById('publicDraftList');
  list.replaceChildren(...(items.length ? items.map(item => {
    const button = node('button', { class: `public-draft-row${item.id === editingId ? ' active' : ''}`, type: 'button' }, [
      node('span', { class: 'public-draft-row-main' }, [node('strong', { text: item.title }), node('small', { text: `${TYPE_LABELS[item.type] || '内容'} · ${item.slug}` })]),
      node('span', { class: `content-status ${item.status}`, text: STATUS_LABELS[item.status] || item.status })
    ]);
    button.addEventListener('click', () => selectItem(item.id));
    return button;
  }) : [node('div', { class: 'empty-inline' }, [node('p', { text: '还没有本地内容条目。' }), node('small', { text: '可以从公开笔记发布，或在这里新建项目和书评。' })])]));
}

function clearItemForm() {
  document.getElementById('publicItemForm').reset();
  document.getElementById('publicItemState').value = 'draft';
  document.getElementById('publicItemType').value = 'project';
  document.getElementById('publicItemId').value = '';
  document.getElementById('publicItemStatus').textContent = '草稿';
}

async function selectItem(id) {
  const item = loadState().publicContent.find(entry => entry.id === id);
  if (!item) return;
  editingId = id;
  const body = await itemBody(item);
  document.getElementById('publicItemEmpty').classList.add('hidden');
  document.getElementById('publicItemForm').classList.remove('hidden');
  document.getElementById('publicItemId').value = item.id;
  document.getElementById('publicItemType').value = item.type;
  document.getElementById('publicItemState').value = item.status;
  document.getElementById('publicItemTitle').value = item.title;
  document.getElementById('publicItemSlug').value = item.slug;
  document.getElementById('publicItemDate').value = item.publishedAt ? String(item.publishedAt).slice(0, 10) : '';
  document.getElementById('publicItemSummary').value = item.summary;
  document.getElementById('publicItemTags').value = item.tags.join(', ');
  document.getElementById('publicItemCover').value = item.cover;
  document.getElementById('publicItemSource').value = item.sourceUrl;
  document.getElementById('publicItemDemo').value = item.demoUrl;
  document.getElementById('publicItemLinks').value = linksToInput(item.links);
  document.getElementById('publicItemProjectStatus').value = item.projectStatus;
  document.getElementById('publicItemStack').value = item.stack.join(', ');
  document.getElementById('publicItemHighlights').value = item.highlights.join('\n');
  document.getElementById('publicItemAuthor').value = item.author;
  document.getElementById('publicItemReadingDate').value = item.readingDate;
  document.getElementById('publicItemRating').value = item.rating ?? '';
  document.getElementById('publicItemSpoiler').checked = item.spoiler;
  document.getElementById('publicItemBody').value = body;
  document.getElementById('publicItemStatus').textContent = STATUS_LABELS[item.status] || item.status;
  await renderMediaPreview('publicItemCoverPreview', item.coverAssetId, item.cover, 'removePublicItemCover');
  renderDraftList();
  refreshIcons();
}

async function newItem() {
  const id = createId('public');
  const item = normalizePublicContentItem({ id, type: 'project', title: '新建公开内容', status: 'draft', bodyAssetId: `public_${id}` });
  updateState(draft => draft.publicContent.push(item));
  await putAsset({ id: bodyAssetId(item), kind: 'public-content', publicContentId: id, data: '', mimeType: 'text/markdown' });
  await selectItem(id);
  renderDraftList();
}

function readItemForm(existing) {
  const status = document.getElementById('publicItemState').value;
  const title = document.getElementById('publicItemTitle').value.trim() || '未命名内容';
  const date = document.getElementById('publicItemDate').value || (status === 'published' ? new Date().toISOString().slice(0, 10) : null);
  return normalizePublicContentItem({
    ...existing,
    id: existing?.id || document.getElementById('publicItemId').value || createId('public'),
    type: document.getElementById('publicItemType').value,
    status,
    title,
    slug: slugifyPublic(document.getElementById('publicItemSlug').value.trim() || title),
    publishedAt: date,
    summary: document.getElementById('publicItemSummary').value.trim(),
    tags: tagsFromInput(document.getElementById('publicItemTags').value),
    cover: safePublicAssetUrl(document.getElementById('publicItemCover').value),
    coverAssetId: document.getElementById('publicItemCover').value.trim() ? '' : (existing?.coverAssetId || ''),
    sourceUrl: safePublicUrl(document.getElementById('publicItemSource').value, { relative: false }),
    demoUrl: safePublicUrl(document.getElementById('publicItemDemo').value, { relative: false }),
    links: linksFromInput(document.getElementById('publicItemLinks').value),
    projectStatus: document.getElementById('publicItemProjectStatus').value.trim(),
    stack: tagsFromInput(document.getElementById('publicItemStack').value),
    highlights: linesFromInput(document.getElementById('publicItemHighlights').value),
    author: document.getElementById('publicItemAuthor').value.trim(),
    readingDate: document.getElementById('publicItemReadingDate').value,
    rating: document.getElementById('publicItemRating').value,
    spoiler: document.getElementById('publicItemSpoiler').checked,
    bodyAssetId: bodyAssetId(existing || { id: document.getElementById('publicItemId').value })
  });
}

async function saveItem(event) {
  event.preventDefault();
  const state = loadState();
  const existing = state.publicContent.find(item => item.id === editingId);
  const item = readItemForm(existing);
  const duplicate = state.publicContent.find(entry => entry.id !== item.id && entry.type === item.type && entry.slug === item.slug);
  if (duplicate) { toast('同类型内容已经使用这个 Slug', 'error'); return; }
  const body = document.getElementById('publicItemBody').value;
  await putAsset({ id: bodyAssetId(item), kind: 'public-content', publicContentId: item.id, data: body, mimeType: 'text/markdown' });
  updateState(draft => {
    const index = draft.publicContent.findIndex(entry => entry.id === item.id);
    if (index < 0) draft.publicContent.push(item);
    else draft.publicContent[index] = item;
  });
  editingId = item.id;
  document.getElementById('publicItemStatus').textContent = STATUS_LABELS[item.status] || item.status;
  await renderMediaPreview('publicItemCoverPreview', item.coverAssetId, item.cover, 'removePublicItemCover');
  renderDraftList();
  toast('公开内容已保存', 'success');
}

async function deleteItem() {
  if (!editingId || !confirm('确定删除这个本地内容条目？已导出的仓库文件不会自动删除。')) return;
  const item = loadState().publicContent.find(entry => entry.id === editingId);
  await deleteAsset(bodyAssetId(item || { id: editingId }));
  if (item?.coverAssetId) await deleteAsset(item.coverAssetId);
  updateState(draft => { draft.publicContent = draft.publicContent.filter(entry => entry.id !== editingId); });
  editingId = null;
  document.getElementById('publicItemForm').classList.add('hidden');
  document.getElementById('publicItemEmpty').classList.remove('hidden');
  renderDraftList();
  toast('本地内容已删除');
}

async function loadSiteForm() {
  const site = normalizePublicSite(loadState().publicSite);
  document.getElementById('publicSiteName').value = site.name;
  document.getElementById('publicSiteHeadline').value = site.headline;
  document.getElementById('publicSiteBio').value = site.bio;
  document.getElementById('publicSiteFocus').value = site.focus.join(', ');
  const github = site.links.find(link => /github\.com/i.test(link.url));
  document.getElementById('publicSiteGithub').value = github?.url || '';
  document.getElementById('publicSiteLinks').value = linksToInput(site.links, github?.url || '');
  document.getElementById('publicSiteAvatar').value = site.avatar;
  await renderMediaPreview('publicSiteAvatarPreview', site.avatarAssetId, site.avatar, 'removePublicSiteAvatar');
}

function saveSite(event) {
  event.preventDefault();
  const github = safePublicUrl(document.getElementById('publicSiteGithub').value, { relative: false });
  const links = [
    github ? { label: 'GitHub', url: github } : null,
    ...linksFromInput(document.getElementById('publicSiteLinks').value)
  ].filter(Boolean).filter((link, index, list) => list.findIndex(item => item.url === link.url) === index);
  const site = normalizePublicSite({
    ...loadState().publicSite,
    name: document.getElementById('publicSiteName').value.trim(),
    headline: document.getElementById('publicSiteHeadline').value.trim(),
    bio: document.getElementById('publicSiteBio').value.trim(),
    focus: tagsFromInput(document.getElementById('publicSiteFocus').value),
    avatar: safePublicAssetUrl(document.getElementById('publicSiteAvatar').value),
    avatarAssetId: document.getElementById('publicSiteAvatar').value.trim() ? '' : (loadState().publicSite?.avatarAssetId || ''),
    links
  });
  updateState(draft => { draft.publicSite = { ...site, updatedAt: new Date().toISOString() }; });
  toast('公开档案已保存', 'success');
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = node('a', { href: url, download: filename });
  document.body.append(link); link.click();
  setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1000);
}

async function addPublicMediaToZip(zip, assetId, path, warnings) {
  if (!assetId) return false;
  const record = await getAsset(assetId);
  if (!record?.data) {
    warnings.push(`缺少本地素材：${path}`);
    return false;
  }
  zip.file(`content/${path}`, record.data);
  return true;
}

async function buildPublicPackage() {
  if (!globalThis.JSZip) throw new Error('ZIP 组件未加载');
  const state = loadState();
  const zip = new globalThis.JSZip();
  const published = state.publicContent.filter(item => item.status === 'published').map(normalizePublicContentItem);
  const manifestItems = [];
  const warnings = [];
  const site = normalizePublicSite(state.publicSite);
  const manifestSite = publicSiteToManifest(site);
  if (site.avatarAssetId) {
    const path = `media/avatar.${mediaExtension(await getAsset(site.avatarAssetId), 'png')}`;
    if (await addPublicMediaToZip(zip, site.avatarAssetId, path, warnings)) manifestSite.avatar = path;
  }
  for (const item of published) {
    const body = await itemBody(item);
    const bodyPath = `${item.type}s/${item.slug}.md`;
    const manifestItem = publicItemToManifest({ ...item, bodyPath });
    if (item.coverAssetId) {
      const path = `media/covers/${item.type}-${item.slug}.${mediaExtension(await getAsset(item.coverAssetId), 'png')}`;
      if (await addPublicMediaToZip(zip, item.coverAssetId, path, warnings)) manifestItem.cover = path;
    }
    manifestItems.push(manifestItem);
    zip.file(`content/${bodyPath}`, body);
  }
  zip.file('content/manifest.json', JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), items: manifestItems }, null, 2));
  zip.file('content/site.json', JSON.stringify(manifestSite, null, 2));
  zip.file('content/README.md', `# 公开内容发布包\n\n这个包只包含明确标记为“已发布”的内容和用户明确选择的公开图片。请审阅 Markdown、链接和图片后，再将 content/ 目录提交到 GitHub Pages。\n${warnings.length ? `\n## 导出警告\n\n${warnings.map(item => `- ${item}`).join('\\n')}\n` : ''}`);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function exportPublicPackage() {
  try {
    const blob = await buildPublicPackage();
    downloadBlob(`mako-public-content-${new Date().toISOString().slice(0, 10)}.zip`, blob);
    toast('公开发布包已生成，请审阅后提交仓库', 'success');
  } catch (error) { toast(`导出失败：${error.message}`, 'error'); }
}

async function importPublicPackageFile(file) {
  if (!globalThis.JSZip) throw new Error('ZIP 组件未加载');
  const zip = await globalThis.JSZip.loadAsync(file);
  const manifestFile = zip.file('content/manifest.json');
  if (!manifestFile) throw new Error('内容包缺少 content/manifest.json');
  const manifest = JSON.parse(await manifestFile.async('string'));
  if (Number(manifest.version) !== 1 || !Array.isArray(manifest.items)) throw new Error('内容包版本不受支持');
  if (manifest.items.length > 200) throw new Error('内容包条目数量超过 200 条');
  const siteFile = zip.file('content/site.json');
  const site = siteFile ? normalizePublicSite(JSON.parse(await siteFile.async('string'))) : null;
  const importedAssets = [];
  const bodyRecords = [];
  const imported = [];
  const seenIds = new Set();
  if (site?.avatar) {
    const path = packageMediaPath(site.avatar);
    if (path) {
      const mediaFile = zip.file(`content/${path}`);
      if (!mediaFile) throw new Error(`内容包缺少公开头像：${path}`);
      const bytes = await mediaFile.async('uint8array');
      const mimeType = mediaMimeFromPath(path);
      if (!mimeType.startsWith('image/')) throw new Error('公开头像格式不受支持');
      if (bytes.byteLength > MAX_PUBLIC_MEDIA_BYTES) throw new Error('公开头像超过 12MB');
      const id = createId('public-media');
      importedAssets.push({ id, kind: 'public-media', publicMediaPurpose: 'site-avatar', name: path.split('/').pop(), mimeType, data: new Blob([bytes], { type: mimeType }) });
      site.avatarAssetId = id; site.avatar = '';
    }
  }
  for (const raw of manifest.items) {
    const manifestItem = publicItemToManifest(raw);
    const normalized = normalizePublicContentItem({ ...manifestItem, status: 'draft', publishedAt: null });
    if (seenIds.has(normalized.id)) throw new Error(`内容包包含重复条目：${normalized.id}`);
    seenIds.add(normalized.id);
    const bodyPath = packageContentPath(manifestItem.bodyPath);
    const bodyFile = bodyPath ? zip.file(`content/${bodyPath}`) : null;
    if (!bodyFile) throw new Error(`内容包缺少“${normalized.title}”的正文`);
    const bodyBytes = await bodyFile.async('uint8array');
    if (bodyBytes.byteLength > 5 * 1024 * 1024) throw new Error(`内容“${normalized.title}”正文超过 5MB`);
    const body = new TextDecoder().decode(bodyBytes);
    const item = { ...normalized, bodyPath, bodyAssetId: bodyAssetId(normalized), updatedAt: new Date().toISOString() };
    bodyRecords.push({ id: item.bodyAssetId, kind: 'public-content', publicContentId: item.id, data: body, mimeType: 'text/markdown' });
    if (item.cover) {
      const path = packageMediaPath(item.cover);
      if (path) {
        const mediaFile = zip.file(`content/${path}`);
        if (!mediaFile) throw new Error(`内容包缺少“${item.title}”的封面`);
        const bytes = await mediaFile.async('uint8array');
        const mimeType = mediaMimeFromPath(path);
        if (!mimeType.startsWith('image/')) throw new Error(`内容“${item.title}”封面格式不受支持`);
        if (bytes.byteLength > MAX_PUBLIC_MEDIA_BYTES) throw new Error(`内容“${item.title}”封面超过 12MB`);
        const id = createId('public-media');
        importedAssets.push({ id, kind: 'public-media', publicMediaPurpose: 'content-cover', publicContentId: item.id, name: path.split('/').pop(), mimeType, data: new Blob([bytes], { type: mimeType }) });
        item.coverAssetId = id; item.cover = '';
      }
    }
    imported.push({ item, body });
  }
  const recordsToWrite = [...importedAssets, ...bodyRecords];
  const previousAssets = new Map((await Promise.all(recordsToWrite.map(async record => [record.id, await getAsset(record.id)]))).filter(([, record]) => record));
  try {
    for (const record of recordsToWrite) await putAsset(record);
    updateState(draft => {
      if (site) draft.publicSite = site;
      imported.forEach(({ item }) => {
        const index = draft.publicContent.findIndex(entry => entry.id === item.id);
        if (index < 0) draft.publicContent.push(item);
        else draft.publicContent[index] = item;
      });
    });
  } catch (error) {
    await Promise.all(recordsToWrite.map(record => previousAssets.has(record.id) ? putAsset(previousAssets.get(record.id)) : deleteAsset(record.id)));
    throw error;
  }
  await loadSiteForm(); renderDraftList();
  if (imported[0]) await selectItem(imported[0].item.id);
  toast(`已导入 ${imported.length} 条内容草稿`, 'success');
}

document.getElementById('publicSiteForm').addEventListener('submit', saveSite);
document.getElementById('publicItemForm').addEventListener('submit', saveItem);
document.getElementById('newPublicItem').addEventListener('click', () => newItem().catch(error => toast(`新建失败：${error.message}`, 'error')));
document.getElementById('publicDraftFilter').addEventListener('change', renderDraftList);
document.getElementById('deletePublicItem').addEventListener('click', deleteItem);
document.getElementById('previewPublicItem').addEventListener('click', () => {
  document.getElementById('publicPreviewTitle').textContent = document.getElementById('publicItemTitle').value || '公开预览';
  renderPublicMarkdown(document.getElementById('publicPreviewBody'), document.getElementById('publicItemBody').value);
  openDialog('publicPreviewDialog'); refreshIcons();
});
document.getElementById('exportPublicPackage').addEventListener('click', exportPublicPackage);
document.getElementById('importPublicPackage').addEventListener('click', () => document.getElementById('importPublicPackageInput').click());
document.getElementById('importPublicPackageInput').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  try { await importPublicPackageFile(file); } catch (error) { toast(`导入失败：${error.message}`, 'error'); }
});

document.getElementById('uploadPublicSiteAvatar').addEventListener('click', () => document.getElementById('publicSiteAvatarFile').click());
document.getElementById('publicSiteAvatarFile').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  const record = await readPublicMedia(file, 'site-avatar', null);
  if (!record) return;
  const oldId = loadState().publicSite?.avatarAssetId;
  updateState(draft => { draft.publicSite.avatarAssetId = record.id; draft.publicSite.avatar = ''; });
  if (oldId) await deleteAsset(oldId);
  await loadSiteForm(); toast('公开头像已保存到本地', 'success');
});
document.getElementById('removePublicSiteAvatar').addEventListener('click', async () => {
  const site = loadState().publicSite || {};
  if (site.avatarAssetId) await deleteAsset(site.avatarAssetId);
  updateState(draft => { draft.publicSite.avatarAssetId = ''; draft.publicSite.avatar = ''; });
  await loadSiteForm(); toast('公开头像已移除');
});
document.getElementById('uploadPublicItemCover').addEventListener('click', () => {
  if (editingId) document.getElementById('publicItemCoverFile').click();
  else toast('请先选择一个内容条目', 'info');
});
document.getElementById('publicItemCoverFile').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!editingId) return;
  const record = await readPublicMedia(file, 'content-cover', editingId);
  if (!record) return;
  const current = loadState().publicContent.find(item => item.id === editingId);
  if (current?.coverAssetId) await deleteAsset(current.coverAssetId);
  updateState(draft => {
    const item = draft.publicContent.find(entry => entry.id === editingId);
    if (item) { item.coverAssetId = record.id; item.cover = ''; }
  });
  await selectItem(editingId); toast('封面已保存到本地', 'success');
});
document.getElementById('removePublicItemCover').addEventListener('click', async () => {
  if (!editingId) return;
  const item = loadState().publicContent.find(entry => entry.id === editingId);
  if (item?.coverAssetId) await deleteAsset(item.coverAssetId);
  updateState(draft => { const target = draft.publicContent.find(entry => entry.id === editingId); if (target) { target.coverAssetId = ''; target.cover = ''; } });
  await selectItem(editingId); toast('封面已移除');
});

await initApp('settings');
await loadSiteForm();
renderDraftList();
refreshIcons();
