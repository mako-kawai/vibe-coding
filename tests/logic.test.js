import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeScheduleEvents, filterGradesByTerm, formatGpa, getDueState, gpaForScore, gradeSummary, gradeSummaryForCategory, groupGradesByTerm, legacyPkuGpa,
  mergeState, migrateLegacyTasks, parseGradeCsv, parseNoteMarkdown,
  normalizeCourseCategory, parsePkuGradeText, serializeGradeTranscriptCsv, serializeNoteMarkdown, splitGradesByCategory
} from '../js/logic.js';
import { backgroundImageQuality, cropPlacement } from '../js/image-cropper.js';

test('legacy homework and mirrored todo migrate into one task', () => {
  const tasks = migrateLegacyTasks(
    [{ id: 'hw-1', title: '力学习题', courseId: 'phy', dueDate: '2026-08-01', completed: false }],
    [{ id: 'todo-1', text: '力学习题', homeworkId: 'hw-1' }, { id: 'todo-2', text: '借书', completed: true }]
  );
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].dueAt, '2026-08-01T23:59:00+08:00');
  assert.equal(tasks[1].status, 'done');
});

test('due states use exact time boundaries', () => {
  const now = new Date('2026-07-30T00:00:00Z');
  assert.equal(getDueState('2026-07-29T23:59:59Z', now).key, 'overdue');
  assert.equal(getDueState('2026-07-31T00:00:00Z', now).key, 'today');
  assert.equal(getDueState('2026-08-02T00:00:00Z', now).key, 'soon');
  assert.equal(getDueState('2026-08-02T00:00:01Z', now).key, 'later');
});

test('2019 GPA formula and selectable linear rule cover boundaries', () => {
  assert.equal(legacyPkuGpa(59), 0);
  assert.equal(legacyPkuGpa(60), 1);
  assert.equal(legacyPkuGpa(100), 4);
  assert.equal(legacyPkuGpa(101), null);
  assert.equal(gpaForScore(60, 'linear4'), 0);
  assert.equal(gpaForScore(70, 'linear4'), 1);
  assert.equal(gpaForScore(100, 'linear4'), 4);
});

test('GPA display uses three decimals without changing null handling', () => {
  assert.equal(formatGpa(3), '3.000');
  assert.equal(formatGpa(3.1), '3.100');
  assert.equal(formatGpa(3.125), '3.125');
  assert.equal(formatGpa(null), '--');
  assert.equal(formatGpa('not-a-number'), '--');
});

test('course categories normalize legacy labels and keep the six official categories', () => {
  assert.equal(normalizeCourseCategory('专业选修'), '专业任选');
  assert.equal(normalizeCourseCategory('全校任选课'), '全校任选');
  assert.equal(normalizeCourseCategory('物理基础'), '未分类');
  assert.equal(normalizeCourseCategory('专业必修'), '专业必修');
});

test('grade summary estimates only eligible percentage records', () => {
  const records = [
    { id: 'p', gradingMode: 'percentage', value: 80, credits: 4 },
    { id: 'a', gradingMode: 'letter', value: 'A', status: 'A', credits: 3 },
    { id: 'pass', gradingMode: 'pass_fail', value: 'P', status: 'P', credits: 2 },
    { id: 'np', gradingMode: 'pass_fail', value: 'NP', status: 'NP', credits: 1 },
    { id: 'w', gradingMode: 'pass_fail', value: 'W', status: 'W', credits: 1 }
  ];
  const summary = gradeSummary(records, [], true, 'pku2019');
  assert.equal(summary.weightedAverage, 80);
  assert.equal(summary.gpaCredits, 4);
  assert.equal(summary.earnedCredits, 9);
  assert.equal(summary.exclusions.length, 4);
});

