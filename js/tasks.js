import { courseById, loadState, updateState } from './store.js';
import { createId, formatDateTime, getDueState, PRIORITIES, sortTasks, TASK_TYPES, taskStats } from './logic.js';
import { fillCourseOptions, icon, initApp, node, openDialog, refreshIcons, toast } from './ui.js';

let statusFilter = 'active';
let editingId = null;

function focusSeconds(session, now = Date.now()) {
  if (!session) return 0;
  const accumulated = Number(session.accumulatedSeconds) || 0;
  if (!session.running || !session.startedAt) return accumulated;
  return accumulated + Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000));
}

function focusTimeLabel(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function renderFocusBar() {
  const state = loadState();
  const session = state.focusSession;
  const bar = document.getElementById('focusBar');
  bar.classList.toggle('hidden', !session);
  if (!session) return;
  const task = state.tasks.find(item => item.id === session.taskId);
  document.getElementById('focusTaskTitle').textContent = task?.title || '任务已不存在';
  document.getElementById('focusEstimate').textContent = `预计 ${task?.estimateMinutes || 0} 分钟 · 已记录 ${task?.actualMinutes || 0} 分钟`;
  document.getElementById('focusClock').textContent = focusTimeLabel(focusSeconds(session));
  document.getElementById('pauseFocusButton').classList.toggle('hidden', !session.running);
  document.getElementById('resumeFocusButton').classList.toggle('hidden', session.running);
}

function startFocus(task) {
  const current = loadState().focusSession;
  if (current?.taskId === task.id) return;
  if (current && !confirm('当前已有专注会话。切换任务会先结束但不记录当前会话，确定继续？')) return;
  updateState(draft => {
    const startedAt = new Date().toISOString();
    draft.focusSession = { taskId: task.id, startedAt, initialStartedAt: startedAt, accumulatedSeconds: 0, running: true };
  });
  render();
  toast(`已开始专注：${task.title}`, 'success');
}

function pauseFocus() {
  updateState(draft => {
    const session = draft.focusSession;
    if (!session?.running) return;
    session.accumulatedSeconds = focusSeconds(session);
    session.startedAt = null;
    session.running = false;
  });
  renderFocusBar();
}

function resumeFocus() {
  updateState(draft => {
    if (!draft.focusSession || draft.focusSession.running) return;
    draft.focusSession.startedAt = new Date().toISOString();
    draft.focusSession.running = true;
  });
  renderFocusBar();
}

function finishFocus() {
  const current = loadState().focusSession;
  if (!current) return;
  const seconds = focusSeconds(current);
  const minutes = Math.max(1, Math.round(seconds / 60));
  updateState(draft => {
    const task = draft.tasks.find(item => item.id === current.taskId);
    if (task) {
      task.actualMinutes = (Number(task.actualMinutes) || 0) + minutes;
      task.focusSessions = [...(task.focusSessions || []), { startedAt: current.initialStartedAt || current.startedAt, durationSeconds: seconds, completedAt: new Date().toISOString() }];
      task.updatedAt = new Date().toISOString();
    }
    draft.focusSession = null;
  });
  render();
  toast(`已记录 ${minutes} 分钟专注`, 'success');
}

function localInputValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function openTask(task = null) {
  const state = loadState();
  editingId = task?.id || null;
  document.getElementById('taskDialogTitle').textContent = task ? '编辑任务' : '新建任务';
  document.getElementById('taskId').value = task?.id || '';
  document.getElementById('taskTitle').value = task?.title || '';
  fillCourseOptions(document.getElementById('taskCourse'), { includeAll: true });
  document.getElementById('taskCourse').value = task?.courseId || '';
  document.getElementById('taskType').value = task?.type || new URLSearchParams(location.search).get('type') || 'homework';
  document.getElementById('taskDueAt').value = localInputValue(task?.dueAt);
  document.getElementById('taskPriority').value = task?.priority || 'medium';
  document.getElementById('taskEstimate').value = task?.estimateMinutes ?? 60;
  document.getElementById('taskProgress').value = task?.progress ?? 0;
  document.getElementById('taskTags').value = (task?.tags || []).join(', ');
  document.getElementById('taskSubtasks').value = (task?.subtasks || []).map(item => item.title).join('\n');
  document.getElementById('taskDescription').value = task?.description || '';
  document.getElementById('deleteTaskButton').classList.toggle('hidden', !task);
  openDialog('taskDialog');
  document.getElementById('taskTitle').focus();
}

function taskRow(task, state) {
  const course = courseById(state, task.courseId);
  const due = getDueState(task.dueAt);
  const checkbox = node('input', { type: 'checkbox', checked: task.status === 'done' ? '' : null, 'aria-label': `完成 ${task.title}` });
  checkbox.checked = task.status === 'done';
  checkbox.addEventListener('change', () => {
    updateState(draft => {
      const target = draft.tasks.find(item => item.id === task.id);
      target.status = checkbox.checked ? 'done' : 'todo';
      target.progress = checkbox.checked ? 100 : Math.min(target.progress || 0, 99);
      target.completedAt = checkbox.checked ? new Date().toISOString() : null;
    });
    render();
  });
  const edit = node('button', { class: 'icon-btn', type: 'button', title: '编辑任务', 'aria-label': `编辑 ${task.title}` }, [icon('pencil')]);
  edit.addEventListener('click', () => openTask(task));
  const focusing = state.focusSession?.taskId === task.id;
  const focus = node('button', { class: 'icon-btn', type: 'button', title: focusing ? '正在专注' : '开始专注', 'aria-label': `${focusing ? '正在专注' : '开始专注'} ${task.title}`, disabled: focusing ? '' : null }, [icon(focusing ? 'timer' : 'play')]);
  focus.addEventListener('click', () => startFocus(task));
  const progress = node('span', { class: 'task-progress-fill' });
  progress.style.width = `${task.progress || 0}%`;
  const subtasks = (task.subtasks || []).map(subtask => {
    const input = node('input', { type: 'checkbox', 'aria-label': `完成子任务 ${subtask.title}` });
    input.checked = Boolean(subtask.done);
    input.addEventListener('change', () => {
      updateState(draft => {
        const target = draft.tasks.find(item => item.id === task.id);
        const targetSubtask = target.subtasks.find(item => item.id === subtask.id);
        targetSubtask.done = input.checked;
        const completed = target.subtasks.filter(item => item.done).length;
        target.progress = Math.round(completed / target.subtasks.length * 100);
        target.status = completed === target.subtasks.length ? 'done' : 'todo';
        target.completedAt = target.status === 'done' ? new Date().toISOString() : null;
      });
      render();
    });
    return node('label', { class: 'subtask-item' }, [input, node('span', { text: subtask.title })]);
  });
  return node('article', { class: `task-row ${task.status === 'done' ? 'completed' : ''}` }, [
    node('label', { class: 'task-checkbox' }, [checkbox, node('span')]),
    node('div', { class: 'task-row-main' }, [
      node('div', { class: 'task-title-line' }, [node('strong', { text: task.title }), node('span', { class: `priority priority-${task.priority}`, text: `${PRIORITIES[task.priority] || '中'}优先级` })]),
      node('div', { class: 'task-meta' }, [node('span', { text: course?.name || '未关联课程' }), node('span', { text: TASK_TYPES[task.type] || task.type }), node('span', { class: `due-text ${due.key}`, text: `${formatDateTime(task.dueAt)} · ${due.label}` }), node('span', { text: `预计 ${task.estimateMinutes || 0} 分钟` }), task.actualMinutes ? node('span', { text: `实际 ${task.actualMinutes} 分钟` }) : null]),
      node('div', { class: 'task-progress' }, [progress]),
      task.subtasks?.length ? node('details', { class: 'subtask-list' }, [
        node('summary', { text: `${task.subtasks.filter(item => item.done).length}/${task.subtasks.length} 子任务` }),
        ...subtasks
      ]) : null
    ]),
    node('div', { class: 'task-row-actions' }, task.status === 'done' ? [edit] : [focus, edit])
  ]);
}

function render() {
  const state = loadState();
  renderFocusBar();
  fillCourseOptions(document.getElementById('courseFilter'), { includeAll: true });
  const course = document.getElementById('courseFilter').value;
  const type = document.getElementById('typeFilter').value;
  const query = document.getElementById('taskSearch').value.trim().toLowerCase();
  let tasks = state.tasks.filter(task => {
    if (statusFilter === 'active' && task.status === 'done') return false;
    if (statusFilter === 'done' && task.status !== 'done') return false;
    if (course && task.courseId !== course) return false;
    if (type && task.type !== type) return false;
    return !query || `${task.title} ${task.description || ''} ${(task.tags || []).join(' ')}`.toLowerCase().includes(query);
  });
  tasks = sortTasks(tasks);
  const stats = taskStats(tasks);
  document.getElementById('taskSummary').textContent = `${tasks.length} 个任务 · ${stats.overdue} 个逾期`;
  document.getElementById('workloadSummary').textContent = `预计 ${(stats.estimatedMinutes / 60).toFixed(1)} 小时`;
  const completedCount = state.tasks.filter(task => task.status === 'done').length;
  const clearButton = document.getElementById('deleteCompletedButton');
  clearButton.classList.toggle('hidden', completedCount === 0);
  clearButton.lastChild.textContent = `清空已完成 (${completedCount})`;
  const list = document.getElementById('taskList');
  list.replaceChildren(...(tasks.length ? tasks.map(task => taskRow(task, state)) : [node('div', { class: 'empty-state' }, [icon('list-checks'), node('h2', { text: '没有符合筛选条件的任务' }), node('p', { text: '清空筛选或新建任务。' })])]));
  refreshIcons();
}

document.getElementById('taskForm').addEventListener('submit', event => {
  event.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) return;
  const lines = document.getElementById('taskSubtasks').value.split('\n').map(value => value.trim()).filter(Boolean);
  updateState(draft => {
    const existing = editingId ? draft.tasks.find(task => task.id === editingId) : null;
    const previous = new Map((existing?.subtasks || []).map(item => [item.title, item]));
    const progress = Number(document.getElementById('taskProgress').value) || 0;
    const payload = {
      id: editingId || createId('task'), title,
      courseId: document.getElementById('taskCourse').value || null,
      type: document.getElementById('taskType').value,
      dueAt: document.getElementById('taskDueAt').value ? new Date(document.getElementById('taskDueAt').value).toISOString() : null,
      priority: document.getElementById('taskPriority').value,
      estimateMinutes: Number(document.getElementById('taskEstimate').value) || 0,
      progress, status: progress >= 100 ? 'done' : existing?.status === 'done' ? 'todo' : existing?.status || 'todo',
      tags: document.getElementById('taskTags').value.split(',').map(value => value.trim()).filter(Boolean),
      subtasks: lines.map(line => previous.get(line) || { id: createId('subtask'), title: line, done: false }),
      description: document.getElementById('taskDescription').value.trim(),
      createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    if (existing) Object.assign(existing, payload); else draft.tasks.push(payload);
  });
  document.getElementById('taskDialog').close();
  render(); toast(editingId ? '任务已更新' : '任务已创建', 'success');
});

document.getElementById('deleteTaskButton').addEventListener('click', () => {
  if (!editingId || !confirm('确定删除这个任务？')) return;
  updateState(draft => { draft.tasks = draft.tasks.filter(task => task.id !== editingId); });
  updateState(draft => { if (draft.focusSession?.taskId === editingId) draft.focusSession = null; });
  document.getElementById('taskDialog').close(); render(); toast('任务已删除');
});

document.getElementById('deleteCompletedButton').addEventListener('click', () => {
  const state = loadState();
  const completed = state.tasks.filter(task => task.status === 'done');
  if (!completed.length || !confirm(`确定删除全部 ${completed.length} 个已完成任务？此操作不能撤销。`)) return;
  const deletedIds = new Set(completed.map(task => task.id));
  updateState(draft => {
    draft.tasks = draft.tasks.filter(task => !deletedIds.has(task.id));
    if (draft.focusSession && deletedIds.has(draft.focusSession.taskId)) draft.focusSession = null;
  });
  render();
  toast(`已删除 ${completed.length} 个已完成任务`, 'success');
});

document.getElementById('addTaskButton').addEventListener('click', () => openTask());
document.querySelectorAll('#statusFilters button').forEach(button => button.addEventListener('click', () => {
  statusFilter = button.dataset.status;
  document.querySelectorAll('#statusFilters button').forEach(item => item.classList.toggle('active', item === button));
  render();
}));
['courseFilter', 'typeFilter'].forEach(id => document.getElementById(id).addEventListener('change', render));
document.getElementById('taskSearch').addEventListener('input', render);
document.getElementById('pauseFocusButton').addEventListener('click', pauseFocus);
document.getElementById('resumeFocusButton').addEventListener('click', resumeFocus);
document.getElementById('finishFocusButton').addEventListener('click', finishFocus);
setInterval(() => { if (loadState().focusSession?.running) renderFocusBar(); }, 1000);

await initApp('tasks');
render();
const params = new URLSearchParams(location.search);
if (params.get('q')) document.getElementById('taskSearch').value = params.get('q');
if (params.get('course')) document.getElementById('courseFilter').value = params.get('course');
if (params.get('new') === '1') openTask(); else render();
