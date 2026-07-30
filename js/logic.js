export const TASK_TYPES = {
  homework: '作业',
  exam: '考试',
  reading: '阅读',
  lab: '实验',
  project: '项目',
  personal: '个人'
};

export const PRIORITIES = {
  high: '高',
  medium: '中',
  low: '低'
};

export const SPECIAL_GRADES = new Set(['P', 'NP', 'EX', 'I', 'IP', 'W', 'F']);

export function createId(prefix = 'item') {
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${token}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function toShanghaiIso(dateText, endOfDay = false) {
  if (!dateText) return null;
  if (/T/.test(dateText)) return dateText;
  return `${dateText}T${endOfDay ? '23:59' : '09:00'}:00+08:00`;
}

export function getDueState(dueAt, now = new Date()) {
  if (!dueAt) return { key: 'none', label: '无截止时间', diffMs: Infinity };
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  if (Number.isNaN(due.getTime())) return { key: 'invalid', label: '日期无效', diffMs: Infinity };
  if (diffMs < 0) return { key: 'overdue', label: '已逾期', diffMs };
  if (diffMs <= 24 * 60 * 60 * 1000) return { key: 'today', label: '24 小时内', diffMs };
  if (diffMs <= 3 * 24 * 60 * 60 * 1000) return { key: 'soon', label: '3 天内', diffMs };
  return { key: 'later', label: '稍后', diffMs };
}

export function formatDateTime(value) {
  if (!value) return '未设置';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日期无效';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function sortTasks(tasks, now = new Date()) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    const aOverdue = aDue < now.getTime();
    const bOverdue = bDue < now.getTime();
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (aDue !== bDue) return aDue - bDue;
    return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
  });
}

export function taskStats(tasks, now = new Date()) {
  const active = tasks.filter(task => task.status !== 'done');
  return {
    active: active.length,
    overdue: active.filter(task => getDueState(task.dueAt, now).key === 'overdue').length,
    next72h: active.filter(task => ['today', 'soon'].includes(getDueState(task.dueAt, now).key)).length,
    done: tasks.length - active.length,
    estimatedMinutes: active.reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0)
  };
}

export function legacyPkuGpa(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  if (value < 60) return 0;
  return Number((4 - (3 * Math.pow(100 - value, 2)) / 1600).toFixed(4));
}

export function gpaForScore(score, rule = 'pku2019') {
  if (rule === 'linear4') {
    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    return value < 60 ? 0 : Number(Math.min(4, (value - 60) / 10).toFixed(4));
  }
  return legacyPkuGpa(score);
}

