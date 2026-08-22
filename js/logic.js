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

export const COURSE_CATEGORIES = ['专业任选', '全校任选', '全校必修', '专业必修', '任选', '通选课'];
export const UNCATEGORIZED = '未分类';

export function normalizeCourseCategory(value) {
  const text = String(value || '').trim();
  if (COURSE_CATEGORIES.includes(text)) return text;
  if (text === '专业选修') return '专业任选';
  if (text === '全校任选课') return '全校任选';
  return UNCATEGORIZED;
}

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

export function formatGpa(value) {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : '--';
}

export function filterGradesByTerm(records = [], term = '') {
  return term ? records.filter(record => record.term === term) : [...records];
}

export function splitGradesByCategory(records = [], courses = [], category = '专业必修') {
  const courseMap = new Map(courses.map(course => [course.id, course]));
  const professional = [];
  const other = [];
  records.forEach(record => {
    const recordCategory = normalizeCourseCategory(courseMap.get(record.courseId)?.category || record.category);
    (recordCategory === category ? professional : other).push(record);
  });
  return { professional, other };
}

export function groupGradesByTerm(records = []) {
  return [...new Set(records.map(record => record.term || '未设置'))].sort().reverse().map(term => ({
    term,
    records: records.filter(record => (record.term || '未设置') === term)
  }));
}

function gradeModeLabel(mode) {
  return mode === 'percentage' ? '百分制' : mode === 'letter' ? '等级制' : '合格制/状态';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeGradeTranscriptCsv(records = [], courses = [], gpaRule = 'pku2019') {
  const courseMap = new Map(courses.map(course => [course.id, course]));
  const rows = [
    ['课程代码', '课程名称', '课程类别', '学期', '学分', '记分方式', '成绩', '绩点估算'],
    ...records.map(record => {
      const course = courseMap.get(record.courseId);
      const estimate = record.gradingMode === 'percentage' && !record.excludedFromGpa
        ? formatGpa(gpaForScore(record.value, gpaRule))
        : '不纳入';
      return [
        course?.code || record.courseCode || '', course?.name || record.courseName || '未知课程',
        normalizeCourseCategory(course?.category || record.category),
        record.term || '', record.credits ?? course?.credits ?? '', gradeModeLabel(record.gradingMode),
        record.value ?? '', estimate
      ];
    })
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
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

export function gradeSummaryForCategory(records = [], courses = [], category, gpaEnabled = true, gpaRule = 'pku2019') {
  const courseMap = new Map(courses.map(course => [course.id, course]));
  const filtered = records.filter(record => normalizeCourseCategory(courseMap.get(record.courseId)?.category || record.category) === category);
  return gradeSummary(filtered, courses, gpaEnabled, gpaRule);
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
    category: 'category', '课程类别': 'category', '类别': 'category',
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
      category: item.category ? normalizeCourseCategory(item.category) : '',
      term: item.term || '', credits, gradingMode: mode,
      value: mode === 'percentage' ? Number(item.value) : String(item.value).toUpperCase(),
      status: String(item.status || '').toUpperCase()
    };
  });
  return { records, errors };
}

const PKU_TERM_PATTERN = /(?:20)?(\d{2})\s*[-—–至]\s*(?:20)?(\d{2})\s*学年度\s*第?\s*([123])\s*学期/i;
const COURSE_CATEGORY_PATTERN = /(?:专业任选|专业选修|专业必修|全校必修|全校任选课?|通选课|任选)/g;
const PORTAL_GRADE_PATTERN = /(?:^|\s)(100(?:\.0+)?|(?:\d{1,2})(?:\.\d+)?|合格|不合格|通过|未通过|P|NP|EX|IP|I|W|F)(?=\s|$)/gi;

function normalizePkuTerm(match) {
  return `20${match[1]}-20${match[2]} 学年度第${match[3]}学期`;
}

function normalizePortalGrade(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const score = Number(value);
    return score >= 0 && score <= 100 ? { gradingMode: 'percentage', value: score, status: '' } : null;
  }
  if (['合格', '通过', 'P'].includes(value)) return { gradingMode: 'pass_fail', value: 'P', status: 'P' };
  if (['不合格', '未通过', 'NP'].includes(value)) return { gradingMode: 'pass_fail', value: 'NP', status: 'NP' };
  if (['EX', 'IP', 'I', 'W'].includes(value)) return { gradingMode: 'pass_fail', value, status: value };
  if (value === 'F') return { gradingMode: 'letter', value, status: value };
  return null;
}

