import { courseById, loadState, updateState } from './store.js';
import { createId, dedupeScheduleEvents, formatDateTime } from './logic.js';
import { fillCourseOptions, icon, initApp, node, openDialog, refreshIcons, toast } from './ui.js';

let weekOffset = 0;
let editingId = null;

function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day + 1 + weekOffset * 7);
  return copy;
}

function localInputValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function occurrenceForDate(event, date) {
  if (!event.startAt) return null;
  const start = new Date(event.startAt);
  const sameDate = start.toDateString() === date.toDateString();
  if (sameDate) return start;
  if (event.recurrence?.freq !== 'WEEKLY' || start > date) return null;
  if (event.recurrence.until && date > new Date(event.recurrence.until)) return null;
  if (start.getDay() !== date.getDay()) return null;
  const weeksSinceStart = Math.floor((date - start) / (7 * 86400000));
  if (weeksSinceStart % Number(event.recurrence.interval || 1) !== 0) return null;
  const result = new Date(date);
  result.setHours(start.getHours(), start.getMinutes(), 0, 0);
  return result;
}

function eventCard(event, occurrence, state) {
  const course = courseById(state, event.courseId);
  const button = node('button', { class: 'calendar-event', type: 'button', style: `--course-color:${course?.color || '#8f2f3a'}` }, [
    node('time', { text: occurrence.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) }),
    node('strong', { text: event.title }), node('span', { text: event.location || course?.name || '' })
  ]);
  button.addEventListener('click', () => openEvent(event));
  return button;
}

function render() {
  const state = loadState();
  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  document.getElementById('weekTitle').textContent = `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`;
  const calendar = document.getElementById('weekCalendar');
  calendar.replaceChildren();
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(weekStart); day.setDate(day.getDate() + index);
    const events = state.schedule.map(event => ({ event, occurrence: occurrenceForDate(event, day) })).filter(item => item.occurrence).sort((a, b) => a.occurrence - b.occurrence);
    calendar.append(node('section', { class: `calendar-day${day.toDateString() === new Date().toDateString() ? ' today' : ''}` }, [
      node('header', {}, [node('span', { text: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index] }), node('strong', { text: String(day.getDate()) })]),
      node('div', { class: 'calendar-day-events' }, events.length ? events.map(item => eventCard(item.event, item.occurrence, state)) : [node('span', { class: 'day-empty', text: '—' })])
    ]));
  }
  const now = new Date();
  const upcoming = [];
  for (let dayOffset = 0; dayOffset < 21; dayOffset += 1) {
    const date = new Date(now); date.setDate(date.getDate() + dayOffset);
    state.schedule.forEach(event => {
      const occurrence = occurrenceForDate(event, date);
      if (occurrence && occurrence >= now) upcoming.push({ event, occurrence });
    });
  }
  upcoming.sort((a, b) => a.occurrence - b.occurrence);
  const list = document.getElementById('upcomingEvents');
  list.replaceChildren(...(upcoming.length ? upcoming.slice(0, 10).map(({ event, occurrence }) => {
    const button = node('button', { class: 'agenda-item agenda-button' }, [
      node('time', { text: occurrence.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) }),
      node('span', { class: 'agenda-marker', style: `--course-color:${courseById(state, event.courseId)?.color || '#8f2f3a'}` }),
      node('div', {}, [node('strong', { text: event.title }), node('span', { text: `${formatDateTime(occurrence)} · ${event.location || '地点未设置'}` })])
    ]);
    button.addEventListener('click', () => openEvent(event)); return button;
  }) : [node('div', { class: 'empty-inline' }, [node('p', { text: '未来三周没有日程。' })])]));
  refreshIcons();
}

function openEvent(event = null) {
  editingId = event?.id || null;
  document.getElementById('eventDialogTitle').textContent = event ? '编辑日程' : '添加日程';
  document.getElementById('eventTitle').value = event?.title || '';
  fillCourseOptions(document.getElementById('eventCourse'), { includeAll: true });
  document.getElementById('eventCourse').value = event?.courseId || '';
  document.getElementById('eventLocation').value = event?.location || '';
  const start = event?.startAt || new Date(Date.now() + 3600000).toISOString();
  const end = event?.endAt || new Date(Date.now() + 7200000).toISOString();
  document.getElementById('eventStart').value = localInputValue(start);
  document.getElementById('eventEnd').value = localInputValue(end);
  document.getElementById('eventWeekly').checked = event?.recurrence?.freq === 'WEEKLY';
  document.getElementById('deleteEventButton').classList.toggle('hidden', !event);
  openDialog('eventDialog');
}