export function gradeSummary(records, courses = [], gpaEnabled = true, gpaRule = 'pku2019') {
  const courseMap = new Map(courses.map(course => [course.id, course]));
  let weightedScore = 0;
  let percentageCredits = 0;
  let gpaPoints = 0;
  let gpaCredits = 0;
  let earnedCredits = 0;
  const exclusions = [];

  records.forEach(record => {
    const credits = Number(record.credits ?? courseMap.get(record.courseId)?.credits) || 0;
    const mode = record.gradingMode || 'percentage';
    const value = mode === 'percentage' ? Number(record.value) : record.value;
    const passed = mode === 'percentage' ? value >= 60 : !['NP', 'F'].includes(String(value || record.status).toUpperCase());
    if (passed && !['W', 'I', 'IP'].includes(String(record.status || value).toUpperCase())) earnedCredits += credits;

    if (mode === 'percentage' && Number.isFinite(value)) {
      weightedScore += value * credits;
      percentageCredits += credits;
      if (gpaEnabled && !record.excludedFromGpa) {
        gpaPoints += gpaForScore(value, gpaRule) * credits;
        gpaCredits += credits;
      } else if (record.excludedFromGpa) {
        exclusions.push({ id: record.id, reason: '已手动排除' });
      }
    } else {
      exclusions.push({ id: record.id, reason: '非百分制成绩不参与旧公式估算' });
    }
  });

  return {
    weightedAverage: percentageCredits ? weightedScore / percentageCredits : null,
    estimatedGpa: gpaEnabled && gpaCredits ? gpaPoints / gpaCredits : null,
    earnedCredits,
    gpaCredits,
    exclusions
  };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseGradeCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { records: [], errors: ['CSV 至少需要表头和一条记录'] };
  const aliases = {
    coursecode: 'courseCode', '课程代码': 'courseCode',
    coursename: 'courseName', '课程名称': 'courseName',
    term: 'term', '学期': 'term', credits: 'credits', '学分': 'credits',
    gradingmode: 'gradingMode', '记分方式': 'gradingMode',
    score: 'value', '成绩': 'value', status: 'status', '状态': 'status'
  };
  const headers = rows[0].map(header => aliases[header.toLowerCase()] || aliases[header] || header);
  const errors = [];
  const records = rows.slice(1).map((values, rowIndex) => {
    const item = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const mode = item.gradingMode || (/^\d+(\.\d+)?$/.test(item.value) ? 'percentage' : 'letter');
    const credits = Number(item.credits);
    if (!item.courseName) errors.push(`第 ${rowIndex + 2} 行缺少课程名称`);
    if (!Number.isFinite(credits) || credits <= 0) errors.push(`第 ${rowIndex + 2} 行学分无效`);
    if (mode === 'percentage' && (Number(item.value) < 0 || Number(item.value) > 100)) {
      errors.push(`第 ${rowIndex + 2} 行百分制成绩无效`);
    }
    const normalizedValue = String(item.value).toUpperCase();
    if (mode === 'letter' && !['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'].includes(normalizedValue)) {
      errors.push(`第 ${rowIndex + 2} 行等级制成绩无效`);
    }
    if (mode === 'pass_fail' && !['P', 'NP', 'EX', 'I', 'IP', 'W', 'F'].includes(normalizedValue)) {
      errors.push(`第 ${rowIndex + 2} 行特殊状态无效`);
    }
    return {
      courseCode: item.courseCode || '', courseName: item.courseName,
      term: item.term || '', credits, gradingMode: mode,
      value: mode === 'percentage' ? Number(item.value) : String(item.value).toUpperCase(),
      status: String(item.status || '').toUpperCase()
    };
  });
  return { records, errors };
}

function legacyTaskFromHomework(homework) {
  return {
    id: homework.id || createId('task'),
    title: homework.title || '未命名作业',
    courseId: homework.courseId || null,
    type: 'homework',
    dueAt: toShanghaiIso(homework.dueDate, true),
    priority: 'medium',
    estimateMinutes: 60,
    progress: homework.completed ? 100 : 0,
    status: homework.completed ? 'done' : 'todo',
    tags: homework.tags || [],
    subtasks: [],
    description: homework.description || '',
    legacyHomeworkId: homework.id || null,
    createdAt: homework.createdAt || new Date().toISOString()
  };
}

export function migrateLegacyTasks(homework = [], todos = []) {
  const tasks = homework.map(legacyTaskFromHomework);
  const linked = new Set(homework.map(item => item.id).filter(Boolean));
  todos.forEach(todo => {
    if (todo.homeworkId && linked.has(todo.homeworkId)) return;
    tasks.push({
      id: todo.id || createId('task'), title: todo.text || '未命名任务',
      courseId: todo.courseId || null, type: 'personal',
      dueAt: toShanghaiIso(todo.dueDate, true), priority: 'medium', estimateMinutes: 30,
      progress: todo.completed ? 100 : 0, status: todo.completed ? 'done' : 'todo',
      tags: [], subtasks: [], description: '', createdAt: todo.createdAt || new Date().toISOString()
    });
  });
  return tasks;
}

export function dedupeScheduleEvents(events = []) {
  const seen = new Set();
  return events.filter(event => {
    const key = event.uid || `${event.title}|${event.startAt}|${event.endAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeState(current, incoming) {
  const mergeById = (left = [], right = []) => {
    const map = new Map(left.map(item => [item.id, item]));
    right.forEach(item => map.set(item.id, { ...map.get(item.id), ...item }));
    return [...map.values()];
  };
  return {
    ...current,
    ...incoming,
    version: 2,
    profile: { ...current.profile, ...incoming.profile },
    settings: { ...current.settings, ...incoming.settings },
    semester: { ...current.semester, ...incoming.semester },
    courses: mergeById(current.courses, incoming.courses),
    tasks: mergeById(current.tasks, incoming.tasks),
    schedule: dedupeScheduleEvents([...(current.schedule || []), ...(incoming.schedule || [])]),
    grades: mergeById(current.grades, incoming.grades),
    notes: mergeById(current.notes, incoming.notes),
    tags: mergeById(current.tags, incoming.tags)
  };
}
