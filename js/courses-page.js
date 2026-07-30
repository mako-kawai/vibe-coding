import { loadState, updateState } from './store.js';
import { createId, formatDateTime } from './logic.js';
import { icon, initApp, node, openDialog, refreshIcons, toast } from './ui.js';

let statusFilter = 'active';
let editingId = null;

function openCourse(course = null) {
  editingId = course?.id || null;
  document.getElementById('courseDialogTitle').textContent = course ? '编辑课程' : '添加课程';
  document.getElementById('courseName').value = course?.name || '';
  document.getElementById('courseCode').value = course?.code || '';
  document.getElementById('courseCreditsInput').value = course?.credits ?? 4;
  document.getElementById('courseCategory').value = course?.category || '';
  document.getElementById('courseStatus').value = course?.status || 'active';
  document.getElementById('courseColor').value = course?.color || '#b5474d';
  document.getElementById('courseResource').value = course?.resourceUrl || '';
  document.getElementById('courseDescription').value = course?.description || '';
  document.getElementById('deleteCourseButton').classList.toggle('hidden', !course);
  openDialog('courseDialog');
}

function overviewSection(title, items, emptyText) {
  return node('section', { class: 'course-overview-section' }, [
    node('h3', { text: title }),
    items.length ? node('div', { class: 'overview-list' }, items) : node('p', { class: 'muted', text: emptyText })
  ]);
}

function openCourseOverview(course) {
  const state = loadState();
  const tasks = state.tasks.filter(task => task.courseId === course.id && task.status !== 'done');
  const notes = state.notes.filter(note => note.courseId === course.id);
  const events = state.schedule.filter(event => event.courseId === course.id);
  const grades = state.grades.filter(grade => grade.courseId === course.id);
  document.getElementById('overviewCourseName').textContent = course.name;
  document.getElementById('courseOverviewContent').replaceChildren(
    node('div', { class: 'overview-quick-links' }, [
      node('a', { class: 'secondary-action', href: `tasks.html?course=${course.id}` }, [icon('list-checks'), node('span', { text: '全部任务' })]),
      node('a', { class: 'secondary-action', href: `notes.html?course=${course.id}` }, [icon('notebook-pen'), node('span', { text: '课程笔记' })]),
      course.resourceUrl ? node('a', { class: 'secondary-action', href: course.resourceUrl }, [icon('folder-open'), node('span', { text: '课程资料' })]) : null
    ]),
    overviewSection('待办任务', tasks.map(task => node('a', { class: 'overview-row', href: `tasks.html?q=${encodeURIComponent(task.title)}` }, [node('strong', { text: task.title }), node('span', { text: formatDateTime(task.dueAt) })])), '没有未完成任务。'),
    overviewSection('笔记', notes.map(note => node('a', { class: 'overview-row', href: `notes.html?note=${note.id}` }, [node('strong', { text: note.title }), node('span', { text: note.chapter || '未设置章节' })])), '还没有课程笔记。'),
    overviewSection('课表', events.map(event => node('a', { class: 'overview-row', href: 'schedule.html' }, [node('strong', { text: event.title }), node('span', { text: `${formatDateTime(event.startAt)} · ${event.location || '地点未设置'}` })])), '还没有关联日程。'),
    overviewSection('正式成绩', grades.map(grade => node('a', { class: 'overview-row', href: 'grades.html' }, [node('strong', { text: `${grade.value || grade.status || '--'}` }), node('span', { text: `${grade.term || state.semester.name} · ${grade.credits || course.credits || 0} 学分` })])), '尚未录入正式成绩。')
  );
  openDialog('courseOverviewDialog');
  refreshIcons();
}

