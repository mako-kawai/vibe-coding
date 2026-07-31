import { assetUrl, deleteAsset, getAsset, getAssets, importState, loadState, putAsset, updateState } from './store.js';
import { createId } from './logic.js';
import { applyTheme, applyVisualSettings, icon, initApp, node, openDialog, refreshIcons, toast } from './ui.js';
import { backgroundImageQuality, cropImageFile, selectBackgroundImage } from './image-cropper.js';

const THEMES = [
  { id: 'public', name: '原创 · 物理工作台', description: '燕园红、夜空蓝与原创校园实验室背景。', preview: 'assets/theme-public.png', width: 1536, height: 1024 },
  { id: 'makura', name: '枕社风格', description: '夏日庭院、柔和青绿与文学感标题框。', preview: 'assets/theme-makura.png', width: 1536, height: 1024 },
  { id: 'yuzusoft', name: '柚子社风格', description: '明亮柑橘、青空与现代校园窗口。', preview: 'assets/theme-yuzusoft.png', width: 1536, height: 1024 }
];

let pendingThemeId = null;
let pendingBackup = null;

async function buildBackupBlob(state = loadState(), records = null) {
  if (!globalThis.JSZip) throw new Error('ZIP 组件未加载');
  const assets = records || await getAssets();
  const zip = new globalThis.JSZip();
  zip.file('manifest.json', JSON.stringify({ format: 'mako-learning-backup', version: 2, exportedAt: new Date().toISOString() }, null, 2));
  zip.file('state.json', JSON.stringify(state, null, 2));
  const index = [];
  assets.filter(record => record.kind !== 'snapshot').forEach((record, position) => {
    const extension = record.kind === 'note' ? 'md' : 'bin';
    const path = `assets/${position}_${record.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`;
    zip.file(path, record.data);
    const { data, ...metadata } = record;
    index.push({ ...metadata, path, encoding: typeof record.data === 'string' ? 'text' : 'binary' });
  });
  zip.file('assets/index.json', JSON.stringify(index, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function renderThemeCards() {
  const state = loadState();
  const container = document.getElementById('themeCards');
  const cards = await Promise.all(THEMES.map(async theme => {
    const selected = state.settings.theme === theme.id;
    const localAsset = state.settings.localThemeAssets?.[theme.id];
    const localRecord = localAsset ? await getAsset(localAsset) : null;
    const width = localRecord?.width || theme.width;
    const height = localRecord?.height || theme.height;
    const quality = localRecord?.width ? backgroundImageQuality(width, height) : localAsset ? { level: 'legacy', label: '旧版裁剪图' } : backgroundImageQuality(width, height);
    const card = node('article', { class: `theme-card${selected ? ' selected' : ''}` }, [
      node('div', { class: 'theme-preview', style: `background-image:url('${theme.preview}')` }, [selected ? node('span', { class: 'selected-chip', text: '使用中' }) : null]),
      node('div', { class: 'theme-card-copy' }, [
        node('strong', { text: theme.name }),
        node('p', { text: theme.description }),
        node('span', { class: `image-quality ${quality.level}`, text: localRecord?.width ? `${width}×${height} · ${quality.label}` : localAsset ? '旧版背景 · 建议重新导入原图' : `${width}×${height} · ${quality.label}` }),
        localAsset ? node('span', { class: 'local-asset-label', text: '本地背景' }) : null
      ]),
      node('div', { class: 'theme-card-actions' })
    ]);
    if (localAsset) {
      const localUrl = await assetUrl(localAsset);
      if (localUrl) card.querySelector('.theme-preview').style.backgroundImage = `url("${localUrl}")`;
    }
    const actions = card.querySelector('.theme-card-actions');
    const select = node('button', { class: selected ? 'secondary-action' : 'primary-action', type: 'button' }, [icon('palette'), node('span', { text: selected ? '当前主题' : '使用主题' })]);
    select.disabled = selected;
    select.addEventListener('click', async () => { updateState(draft => { draft.settings.theme = theme.id; }); await applyTheme(theme.id); await renderThemeCards(); });
    const upload = node('button', { class: 'icon-btn', type: 'button', title: '导入本地背景', 'aria-label': `为${theme.name}导入背景` }, [icon('image-up')]);
    upload.addEventListener('click', () => { pendingThemeId = theme.id; document.getElementById('themeAssetInput').click(); });
    actions.append(select, upload);
    if (localAsset) {
      const remove = node('button', { class: 'icon-btn danger-icon', type: 'button', title: '移除本地背景', 'aria-label': `移除${theme.name}本地背景` }, [icon('image-off')]);
      remove.addEventListener('click', async () => {
        await deleteAsset(localAsset);
        updateState(draft => { delete draft.settings.localThemeAssets[theme.id]; });
        await applyTheme(theme.id); await renderThemeCards(); toast('已恢复原创背景');
      });
      actions.append(remove);
    }
    return card;
  }));
  container.replaceChildren(...cards);
  refreshIcons();
}

async function loadForm() {
  const state = loadState();
  document.getElementById('displayName').value = state.profile.displayName || '';
  document.getElementById('department').value = state.profile.department || '';
  document.getElementById('cohort').value = state.profile.cohort || 2025;
  document.getElementById('semesterName').value = state.semester.name || '';
  document.getElementById('semesterStart').value = state.semester.startDate || '';
  document.getElementById('semesterWeeks').value = state.semester.totalWeeks || 18;
  document.getElementById('reduceMotion').checked = Boolean(state.settings.reduceMotion);
  document.getElementById('gpaEnabled').checked = state.settings.gpaEnabled !== false;
  document.getElementById('gpaRule').value = state.settings.gpaRule || 'pku2019';
  document.getElementById('backupDays').value = String(state.settings.backupReminderDays || 7);
  ['themeImageOpacity', 'themeImageSaturation', 'themeImageBrightness', 'themeOverlayOpacity', 'sidebarImageOpacity', 'sidebarImageSaturation', 'sidebarImageBrightness'].forEach(id => {
    document.getElementById(id).value = state.settings[id];
    document.getElementById(`${id}Value`).value = `${state.settings[id]}%`;
  });
  document.querySelectorAll('[data-background-mode]').forEach(button => button.classList.toggle('active', button.dataset.backgroundMode === state.settings.backgroundMode));
  document.getElementById('avatarPreview').querySelector('span').textContent = (state.profile.displayName || 'M').trim().charAt(0).toUpperCase() || 'M';
  const avatarUrl = state.profile.avatarAssetId ? await assetUrl(state.profile.avatarAssetId) : null;
  document.getElementById('avatarPreview').style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : '';
  document.getElementById('avatarPreview').classList.toggle('has-image', Boolean(avatarUrl));
  document.getElementById('removeAvatar').classList.toggle('hidden', !state.profile.avatarAssetId);
  const sidebarUrl = state.settings.sidebarImageAssetId ? await assetUrl(state.settings.sidebarImageAssetId) : null;
  document.getElementById('sidebarImagePreview').style.backgroundImage = sidebarUrl ? `url("${sidebarUrl}")` : '';
  document.getElementById('sidebarImagePreview').classList.toggle('has-image', Boolean(sidebarUrl));
  document.getElementById('removeSidebarImage').classList.toggle('hidden', !state.settings.sidebarImageAssetId);
  document.getElementById('lastBackup').textContent = state.lastBackupAt ? `最近备份：${new Date(state.lastBackupAt).toLocaleString('zh-CN')}` : '还没有导出过完整备份。';
  const snapshots = (await getAssets('snapshot')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  document.getElementById('restoreSnapshot').classList.toggle('hidden', snapshots.length === 0);
  document.getElementById('snapshotStatus').textContent = snapshots[0] ? `最近可恢复快照：${new Date(snapshots[0].updatedAt).toLocaleString('zh-CN')}` : '';
}

async function exportBackup() {
  if (!globalThis.JSZip) { toast('ZIP 组件未加载', 'error'); return; }
  const state = loadState();
  const records = await getAssets();
  const blob = await buildBackupBlob(state, records);
  const link = node('a', { href: URL.createObjectURL(blob), download: `mako-learning-backup-${new Date().toISOString().slice(0, 10)}.zip` });
  document.body.append(link); link.click(); URL.revokeObjectURL(link.href); link.remove();
  updateState(draft => { draft.lastBackupAt = new Date().toISOString(); });
  await loadForm(); toast('完整备份已导出', 'success');
}

async function readBackup(file) {
  if (!globalThis.JSZip) throw new Error('ZIP 组件未加载');
  const zip = await globalThis.JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  const stateFile = zip.file('state.json');
  if (!manifestFile || !stateFile) throw new Error('不是有效的 mako learning 备份');
  const manifest = JSON.parse(await manifestFile.async('string'));
  if (manifest.format !== 'mako-learning-backup' || Number(manifest.version) !== 2) throw new Error('备份版本不受支持');
  const state = JSON.parse(await stateFile.async('string'));
  const indexFile = zip.file('assets/index.json');
  const index = indexFile ? JSON.parse(await indexFile.async('string')) : [];
  return { zip, state, index, manifest };
}

async function restoreAssets(backup, mode) {
  if (mode === 'replace') {
    const current = await getAssets();
    await Promise.all(current.filter(record => record.kind !== 'snapshot').map(record => deleteAsset(record.id)));
  }
  for (const metadata of backup.index) {
    const file = backup.zip.file(metadata.path);
    if (!file) continue;
    const data = metadata.encoding === 'text' ? await file.async('string') : await file.async('uint8array');
    const { path, encoding, ...record } = metadata;
    await putAsset({ ...record, data });
  }
}

async function performRestore(mode) {
  if (!pendingBackup) return;
  try {
    if (mode === 'replace') {
      const snapshot = await buildBackupBlob(loadState(), await getAssets());
      await putAsset({ id: createId('snapshot'), kind: 'snapshot', data: snapshot, mimeType: 'application/zip', reason: 'pre-import' });
    }
    await restoreAssets(pendingBackup, mode);
    importState(pendingBackup.state, mode);
    document.getElementById('backupImportDialog').close();
    toast(mode === 'replace' ? '备份已替换当前数据' : '备份已合并', 'success');
    setTimeout(() => location.reload(), 500);
  } catch (error) { toast(`恢复失败：${error.message}`, 'error'); }
}

document.getElementById('profileForm').addEventListener('submit', async event => {
  event.preventDefault();
  updateState(draft => {
    draft.profile.displayName = document.getElementById('displayName').value.trim();
    draft.profile.department = document.getElementById('department').value.trim();
    draft.profile.cohort = Number(document.getElementById('cohort').value) || 2025;
    draft.semester.name = document.getElementById('semesterName').value.trim();
    draft.semester.startDate = document.getElementById('semesterStart').value;
    draft.semester.totalWeeks = Number(document.getElementById('semesterWeeks').value) || 18;
  });
  await applyTheme();
  await loadForm();
  toast('个人与学期设置已保存', 'success');
});

const themeAssetInput = node('input', { id: 'themeAssetInput', class: 'visually-hidden', type: 'file', accept: 'image/png,image/jpeg,image/webp' });
document.body.append(themeAssetInput);
themeAssetInput.addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file || !pendingThemeId) return;
  if (file.size > 12 * 1024 * 1024) { toast('背景图片不能超过 12MB', 'error'); event.target.value = ''; return; }
  const selection = await selectBackgroundImage(file, { title: '调整桌面与手机背景焦点' });
  event.target.value = '';
  if (!selection) return;
  const oldId = loadState().settings.localThemeAssets?.[pendingThemeId];
  const record = await putAsset({
    id: createId('theme'), kind: 'theme', themeId: pendingThemeId,
    data: selection.data, mimeType: selection.mimeType, name: file.name,
    width: selection.width, height: selection.height, crop: selection.crop, preservesOriginal: true
  });
  updateState(draft => { draft.settings.localThemeAssets[pendingThemeId] = record.id; });
  if (oldId) await deleteAsset(oldId);
  const quality = backgroundImageQuality(selection.width, selection.height);
  await applyTheme(loadState().settings.theme); await renderThemeCards();
  toast(`已保留原图并导入 · ${quality.label}`, quality.level === 'low' ? 'info' : 'success');
});

document.getElementById('uploadAvatar').addEventListener('click', () => document.getElementById('avatarInput').click());
document.getElementById('avatarInput').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) { toast('头像图片不能超过 12MB', 'error'); event.target.value = ''; return; }
  const cropped = await cropImageFile(file, { title: '裁剪个人头像', aspectRatio: 1, outputWidth: 512, outputHeight: 512, shape: 'circle', previewWidth: 460 });
  event.target.value = '';
  if (!cropped) return;
  const oldId = loadState().profile.avatarAssetId;
  const record = await putAsset({ id: createId('avatar'), kind: 'avatar', data: cropped, mimeType: cropped.type, name: file.name });
  updateState(draft => { draft.profile.avatarAssetId = record.id; });
  if (oldId) await deleteAsset(oldId);
  await applyTheme(); await loadForm(); toast('头像已更新', 'success');
});