test('professional requirement GPA only includes percentage grades from that course category', () => {
  const courses = [
    { id: 'required', category: '专业必修' },
    { id: 'elective', category: '专业任选' }
  ];
  const records = [
    { id: 'required-score', courseId: 'required', gradingMode: 'percentage', value: 90, credits: 4 },
    { id: 'required-pass', courseId: 'required', gradingMode: 'pass_fail', value: 'P', credits: 1 },
    { id: 'elective-score', courseId: 'elective', gradingMode: 'percentage', value: 100, credits: 4 }
  ];
  const summary = gradeSummaryForCategory(records, courses, '专业必修', true, 'pku2019');
  assert.equal(summary.gpaCredits, 4);
  assert.equal(summary.estimatedGpa, 3.8125);
  assert.equal(summary.exclusions.length, 1);
});

test('transcript puts professional requirements first and separates remaining terms', () => {
  const courses = [{ id: 'required', category: '专业必修' }, { id: 'other', category: '全校任选' }];
  const records = [
    { id: 'other-2', courseId: 'other', term: '2025-2026 学年度第2学期' },
    { id: 'required-1', courseId: 'required', term: '2025-2026 学年度第1学期' },
    { id: 'other-1', courseId: 'other', term: '2025-2026 学年度第1学期' }
  ];
  const split = splitGradesByCategory(records, courses);
  assert.deepEqual(split.professional.map(record => record.id), ['required-1']);
  assert.deepEqual(groupGradesByTerm(split.other).map(group => [group.term, group.records.map(record => record.id)]), [
    ['2025-2026 学年度第2学期', ['other-2']],
    ['2025-2026 学年度第1学期', ['other-1']]
  ]);
});

test('ICS-style events deduplicate by UID', () => {
  const events = dedupeScheduleEvents([
    { id: '1', uid: 'same', title: '量子力学', startAt: '2026-09-01T00:00:00Z' },
    { id: '2', uid: 'same', title: '更新后的标题', startAt: '2026-09-01T00:00:00Z' },
    { id: '3', uid: 'other', title: '数学物理方法', startAt: '2026-09-02T00:00:00Z' }
  ]);
  assert.deepEqual(events.map(event => event.id), ['1', '3']);
});

test('CSV parser handles quoted names and rejects unsupported grade values', () => {
  const valid = parseGradeCsv('课程名称,学分,记分方式,成绩\n"物理学,导论",2,letter,A-\n实验,1,pass_fail,EX');
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.records[0].courseName, '物理学,导论');
  const invalid = parseGradeCsv('课程名称,学分,记分方式,成绩\n量子力学,4,percentage,120\n实验,1,pass_fail,GOOD');
  assert.equal(invalid.errors.length, 2);
});

test('transcript filtering and CSV serialization preserve grade modes and quoting', () => {
  const courses = [{ id: 'c1', code: 'PHY,101', name: '理论物理,基础' }];
  const records = [
    { courseId: 'c1', term: '2025-2026 学年度第1学期', credits: 4, gradingMode: 'percentage', value: 88 },
    { courseId: 'c1', term: '2025-2026 学年度第2学期', credits: 4, gradingMode: 'pass_fail', value: 'P', status: 'P' }
  ];
  assert.equal(filterGradesByTerm(records, '').length, 2);
  assert.equal(filterGradesByTerm(records, '2025-2026 学年度第2学期').length, 1);
  const csv = serializeGradeTranscriptCsv(records, courses);
  assert.match(csv, /"PHY,101","理论物理,基础",未分类/);
  assert.match(csv, /88,.*\d\.\d{3}/);
  assert.match(csv, /P,不纳入/);
});