document.getElementById('eventForm').addEventListener('submit', event => {
  event.preventDefault();
  const startAt = new Date(document.getElementById('eventStart').value).toISOString();
  const endAt = new Date(document.getElementById('eventEnd').value).toISOString();
  if (new Date(endAt) <= new Date(startAt)) { toast('结束时间必须晚于开始时间', 'error'); return; }
  updateState(draft => {
    const existing = editingId ? draft.schedule.find(item => item.id === editingId) : null;
    const semesterEnd = new Date(`${draft.semester.startDate}T00:00:00+08:00`); semesterEnd.setDate(semesterEnd.getDate() + draft.semester.totalWeeks * 7);
    const payload = { id: editingId || createId('event'), uid: existing?.uid || createId('uid'), courseId: document.getElementById('eventCourse').value || null, title: document.getElementById('eventTitle').value.trim(), location: document.getElementById('eventLocation').value.trim(), startAt, endAt, recurrence: document.getElementById('eventWeekly').checked ? { freq: 'WEEKLY', until: semesterEnd.toISOString() } : null, source: existing?.source || 'manual' };
    if (existing) Object.assign(existing, payload); else draft.schedule.push(payload);
  });
  document.getElementById('eventDialog').close(); render(); toast(editingId ? '日程已更新' : '日程已添加', 'success');
});

document.getElementById('deleteEventButton').addEventListener('click', () => {
  if (!editingId || !confirm('确定删除这项日程？')) return;
  updateState(draft => { draft.schedule = draft.schedule.filter(event => event.id !== editingId); });
  document.getElementById('eventDialog').close(); render();
});

document.getElementById('importIcsButton').addEventListener('click', () => document.getElementById('icsInput').click());
document.getElementById('icsInput').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (!globalThis.ICAL) throw new Error('ICS 解析器未加载');
    const component = new globalThis.ICAL.Component(globalThis.ICAL.parse(await file.text()));
    const parsed = component.getAllSubcomponents('vevent').map(entry => {
      const item = new globalThis.ICAL.Event(entry);
      const rrule = entry.getFirstPropertyValue('rrule');
      const category = entry.getFirstPropertyValue('categories');
      const state = loadState();
      const course = state.courses.find(courseItem => `${item.summary} ${category || ''}`.includes(courseItem.name));
      return { id: createId('event'), uid: item.uid || createId('uid'), courseId: course?.id || null, title: item.summary || '导入日程', location: item.location || '', startAt: item.startDate.toJSDate().toISOString(), endAt: item.endDate.toJSDate().toISOString(), recurrence: rrule ? { freq: rrule.freq || 'WEEKLY', until: rrule.until?.toJSDate?.().toISOString() || null } : null, source: 'ics' };
    });
    const before = loadState().schedule.length;
    updateState(draft => { draft.schedule = dedupeScheduleEvents([...draft.schedule, ...parsed]); });
    const imported = loadState().schedule.length - before;
    document.getElementById('icsResult').replaceChildren(node('p', { text: `读取 ${parsed.length} 项，新增 ${imported} 项，跳过 ${parsed.length - imported} 项重复事件。` }));
    openDialog('icsResultDialog'); render();
  } catch (error) { toast(`ICS 导入失败：${error.message}`, 'error'); }
  event.target.value = '';
});

document.getElementById('addEventButton').addEventListener('click', () => openEvent());
document.getElementById('previousWeek').addEventListener('click', () => { weekOffset -= 1; render(); });
document.getElementById('nextWeek').addEventListener('click', () => { weekOffset += 1; render(); });
document.getElementById('currentWeek').addEventListener('click', () => { weekOffset = 0; render(); });

await initApp('schedule'); render();