function courseCard(course, state) {
  const tasks = state.tasks.filter(task => task.courseId === course.id && task.status !== 'done');
  const notes = state.notes.filter(note => note.courseId === course.id);
  const grade = state.grades.find(item => item.courseId === course.id);
  const edit = node('button', { class: 'icon-btn', type: 'button', title: '编辑课程', 'aria-label': `编辑 ${course.name}` }, [icon('pencil')]);
  edit.addEventListener('click', () => openCourse(course));
  return node('article', { class: 'course-card', style: `--course-color:${course.color || '#8f2f3a'}` }, [
    node('div', { class: 'course-card-accent' }),
    node('div', { class: 'course-card-head' }, [node('span', { class: 'course-code', text: course.code || 'NO CODE' }), edit]),
    node('div', { class: 'course-card-body' }, [node('h2', { text: course.name }), node('p', { text: course.description || '暂未填写课程说明。' })]),
    node('div', { class: 'course-stats' }, [
      node('span', {}, [node('strong', { text: String(course.credits || 0) }), node('small', { text: '学分' })]),
      node('span', {}, [node('strong', { text: String(tasks.length) }), node('small', { text: '待办' })]),
      node('span', {}, [node('strong', { text: String(notes.length) }), node('small', { text: '笔记' })]),
      node('span', {}, [node('strong', { text: grade ? String(grade.value) : '--' }), node('small', { text: '成绩' })])
    ]),
    node('div', { class: 'course-card-links' }, [
      (() => { const button = node('button', { type: 'button', class: 'text-link' }, [node('span', { text: '概览' }), icon('panels-top-left')]); button.addEventListener('click', () => openCourseOverview(course)); return button; })(),
      node('a', { href: `tasks.html?course=${course.id}`, class: 'text-link' }, [node('span', { text: '任务' }), icon('arrow-right')]),
      node('a', { href: `notes.html?course=${course.id}`, class: 'text-link' }, [node('span', { text: '笔记' }), icon('arrow-right')]),
      course.resourceUrl ? node('a', { href: course.resourceUrl, class: 'text-link' }, [node('span', { text: '资料' }), icon('external-link')]) : null
    ])
  ]);
}

function render() {
  const state = loadState();
  const query = document.getElementById('courseSearch').value.trim().toLowerCase();
  const courses = state.courses.filter(course => {
    if (statusFilter !== 'all' && course.status !== statusFilter) return false;
    return !query || `${course.name} ${course.code || ''} ${course.category || ''}`.toLowerCase().includes(query);
  });
  const grid = document.getElementById('courseGrid');
  grid.replaceChildren(...(courses.length ? courses.map(course => courseCard(course, state)) : [node('div', { class: 'empty-state panel' }, [icon('library-big'), node('h2', { text: '没有符合条件的课程' }), node('p', { text: '调整筛选或添加课程。' })])]));
  refreshIcons();
}

document.getElementById('courseForm').addEventListener('submit', event => {
  event.preventDefault();
  updateState(draft => {
    const existing = editingId ? draft.courses.find(course => course.id === editingId) : null;
    const payload = {
      id: editingId || createId('course'), name: document.getElementById('courseName').value.trim(),
      code: document.getElementById('courseCode').value.trim(), credits: Number(document.getElementById('courseCreditsInput').value) || 0,
      category: document.getElementById('courseCategory').value.trim(), status: document.getElementById('courseStatus').value,
      color: document.getElementById('courseColor').value, resourceUrl: document.getElementById('courseResource').value.trim(),
      description: document.getElementById('courseDescription').value.trim()
    };
    if (existing) Object.assign(existing, payload); else draft.courses.push(payload);
  });
  document.getElementById('courseDialog').close(); render(); toast(editingId ? '课程已更新' : '课程已添加', 'success');
});

document.getElementById('deleteCourseButton').addEventListener('click', () => {
  if (!editingId || !confirm('删除课程后，任务与笔记会保留但变为未关联。确定继续？')) return;
  updateState(draft => {
    draft.courses = draft.courses.filter(course => course.id !== editingId);
    draft.tasks.forEach(task => { if (task.courseId === editingId) task.courseId = null; });
    draft.notes.forEach(note => { if (note.courseId === editingId) note.courseId = null; });
    draft.schedule.forEach(event => { if (event.courseId === editingId) event.courseId = null; });
  });
  document.getElementById('courseDialog').close(); render(); toast('课程已删除');
});

document.getElementById('addCourseButton').addEventListener('click', () => openCourse());
document.getElementById('courseSearch').addEventListener('input', render);
document.querySelectorAll('#courseStatusFilters button').forEach(button => button.addEventListener('click', () => {
  statusFilter = button.dataset.status;
  document.querySelectorAll('#courseStatusFilters button').forEach(item => item.classList.toggle('active', item === button)); render();
}));

await initApp('courses'); render();
const requested = new URLSearchParams(location.search).get('id');
if (requested) { const course = loadState().courses.find(item => item.id === requested); if (course) openCourseOverview(course); }