test('PKU portal text parser recognizes terms, numeric grades and pass records', () => {
  const pasted = `25-26学年度3学期
2 速成法语（零起点） 95
学分 全校任选
1 汉字太极与养生课 98
学分 全校必修
25-26学年度2学期
5 高等数学A（二） 94.5
学分 专业必修
1 物理卓越计划讲堂：名师面对面（二） 合格
学分 任选`;
  const parsed = parsePkuGradeText(pasted);
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.records.map(record => [record.courseName, record.term, record.credits, record.value]), [
    ['速成法语（零起点）', '2025-2026 学年度第3学期', 2, 95],
    ['汉字太极与养生课', '2025-2026 学年度第3学期', 1, 98],
    ['高等数学A（二）', '2025-2026 学年度第2学期', 5, 94.5],
    ['物理卓越计划讲堂：名师面对面（二）', '2025-2026 学年度第2学期', 1, 'P']
  ]);
  assert.deepEqual(parsed.records.map(record => record.category), ['全校任选', '全校必修', '专业必修', '任选']);

  const csv = parseGradeCsv('课程名称,课程类别,学分,成绩\n理论物理,专业必修,4,90');
  assert.equal(csv.errors.length, 0);
  assert.equal(csv.records[0].category, '专业必修');
});

test('PKU portal parser accepts the fully line-broken copied format', () => {
  const pasted = `25-26学年度3学期
2
学分
速成法语（零起点）
全校任选
95
1
学分
汉字太极与养生课
全校必修
98
25-26学年度2学期
5
学分
高等数学A（二）
专业必修
94.5
4
学分
理论物理基础II
专业必修
97
3
学分
数学物理方法 (上)
专业必修
95
3
学分
实验物理中的统计方法
任选
94`;
  const parsed = parsePkuGradeText(pasted);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.warnings.length, 0);
  assert.deepEqual(parsed.records.map(record => [record.courseName, record.credits, record.category, record.value]), [
    ['速成法语（零起点）', 2, '全校任选', 95],
    ['汉字太极与养生课', 1, '全校必修', 98],
    ['高等数学A（二）', 5, '专业必修', 94.5],
    ['理论物理基础II', 4, '专业必修', 97],
    ['数学物理方法 (上)', 3, '专业必修', 95],
    ['实验物理中的统计方法', 3, '任选', 94]
  ]);
});

test('Markdown note export preserves metadata and content for re-import', () => {
  const serialized = serializeNoteMarkdown({ title: '角动量', courseId: 'theophy', chapter: '第三章', tags: ['力学'] }, '# 正文', { name: '理论物理基础' });
  const parsed = parseNoteMarkdown(serialized, 'fallback.md');
  assert.equal(parsed.title, '角动量');
  assert.equal(parsed.metadata.courseId, 'theophy');
  assert.deepEqual(parsed.metadata.tags, ['力学']);
  assert.equal(parsed.content, '# 正文');
});

test('image crop placement covers the target canvas at every zoom', () => {
  const placement = cropPlacement(800, 600, 600, 1500, 1.5, 100, -100);
  assert.ok(placement.width >= 600);
  assert.ok(placement.height >= 1500);
  assert.ok(placement.x <= 0);
  assert.ok(placement.y <= 0);
});

test('background image quality uses the effective 16:9 crop resolution', () => {
  assert.equal(backgroundImageQuality(3840, 2160).level, 'excellent');
  assert.equal(backgroundImageQuality(2560, 1600).level, 'good');
  assert.equal(backgroundImageQuality(1920, 1080).level, 'fair');
  assert.equal(backgroundImageQuality(1600, 900).level, 'low');
  assert.equal(backgroundImageQuality(2160, 3840).level, 'fair');
});

test('state merge updates matching IDs without duplicating schedule UIDs', () => {
  const base = { version: 2, profile: {}, settings: {}, semester: {}, courses: [{ id: 'c', name: '旧名' }], tasks: [], schedule: [{ id: 'e1', uid: 'u1' }], grades: [], notes: [], tags: [] };
  const incoming = { ...base, courses: [{ id: 'c', name: '新名' }], schedule: [{ id: 'e2', uid: 'u1' }] };
  const merged = mergeState(base, incoming);
  assert.equal(merged.courses.length, 1);
  assert.equal(merged.courses[0].name, '新名');
  assert.equal(merged.schedule.length, 1);
});