document.getElementById('removeAvatar').addEventListener('click', async () => {
  const id = loadState().profile.avatarAssetId;
  if (id) await deleteAsset(id);
  updateState(draft => { draft.profile.avatarAssetId = null; });
  await applyTheme(); await loadForm(); toast('头像已移除');
});

document.getElementById('uploadSidebarImage').addEventListener('click', () => document.getElementById('sidebarImageInput').click());
document.getElementById('sidebarImageInput').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) { toast('侧栏图片不能超过 12MB', 'error'); event.target.value = ''; return; }
  const cropped = await cropImageFile(file, { title: '裁剪左侧菜单背景', aspectRatio: 2 / 5, outputWidth: 600, outputHeight: 1500, previewWidth: 260 });
  event.target.value = '';
  if (!cropped) return;
  const oldId = loadState().settings.sidebarImageAssetId;
  const record = await putAsset({ id: createId('sidebar'), kind: 'sidebar', data: cropped, mimeType: cropped.type, name: file.name });
  updateState(draft => { draft.settings.sidebarImageAssetId = record.id; });
  if (oldId) await deleteAsset(oldId);
  await applyTheme(); await loadForm(); toast('侧栏背景已更新', 'success');
});

document.getElementById('removeSidebarImage').addEventListener('click', async () => {
  const id = loadState().settings.sidebarImageAssetId;
  if (id) await deleteAsset(id);
  updateState(draft => { draft.settings.sidebarImageAssetId = null; });
  await applyTheme(); await loadForm(); toast('侧栏背景已移除');
});

