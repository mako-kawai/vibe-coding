import { UNCATEGORIZED, createId, dedupeScheduleEvents, mergeState, migrateLegacyTasks, normalizeCourseCategory } from './logic.js?v=20260822';

export const STATE_KEY = 'mako_learning_v2';
export const STATE_EVENT = 'mako:state-change';
const DB_NAME = 'mako_learning_assets_v2';
const DB_VERSION = 1;
const STORE_NAME = 'records';

const COURSE_SEEDS = [
  { id: 'math', code: 'MATH', name: '高等数学', credits: 4, category: UNCATEGORIZED, status: 'active', color: '#b5474d', description: '微积分、线性代数与微分方程。', resourceUrl: 'pdf/math.html' },
  { id: 'mathmethods', code: 'PHY-MATH', name: '数学物理方法', credits: 4, category: UNCATEGORIZED, status: 'active', color: '#2d7373', description: '复变函数、积分变换与特殊函数。', resourceUrl: 'pdf/mathmethods.html' },
  { id: 'theophy', code: 'PHY-THEORY', name: '理论物理基础', credits: 4, category: UNCATEGORIZED, status: 'active', color: '#415a77', description: '经典力学、热力学与统计物理。', resourceUrl: 'pdf/theophy.html' },
  { id: 'atmosphere', code: 'AI-STUDIO', name: '氛围编程', credits: 2, category: UNCATEGORIZED, status: 'active', color: '#9b6b9e', description: 'AI 辅助编程与学习工具实践。', resourceUrl: 'modules/module1.html' },
  { id: 'macro', code: 'ECON', name: '中级宏观经济学', credits: 3, category: UNCATEGORIZED, status: 'planned', color: '#9b7137', description: '国民收入、经济增长与宏观政策。', resourceUrl: 'pdf/macro.html' }
];

function currentTermDefaults(now = new Date()) {
  const year = now.getFullYear();
  const isFall = now.getMonth() >= 6;
  return {
    name: `${year}-${year + 1} 学年${isFall ? '秋季' : '春季'}学期`,
    startDate: `${year}-${isFall ? '09-07' : '02-23'}`,
    totalWeeks: 18
  };
}

export function createDefaultState() {
  return {
    version: 2,
    profile: { displayName: 'mako', cohort: 2025, department: '北京大学物理学院', avatarAssetId: null },
    settings: {
      theme: 'public', gpaEnabled: true, gpaRule: 'pku2019', reduceMotion: false,
      backupReminderDays: 7, localThemeAssets: {}, migratedFromV1: false,
      themeImageOpacity: 100, themeImageSaturation: 82, themeImageBrightness: 100,
      themeOverlayOpacity: 74, backgroundMode: 'clear',
      sidebarImageAssetId: null, sidebarImageOpacity: 42,
      sidebarImageSaturation: 85, sidebarImageBrightness: 72
    },
    semester: currentTermDefaults(),
    courses: COURSE_SEEDS.map(course => ({ ...course })),
    tasks: [], schedule: [], grades: [], notes: [], tags: [], focusSession: null,
    lastBackupAt: null, updatedAt: new Date().toISOString()
  };
}

function safeJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function migrateLegacyCourses(defaults) {
  const deleted = new Set(safeJson('default_courses_deleted', []));
  const edited = safeJson('default_courses_edited', {});
  const users = safeJson('user_courses', []);
  const base = defaults.filter(course => !deleted.has(course.id)).map(course => ({
    ...course,
    ...(edited[course.id] || {}),
    status: (edited[course.id]?.status || course.status) === 'in-progress' ? 'active' :
      (edited[course.id]?.status || course.status) === 'upcoming' ? 'planned' :
        (edited[course.id]?.status || course.status)
  }));
  const normalizedUsers = users.map(course => ({
    ...course, code: course.code || '', credits: Number(course.credits ?? course.credit) || 0,
    category: normalizeCourseCategory(course.category),
    status: course.status === 'in-progress' ? 'active' : course.status === 'upcoming' ? 'planned' : course.status,
    color: course.color || '#52627a'
  }));
  const map = new Map(base.map(course => [course.id, course]));
  normalizedUsers.forEach(course => map.set(course.id, { ...map.get(course.id), ...course }));
  return [...map.values()].map(course => ({ ...course, category: normalizeCourseCategory(course.category) }));
}

