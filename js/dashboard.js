import { courseById, loadState, updateState } from './store.js';
import { formatDateTime, getDueState, gradeSummary, sortTasks, taskStats } from './logic.js';
import { icon, initApp, node, refreshIcons, toast } from './ui.js';

function semesterStatus(state, now = new Date()) {
  const start = new Date(`${state.semester.startDate}T00:00:00+08:00`);
  const total = Number(state.semester.totalWeeks) || 18;
  const week = Math.floor((now - start) / (7 * 86400000)) + 1;
  return { week, total, percent: Math.max(0, Math.min(100, (week / total) * 100)) };
}

function renderTask(task, state) {
  const due = getDueState(task.dueAt);
  const course = courseById(state, task.courseId);
  const check = node('button', { class: 'task-check', type: 'button', title: '标记完成', 'aria-label': `完成 ${task.title}` }, [icon('check')]);
  check.addEventListener('click', () => {
    updateState(draft => {
      const target = draft.tasks.find(item => item.id === task.id);
      target.status = 'done'; target.progress = 100; target.completedAt = new Date().toISOString();
    });
    render();
    toast('任务已完成', 'success');
  });
  return node('div', { class: `dashboard-task due-${due.key}` }, [
    check,
    node('div', { class: 'task-main' }, [
      node('strong', { text: task.title }),
      node('span', { text: `${course?.name || '未关联课程'} · ${formatDateTime(task.dueAt)}` })
    ]),
    node('span', { class: `due-badge ${due.key}`, text: due.label })
  ]);
}

function eventOccursToday(event, now = new Date()) {
  const start = event.startAt ? new Date(event.startAt) : null;
  if (start && start.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) === now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })) return true;
  if (event.recurrence?.freq === 'WEEKLY' && start) return start.getDay() === now.getDay() && (!event.recurrence.until || now <= new Date(event.recurrence.until));
  return Number(event.recurrence?.weekday) === (now.getDay() || 7);
}

function renderAgenda(event, state) {
  const course = courseById(state, event.courseId);
  const start = event.startAt ? new Date(event.startAt) : null;
  const time = start ? start.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }) : event.recurrence?.periodId || '--:--';
  return node('div', { class: 'agenda-item' }, [
    node('time', { text: time }),
    node('span', { class: 'agenda-marker', style: `--course-color:${course?.color || '#8f2f3a'}` }),
    node('div', {}, [node('strong', { text: event.title }), node('span', { text: event.location || course?.name || '地点未设置' })])
  ]);
}

function renderEmpty(message, href, label) {
  return node('div', { class: 'empty-inline' }, [node('p', { text: message }), node('a', { class: 'text-link', href }, [node('span', { text: label }), icon('arrow-right')])]);
}

function render() {
  const state = loadState();
  const now = new Date();
  const stats = taskStats(state.tasks, now);
  const status = semesterStatus(state, now);
  const grades = gradeSummary(state.grades, state.courses, state.settings.gpaEnabled, state.settings.gpaRule);
  const dateText = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);
  document.getElementById('todayLabel').textContent = `${dateText} · ${state.semester.name}`;
  document.getElementById('greeting').textContent = `${state.profile.displayName || 'mako'}，今天从最重要的事开始。`;
  document.getElementById('semesterWeek').textContent = status.week < 1 ? '学期尚未开始' : status.week > status.total ? '学期已结束' : `第 ${status.week} / ${status.total} 周`;
  document.getElementById('semesterProgress').textContent = `${Math.round(status.percent)}%`;
  document.getElementById('progressLineFill').style.width = `${status.percent}%`;
  document.getElementById('activeTaskCount').textContent = stats.active;
  document.getElementById('overdueCount').textContent = stats.overdue;
  document.getElementById('courseCredits').textContent = state.courses.filter(course => course.status === 'active').reduce((sum, course) => sum + Number(course.credits || 0), 0);
  document.getElementById('gpaEstimate').textContent = grades.estimatedGpa === null ? '--' : grades.estimatedGpa.toFixed(2);

  const urgent = sortTasks(state.tasks.filter(task => task.status !== 'done'), now).slice(0, 5);
  const urgentContainer = document.getElementById('urgentTasks');
  urgentContainer.replaceChildren(...(urgent.length ? urgent.map(task => renderTask(task, state)) : [renderEmpty('目前没有待处理任务。', 'tasks.html?new=1', '添加第一项任务')]));

  const agenda = state.schedule.filter(event => eventOccursToday(event, now)).sort((a, b) => new Date(a.startAt || 0) - new Date(b.startAt || 0));
  const agendaContainer = document.getElementById('todayAgenda');
  agendaContainer.replaceChildren(...(agenda.length ? agenda.map(event => renderAgenda(event, state)) : [renderEmpty('今天还没有课程安排。', 'schedule.html', '打开课程表')]));

  const exams = sortTasks(state.tasks.filter(task => task.type === 'exam' && task.status !== 'done'), now).slice(0, 4);
  const examContainer = document.getElementById('examCountdowns');
  examContainer.replaceChildren(...(exams.length ? exams.map(task => {
    const days = Math.max(0, Math.ceil((new Date(task.dueAt) - now) / 86400000));
    return node('a', { class: 'countdown-item', href: `tasks.html?q=${encodeURIComponent(task.title)}` }, [
      node('strong', { text: String(days).padStart(2, '0') }),
      node('span', {}, [node('b', { text: task.title }), node('small', { text: `${formatDateTime(task.dueAt)} · ${courseById(state, task.courseId)?.name || '未关联课程'}` })])
    ]);
  }) : [renderEmpty('还没有记录考试日期。', 'tasks.html?new=1&type=exam', '添加考试')]));

  const completedToday = state.tasks.filter(task => task.completedAt && new Date(task.completedAt).toDateString() === now.toDateString()).length;
  document.getElementById('dailyBrief').textContent = stats.overdue
    ? `有 ${stats.overdue} 项任务已经逾期。先清理最早的一项，再继续今天的课程。`
    : stats.next72h ? `未来三天有 ${stats.next72h} 项截止任务，今天已经完成 ${completedToday} 项。`
      : `未来三天没有紧急截止。可以提前推进一项物理推导或整理本周笔记。`;

  const backupDays = Number(state.settings.backupReminderDays) || 7;
  const elapsed = state.lastBackupAt ? (now - new Date(state.lastBackupAt)) / 86400000 : Infinity;
  document.getElementById('backupReminder').textContent = elapsed > backupDays ? '本地数据尚未按计划备份，建议前往设置导出 ZIP。' : `最近备份：${new Date(state.lastBackupAt).toLocaleDateString('zh-CN')}`;
  refreshIcons();
}

await initApp('dashboard');
render();