['themeImageOpacity', 'themeImageSaturation', 'themeImageBrightness', 'themeOverlayOpacity', 'sidebarImageOpacity', 'sidebarImageSaturation', 'sidebarImageBrightness'].forEach(id => {
  document.getElementById(id).addEventListener('input', event => {
    const value = Number(event.target.value);
    document.getElementById(`${id}Value`).value = `${value}%`;
    const next = updateState(draft => { draft.settings[id] = value; });
    applyVisualSettings(next);
  });
});

document.querySelectorAll('[data-background-mode]').forEach(button => {
  button.addEventListener('click', () => {
    const next = updateState(draft => { draft.settings.backgroundMode = button.dataset.backgroundMode; });
    applyVisualSettings(next);
    document.querySelectorAll('[data-background-mode]').forEach(item => item.classList.toggle('active', item === button));
  });
});

document.getElementById('reduceMotion').addEventListener('change', event => { updateState(draft => { draft.settings.reduceMotion = event.target.checked; }); applyTheme(); });
document.getElementById('gpaEnabled').addEventListener('change', event => { updateState(draft => { draft.settings.gpaEnabled = event.target.checked; }); toast('成绩口径已更新'); });
document.getElementById('gpaRule').addEventListener('change', event => { updateState(draft => { draft.settings.gpaRule = event.target.value; }); toast('GPA 估算规则已更新'); });
document.getElementById('backupDays').addEventListener('change', event => updateState(draft => { draft.settings.backupReminderDays = Number(event.target.value); }));
document.getElementById('exportBackup').addEventListener('click', exportBackup);
document.getElementById('importBackup').addEventListener('click', () => document.getElementById('backupInput').click());
document.getElementById('restoreSnapshot').addEventListener('click', async () => {
  const snapshot = (await getAssets('snapshot')).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  if (!snapshot || !confirm('恢复最近快照会替换当前 V2 数据，确定继续？')) return;
  try { pendingBackup = await readBackup(snapshot.data); await performRestore('replace'); }
  catch (error) { toast(`快照恢复失败：${error.message}`, 'error'); }
});
document.getElementById('backupInput').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    pendingBackup = await readBackup(file);
    const state = pendingBackup.state;
    document.getElementById('backupImportSummary').textContent = `备份包含 ${state.courses?.length || 0} 门课程、${state.tasks?.length || 0} 个任务、${state.notes?.length || 0} 篇笔记和 ${pendingBackup.index.length} 个本地文件。合并会按 ID 更新，替换会先保存当前状态快照。`;
    openDialog('backupImportDialog');
  } catch (error) { toast(`无法读取备份：${error.message}`, 'error'); }
  event.target.value = '';
});
document.getElementById('mergeBackup').addEventListener('click', () => performRestore('merge'));
document.getElementById('replaceBackup').addEventListener('click', () => { if (confirm('替换会清除当前 V2 数据与本地文件。已自动创建状态快照，确定继续？')) performRestore('replace'); });

await initApp('settings'); await loadForm(); await renderThemeCards(); refreshIcons();
