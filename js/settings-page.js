import { deleteAsset, getAssets, importState, loadState, putAsset, updateState } from './store.js';
import { createId } from './logic.js';
import { applyTheme, icon, initApp, node, openDialog, refreshIcons, toast } from './ui.js';

const THEMES = [
  { id: 'public', name: '原创 · 物理工作台', description: '燕园红、夜空蓝与原创校园实验室背景。', preview: 'assets/theme-public.png' },
  { id: 'makura', name: '枕社风格', description: '夏日庭院、柔和青绿与文学感标题框。', preview: 'assets/theme-makura.png' },
  { id: 'yuzusoft', name: '柚子社风格', description: '明亮柑橘、青空与现代校园窗口。', preview: 'assets/theme-yuzusoft.png' }
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

function renderThemeCards() {
  const state = loadState();
  const container = document.getElementById('themeCards');
  container.replaceChildren(...THEMES.map(theme => {
    const selected = state.settings.theme === theme.id;
    const localAsset = state.settings.localThemeAssets?.[theme.id];
    const card = node('article', { class: `theme-card${selected ? ' selected' : ''}` }, [
      node('div', { class: 'theme-preview', style: `background-image:url('${theme.preview}')` }, [selected ? node('span', { class: 'selected-chip', text: '使用中' }) : null]),
      node('div', { class: 'theme-card-copy' }, [node('strong', { text: theme.name }), node('p', { text: theme.description }), localAsset ? node('span', { class: 'local-asset-label', text: '已导入本地背景' }) : null]),
      node('div', { class: 'theme-card-actions' })
    ]);
    const actions = card.querySelector('.theme-card-actions');
    const select = node('button', { class: selected ? 'secondary-action' : 'primary-action', type: 'button' }, [icon('palette'), node('span', { text: selected ? '当前主题' : '使用主题' })]);
    select.disabled = selected;
    select.addEventListener('click', () => { updateState(draft => { draft.settings.theme = theme.id; }); applyTheme(theme.id); renderThemeCards(); });
    const upload = node('button', { class: 'icon-btn', type: 'button', title: '导入本地背景', 'aria-label': `为${theme.name}导入背景` }, [icon('image-up')]);
    upload.addEventListener('click', () => { pendingThemeId = theme.id; document.getElementById('themeAssetInput').click(); });
    actions.append(select, upload);
    if (localAsset) {
      const remove = node('button', { class: 'icon-btn danger-icon', type: 'button', title: '移除本地背景', 'aria-label': `移除${theme.name}本地背景` }, [icon('image-off')]);
      remove.addEventListener('click', async () => {
        await deleteAsset(localAsset);
        updateState(draft => { delete draft.settings.localThemeAssets[theme.id]; });
        await applyTheme(theme.id); renderThemeCards(); toast('已恢复原创背景');
      });
      actions.append(remove);
    }
    return card;
  }));
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

document.getElementById('profileForm').addEventListener('submit', event => {
  event.preventDefault();
  updateState(draft => {
    draft.profile.displayName = document.getElementById('displayName').value.trim();
    draft.profile.department = document.getElementById('department').value.trim();
    draft.profile.cohort = Number(document.getElementById('cohort').value) || 2025;
    draft.semester.name = document.getElementById('semesterName').value.trim();
    draft.semester.startDate = document.getElementById('semesterStart').value;
    draft.semester.totalWeeks = Number(document.getElementById('semesterWeeks').value) || 18;
  });
  toast('个人与学期设置已保存', 'success');
});

const themeAssetInput = node('input', { id: 'themeAssetInput', class: 'visually-hidden', type: 'file', accept: 'image/png,image/jpeg,image/webp' });
document.body.append(themeAssetInput);
themeAssetInput.addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file || !pendingThemeId) return;
  if (file.size > 12 * 1024 * 1024) { toast('背景图片不能超过 12MB', 'error'); return; }
  const oldId = loadState().settings.localThemeAssets?.[pendingThemeId];
  const record = await putAsset({ id: createId('theme'), kind: 'theme', themeId: pendingThemeId, data: file, mimeType: file.type, name: file.name });
  updateState(draft => { draft.settings.localThemeAssets[pendingThemeId] = record.id; });
  if (oldId) await deleteAsset(oldId);
  await applyTheme(loadState().settings.theme); renderThemeCards(); toast('本地背景已导入', 'success'); event.target.value = '';
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

await initApp('settings'); await loadForm(); renderThemeCards(); refreshIcons();