function parsePortalRow(row, term, rowNumber, errors) {
  let source = row.parts.join(' ').replace(/\s+/g, ' ').trim();
  const categoryMatch = source.match(COURSE_CATEGORY_PATTERN);
  const category = categoryMatch ? normalizeCourseCategory(categoryMatch[0]) : '';
  source = source.replace(/学分/g, ' ').replace(COURSE_CATEGORY_PATTERN, ' ').replace(/\s+/g, ' ').trim();
  const gradeMatches = [...source.matchAll(PORTAL_GRADE_PATTERN)];
  const gradeMatch = gradeMatches.at(-1);
  if (!gradeMatch) {
    if (source) errors.push(`第 ${rowNumber} 组未识别到成绩：${source}`);
    return null;
  }
  const grade = normalizePortalGrade(gradeMatch[1]);
  const matchStart = gradeMatch.index + (gradeMatch[0].startsWith(' ') ? 1 : 0);
  const courseName = `${source.slice(0, matchStart)} ${source.slice(matchStart + gradeMatch[1].length)}`
    .replace(/^[·:：,，\-\s]+|[·:：,，\-\s]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!courseName) {
    errors.push(`第 ${rowNumber} 组缺少课程名称`);
    return null;
  }
  return {
    courseCode: '', courseName, category, term: term || '', credits: row.credits,
    ...grade, source: 'pku-portal-text'
  };
}

export function parsePkuGradeText(text) {
  const source = String(text || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(new RegExp(`(${PKU_TERM_PATTERN.source})`, 'gi'), '\n$1\n');
  const lines = source.split(/\r?\n/).map(line => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean);
  const records = [];
  const errors = [];
  const warnings = [];
  let term = '';
  let row = null;
  let rowNumber = 0;

  const finishRow = () => {
    if (!row) return;
    const parsed = parsePortalRow(row, term, rowNumber, errors);
    if (parsed) records.push(parsed);
    row = null;
  };

  lines.forEach(line => {
    const termMatch = line.match(PKU_TERM_PATTERN);
    if (termMatch) {
      finishRow();
      term = normalizePkuTerm(termMatch);
      return;
    }
    if (/^(?:总学分|学分合计|平均成绩|绩点|GPA)\b/i.test(line)) return;

    const creditOnly = line.match(/^(\d+(?:\.\d+)?)\s*学分$/);
    const creditWithRest = line.match(/^(\d+(?:\.\d+)?)\s*(?:学分\s*)?(.+)$/);
    const numericOnly = line.match(/^(\d+(?:\.\d+)?)$/);
    const credit = creditOnly ? Number(creditOnly[1])
      : creditWithRest && Number(creditWithRest[1]) <= 30 ? Number(creditWithRest[1])
        : numericOnly && Number(numericOnly[1]) <= 30 ? Number(numericOnly[1]) : null;

    if (row && numericOnly && credit !== null) {
      const currentGrades = [...row.parts.join(' ').matchAll(PORTAL_GRADE_PATTERN)]
        .map(match => normalizePortalGrade(match[1])).filter(Boolean);
      if (!currentGrades.length) {
        row.parts.push(line);
        return;
      }
    }

    if (credit !== null && credit > 0) {
      finishRow();
      rowNumber += 1;
      const remainder = creditWithRest?.[2] || '';
      row = { credits: credit, parts: remainder ? [remainder] : [] };
      return;
    }
    if (row) row.parts.push(line);
  });
  finishRow();

  const unique = new Map();
  records.forEach(record => unique.set(`${record.term}|${record.courseName}`, record));
  if (!term && records.length) warnings.push('未识别到学期标题，请在导入后检查学期字段。');
  if (!records.length && !errors.length) errors.push('没有识别到课程。请从教务成绩页复制包含“学分、课程名、成绩”的文本。');
  return { records: [...unique.values()], errors, warnings };
}

export function serializeNoteMarkdown(note, content, course = null) {
  const metadata = {
    version: 1,
    title: note.title || '未命名笔记',
    courseId: note.courseId || null,
    courseName: course?.name || '',
    chapter: note.chapter || '',
    tags: Array.isArray(note.tags) ? note.tags : [],
    exportedAt: new Date().toISOString()
  };
  return `<!-- mako-note-meta: ${JSON.stringify(metadata)} -->\n\n${String(content || '')}`;
}

export function parseNoteMarkdown(text, filename = '导入笔记.md') {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const match = source.match(/^\s*<!--\s*mako-note-meta:\s*({[\s\S]*?})\s*-->\s*/);
  let metadata = {};
  if (match) {
    try { metadata = JSON.parse(match[1]); } catch { metadata = {}; }
  }
  return {
    metadata,
    title: String(metadata.title || filename.replace(/\.md$/i, '') || '导入笔记').trim(),
    content: match ? source.slice(match[0].length) : source
  };
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