const DEFAULT_PERIODS = [
  { id: 0, time: '08:00-09:40' }, { id: 1, time: '10:00-11:40' },
  { id: 2, time: '14:00-15:40' }, { id: 3, time: '16:00-17:40' },
  { id: 4, time: '18:30-20:00' }, { id: 5, time: '20:10-21:40' }
];

function legacyOccurrence(item, semester, periods) {
  const period = periods.find(entry => Number(entry.id) === Number(item.period)) || DEFAULT_PERIODS[Number(item.period)] || DEFAULT_PERIODS[0];
  const [startTime = '08:00', endTime = '09:40'] = String(period.time || '').split('-');
  const start = new Date(`${semester.startDate}T00:00:00+08:00`);
  const semesterWeekday = (start.getDay() + 6) % 7;
  const targetWeekday = Number(item.day ?? item.weekday ?? 0);
  start.setDate(start.getDate() + (targetWeekday - semesterWeekday + 7) % 7);
  if (item.weekType === 'even') start.setDate(start.getDate() + 7);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(start);
  return {
    startAt: new Date(`${date}T${startTime}:00+08:00`).toISOString(),
    endAt: new Date(`${date}T${endTime}:00+08:00`).toISOString()
  };
}

function migrateLegacySchedule(items = [], semester) {
  const periods = safeJson('course_periods', DEFAULT_PERIODS);
  return items.map(item => {
    const occurrence = legacyOccurrence(item, semester, periods);
    return {
      id: item.id || createId('event'), uid: item.uid || `legacy-${item.id || createId('event')}`,
      courseId: item.courseId || null, title: item.name || item.title || item.courseName || '课程',
      location: item.location || '', startAt: item.startAt || occurrence.startAt,
      endAt: item.endAt || occurrence.endAt,
      recurrence: item.recurrence || {
        freq: 'WEEKLY', interval: item.weekType === 'all' || !item.weekType ? 1 : 2,
        until: new Date(new Date(`${semester.startDate}T00:00:00+08:00`).getTime() + Number(semester.totalWeeks || 18) * 7 * 86400000).toISOString()
      },
      source: 'legacy'
    };
  });
}

function migrateLegacyState() {
  const state = createDefaultState();
  const profile = safeJson('user_profile', null);
  const oldSettings = safeJson('user_settings', {});
  const semester = safeJson('semester_settings', null);
  const homework = safeJson('course_homework', []);
  const todos = safeJson('user_todos', []);
  const schedule = safeJson('course_table_items', []);
  state.profile = profile ? {
    ...state.profile,
    displayName: profile.name || state.profile.displayName,
    nickname: profile.nickname || '', bio: profile.bio || '', github: profile.github || ''
  } : state.profile;
  state.settings = {
    ...state.settings,
    reduceMotion: oldSettings.sakuraEnabled === false,
    legacyBackgroundId: oldSettings.backgroundImageId || null,
    migratedFromV1: true
  };
  if (semester) state.semester = { ...state.semester, ...semester };
  state.courses = migrateLegacyCourses(state.courses);
  state.tasks = migrateLegacyTasks(homework, todos);
  state.schedule = dedupeScheduleEvents(migrateLegacySchedule(schedule, state.semester));
  return state;
}

