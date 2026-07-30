import { assetUrl, deleteAsset, getAsset, getAssets, loadState, putAsset, updateState } from './store.js';
import { createId } from './logic.js';
import { fillCourseOptions, icon, initApp, node, refreshIcons, toast } from './ui.js';

const DERIVATION_TEMPLATE = `# 推导目标

> 用一句话写明需要证明或计算的结果。

## 定义与符号

- \\(q_i\\)：广义坐标
- \\(L=T-V\\)：拉格朗日量

## 假设

1. 系统满足……
2. 忽略……

## 分步推导

从作用量出发：

$$
S[q] = \\int_{t_1}^{t_2} L(q, \\dot q, t)\\,dt
$$

1. 写出变分。
2. 分部积分并处理边界项。
3. 得到欧拉-拉格朗日方程。

## 结论

$$
\\frac{d}{dt}\\frac{\\partial L}{\\partial \\dot q_i}-\\frac{\\partial L}{\\partial q_i}=0
$$

## 检查

- [ ] 量纲一致
- [ ] 边界条件已说明
- [ ] 极限情形合理
`;

let currentId = null;
let contentCache = new Map();
let dirty = false;

function renderMarkdown(content) {
  const preview = document.getElementById('notePreview');
  if (!globalThis.marked || !globalThis.DOMPurify) {
    preview.textContent = content;
    return;
  }
  const raw = globalThis.marked.parse(content || '', { breaks: true, gfm: true });
  preview.innerHTML = globalThis.DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload']
  });
  preview.querySelectorAll('a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (/^javascript:/i.test(href)) link.removeAttribute('href');
    else if (/^https?:/i.test(href)) { link.target = '_blank'; link.rel = 'noopener'; }
  });
  globalThis.renderMathInElement?.(preview, {
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

async function loadCaches() {
  const records = await getAssets('note');
  contentCache = new Map(records.map(record => [record.noteId, typeof record.data === 'string' ? record.data : '']));
}

function noteMatches(note, query) {
  const haystack = `${note.title} ${note.chapter || ''} ${(note.tags || []).join(' ')} ${contentCache.get(note.id) || ''}`.toLowerCase();
  return haystack.includes(query);
}

function renderList() {
  const state = loadState();
  fillCourseOptions(document.getElementById('noteCourseFilter'), { includeAll: true });
  const courseId = document.getElementById('noteCourseFilter').value;
  const query = document.getElementById('noteSearch').value.trim().toLowerCase();
  const notes = [...state.notes]
    .filter(note => (!courseId || note.courseId === courseId) && (!query || noteMatches(note, query)))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const list = document.getElementById('noteList');
  list.replaceChildren(...(notes.length ? notes.map(note => {
    const course = state.courses.find(item => item.id === note.courseId);
    const button = node('button', { class: `note-index-item${currentId === note.id ? ' active' : ''}`, type: 'button' }, [
      node('strong', { text: note.title }),
      node('span', { text: note.chapter || course?.name || '未分类' }),
      node('small', { text: new Date(note.updatedAt).toLocaleDateString('zh-CN') })
    ]);
    button.addEventListener('click', () => selectNote(note.id));
    return button;
  }) : [node('div', { class: 'empty-inline' }, [node('p', { text: '还没有笔记。' })])]));
}

async function selectNote(id) {
  if (dirty && !confirm('当前笔记尚未保存，确定切换？')) return;
  const state = loadState();
  const note = state.notes.find(item => item.id === id);
  if (!note) return;
  currentId = id;
  let content = contentCache.get(id);
  if (content === undefined) {
    const record = await getAsset(`note_${id}`);
    content = typeof record?.data === 'string' ? record.data : '';
    contentCache.set(id, content);
  }
  document.getElementById('emptyNote').classList.add('hidden');
  document.getElementById('noteDocument').classList.remove('hidden');
  document.getElementById('noteTitle').value = note.title;
  document.getElementById('noteChapter').value = note.chapter || '';
  document.getElementById('noteTags').value = (note.tags || []).join(', ');
  document.getElementById('noteContent').value = content;
  renderMarkdown(content);
  dirty = false;
  updateStatus(); renderList(); await renderAttachments(); refreshIcons();
}

async function renderAttachments() {
  const list = document.getElementById('attachmentList');
  if (!currentId) { list.replaceChildren(); return; }
  const records = (await getAssets('file')).filter(record => record.noteId === currentId);
  const rows = await Promise.all(records.map(async record => {
    const href = await assetUrl(record.id);
    const remove = node('button', { class: 'icon-btn', type: 'button', title: '删除附件', 'aria-label': `删除 ${record.name}` }, [icon('x')]);
    remove.addEventListener('click', async () => {
      if (!confirm(`确定删除附件“${record.name}”？`)) return;
      await deleteAsset(record.id); await renderAttachments(); refreshIcons();
    });
    return node('div', { class: 'attachment-row' }, [
      node('a', { href, download: record.name }, [icon('file'), node('span', { text: record.name })]),
      node('small', { text: `${Math.max(1, Math.round((record.size || 0) / 1024))} KB` }), remove
    ]);
  }));
  list.replaceChildren(...(rows.length ? rows : [node('span', { class: 'muted', text: '暂无附件' })]));
}

function updateStatus() {
  const content = document.getElementById('noteContent').value;
  document.getElementById('noteStatus').textContent = dirty ? '有未保存更改' : '已保存到本地';
  document.getElementById('noteWordCount').textContent = `${content.replace(/\s/g, '').length} 字`;
}

async function saveNote() {
  if (!currentId) return;
  const title = document.getElementById('noteTitle').value.trim() || '未命名笔记';
  const content = document.getElementById('noteContent').value;
  updateState(draft => {
    const note = draft.notes.find(item => item.id === currentId);
    Object.assign(note, {
      title, chapter: document.getElementById('noteChapter').value.trim(),
      tags: document.getElementById('noteTags').value.split(',').map(value => value.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    });
  });
  await putAsset({ id: `note_${currentId}`, kind: 'note', noteId: currentId, data: content, mimeType: 'text/markdown' });
  contentCache.set(currentId, content); dirty = false; updateStatus(); renderList(); toast('笔记已保存', 'success');
}

function createNote() {
  const state = loadState();
  const courseId = document.getElementById('noteCourseFilter').value || state.courses.find(course => course.status === 'active')?.id || null;
  const id = createId('note');
  updateState(draft => draft.notes.push({ id, courseId, title: '新建推导笔记', chapter: '', tags: [], updatedAt: new Date().toISOString() }));
  contentCache.set(id, ''); selectNote(id);
}

document.getElementById('noteContent').addEventListener('input', event => {
  dirty = true; renderMarkdown(event.target.value); updateStatus();
});
['noteTitle', 'noteChapter', 'noteTags'].forEach(id => document.getElementById(id).addEventListener('input', () => { dirty = true; updateStatus(); }));
document.getElementById('saveNoteButton').addEventListener('click', saveNote);
document.getElementById('addNoteButton').addEventListener('click', createNote);
document.getElementById('addAttachmentButton').addEventListener('click', () => document.getElementById('attachmentInput').click());
document.getElementById('attachmentInput').addEventListener('change', async event => {
  if (!currentId) return;
  for (const file of event.target.files) {
    if (file.size > 25 * 1024 * 1024) { toast(`${file.name} 超过 25 MB，已跳过`, 'error'); continue; }
    await putAsset({ id: createId('file'), kind: 'file', noteId: currentId, name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream', data: file });
  }
  event.target.value = ''; await renderAttachments(); refreshIcons(); toast('附件已保存到本地', 'success');
});
document.getElementById('insertTemplateButton').addEventListener('click', () => {
  const textarea = document.getElementById('noteContent');
  if (textarea.value.trim() && !confirm('插入模板会追加到当前内容，确定继续？')) return;
  textarea.value = textarea.value.trim() ? `${textarea.value}\n\n${DERIVATION_TEMPLATE}` : DERIVATION_TEMPLATE;
  textarea.dispatchEvent(new Event('input'));
});
document.getElementById('deleteNoteButton').addEventListener('click', async () => {
  if (!currentId || !confirm('确定删除这篇笔记？')) return;
  const deleted = currentId;
  updateState(draft => { draft.notes = draft.notes.filter(note => note.id !== deleted); });
  await deleteAsset(`note_${deleted}`);
  const attachments = (await getAssets('file')).filter(record => record.noteId === deleted);
  await Promise.all(attachments.map(record => deleteAsset(record.id)));
  contentCache.delete(deleted); currentId = null; dirty = false;
  document.getElementById('noteDocument').classList.add('hidden'); document.getElementById('emptyNote').classList.remove('hidden'); renderList();
});
document.getElementById('noteCourseFilter').addEventListener('change', renderList);
document.getElementById('noteSearch').addEventListener('input', renderList);
document.querySelectorAll('.mobile-editor-tabs button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.mobile-editor-tabs button').forEach(item => item.classList.toggle('active', item === button));
  document.querySelector('.split-editor').dataset.mobilePane = button.dataset.pane;
}));
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

await initApp('notes');
await loadCaches(); renderList();
const params = new URLSearchParams(location.search);
if (params.get('course')) document.getElementById('noteCourseFilter').value = params.get('course');
const requested = params.get('note') || params.get('id') || loadState().notes[0]?.id;
if (requested) await selectNote(requested);