export function loadState() {
  const existing = safeJson(STATE_KEY, null);
  if (existing?.version === 2) {
    const defaults = createDefaultState();
    const normalized = {
      ...defaults, ...existing,
      profile: { ...defaults.profile, ...(existing.profile || {}) },
      settings: { ...defaults.settings, ...(existing.settings || {}), localThemeAssets: { ...(existing.settings?.localThemeAssets || {}) } },
      semester: { ...defaults.semester, ...(existing.semester || {}) },
      courses: (Array.isArray(existing.courses) ? existing.courses : defaults.courses).map(course => ({ ...course, category: normalizeCourseCategory(course.category) })),
      tasks: Array.isArray(existing.tasks) ? existing.tasks : [],
      schedule: Array.isArray(existing.schedule) ? existing.schedule : [],
      grades: Array.isArray(existing.grades) ? existing.grades : [],
      notes: Array.isArray(existing.notes) ? existing.notes : [],
      tags: Array.isArray(existing.tags) ? existing.tags : [],
      focusSession: existing.focusSession && typeof existing.focusSession === 'object' ? existing.focusSession : null
    };
    if (JSON.stringify(normalized) !== JSON.stringify(existing)) localStorage.setItem(STATE_KEY, JSON.stringify(normalized));
    return normalized;
  }
  const migrated = migrateLegacyState();
  localStorage.setItem(STATE_KEY, JSON.stringify(migrated));
  return migrated;
}

export function saveState(state) {
  const next = { ...state, version: 2, updatedAt: new Date().toISOString() };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: next }));
  return next;
}

export function updateState(updater) {
  const current = loadState();
  const draft = structuredClone(current);
  const result = updater(draft);
  return saveState(result && typeof result === 'object' ? result : draft);
}

export function subscribe(listener) {
  const handler = event => listener(event.detail);
  window.addEventListener(STATE_EVENT, handler);
  return () => window.removeEventListener(STATE_EVENT, handler);
}

export function courseById(state, id) {
  return state.courses.find(course => course.id === id) || null;
}

export function openAssetDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('kind', 'kind', { unique: false });
      }
    };
  });
}

async function transaction(mode, callback) {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;
    try { result = callback(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function putAsset(record) {
  const normalized = { ...record, id: record.id || createId(record.kind || 'asset'), updatedAt: new Date().toISOString() };
  await transaction('readwrite', store => store.put(normalized));
  return normalized;
}

export async function getAsset(id) {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAssets(kind = null) {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    const request = kind ? store.index('kind').getAll(kind) : store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAsset(id) {
  await transaction('readwrite', store => store.delete(id));
}

export async function assetUrl(id) {
  const record = await getAsset(id);
  if (!record?.data) return null;
  const blob = record.data instanceof Blob ? record.data : new Blob([record.data], { type: record.mimeType || 'application/octet-stream' });
  return URL.createObjectURL(blob);
}

export async function migrateLegacyNotes() {
  const state = loadState();
  if (state.settings.notesMigrated) return;
  const notes = [...state.notes];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('course_notes_list_')) continue;
    const courseId = key.replace('course_notes_list_', '');
    const list = safeJson(key, []);
    for (const item of list) {
      const id = item.id || createId('note');
      const content = localStorage.getItem(`note_content_${courseId}_${id}`) || '';
      if (!notes.some(note => note.id === id)) {
        notes.push({ id, courseId, title: item.name || '迁移笔记', chapter: '', tags: item.tags || [], updatedAt: item.updatedAt || new Date().toISOString() });
      }
      if (!(await getAsset(`note_${id}`))) {
        await putAsset({ id: `note_${id}`, kind: 'note', noteId: id, data: content, mimeType: 'text/markdown' });
      }
    }
  }
  updateState(draft => {
    draft.notes = notes;
    draft.settings.notesMigrated = true;
  });
}

export function importState(incoming, mode = 'merge') {
  if (!incoming || Number(incoming.version) !== 2) throw new Error('备份版本不受支持');
  const next = mode === 'replace' ? incoming : mergeState(loadState(), incoming);
  return saveState(next);
}

export function resetV2State() {
  return saveState(createDefaultState());
}
