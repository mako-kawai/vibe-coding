import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeScheduleEvents, filterGradesByTerm, formatGpa, getDueState, gpaForScore, gradeSummary, gradeSummaryForCategory, groupGradesByTerm, legacyPkuGpa,
  mergeState, migrateLegacyTasks, parseGradeCsv, parseNoteMarkdown,
  isGpaEligibleRecord, normalizeCourseCategory, normalizePublicContentItem, normalizePublicSite, parsePkuGradeText, publicItemToManifest, publicSiteToManifest,
  safePublicAssetUrl, safePublicPath, safePublicUrl, serializeGradeTranscriptCsv, serializeNoteMarkdown, slugifyPublic, splitGradesByCategory
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

test('public content normalization keeps a stable safe schema', () => {
  assert.equal(slugifyPublic('  地球自转轴 / 模型  '), '地球自转轴-模型');
  assert.equal(slugifyPublic('', 'project'), 'project');
  assert.equal(safePublicUrl('javascript:alert(1)'), '');
  assert.equal(safePublicUrl('data:text/html,unsafe'), '');
  assert.equal(safePublicUrl('/outside/site.jpg'), '');
  assert.equal(safePublicPath('../outside.md'), '');
  assert.equal(safePublicPath('projects/%2e%2e/private.md'), '');
  assert.equal(safePublicPath('projects/%5C..%5Cprivate.md'), '');
  assert.equal(safePublicPath('projects/demo.md'), 'projects/demo.md');
  assert.equal(safePublicAssetUrl('https://example.com/avatar.jpg'), 'https://example.com/avatar.jpg');
  const item = normalizePublicContentItem({ id: 'p1', type: 'unknown', status: 'visible', title: '测试', tags: '物理,代码', bodyPath: '../private.md', cover: 'javascript:x', spoiler: 'false' });
  assert.equal(item.type, 'project');
  assert.equal(item.status, 'draft');
  assert.deepEqual(item.tags, ['物理', '代码']);
  assert.equal(item.bodyPath, '');
  assert.equal(item.cover, '');
  assert.equal(item.spoiler, false);
});

test('public manifests strip private local asset references', () => {
  const item = publicItemToManifest({ id: 'n1', type: 'note', title: '公开笔记', bodyAssetId: 'private-body', coverAssetId: 'private-cover', sourceNoteId: 'private-note' });
  assert.equal(item.bodyPath, 'notes/公开笔记.md');
  assert.equal('bodyAssetId' in item, false);
  assert.equal('coverAssetId' in item, false);
  assert.equal('sourceNoteId' in item, false);
  const site = publicSiteToManifest({ name: 'mako', avatar: 'media/avatar.png', avatarAssetId: 'local-only' });
  assert.equal(site.avatar, 'media/avatar.png');
  assert.equal('avatarAssetId' in site, false);
  assert.equal(normalizePublicSite({}).name, 'mako');
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

test('failed percentage grades are visible in averages but excluded from GPA credits', () => {
  const records = [
    { id: 'fail', gradingMode: 'percentage', value: 59, credits: 3 },
    { id: 'pass', gradingMode: 'percentage', value: 60, credits: 2 }
  ];
  const summary = gradeSummary(records, [], true, 'pku2019');
  assert.equal(summary.weightedAverage, 59.4);
  assert.equal(summary.gpaCredits, 2);
  assert.equal(summary.estimatedGpa, 1);
  assert.ok(summary.exclusions.some(item => item.id === 'fail' && item.reason.includes('不及格')));
  assert.equal(isGpaEligibleRecord(records[0]), false);
  assert.equal(isGpaEligibleRecord(records[1]), true);
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

test('transcript CSV quotes commas, quotes and line breaks', () => {
  const courses = [{ id: 'quoted', name: '课程 "A"\n第二行', category: '通选课' }];
  const records = [{ courseId: 'quoted', term: '2025-2026 学年度第1学期', credits: 2, gradingMode: 'percentage', value: 90 }];
  const csv = serializeGradeTranscriptCsv(records, courses);
  assert.match(csv, /"课程 ""A""\n第二行",通选课/);
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

test('state merge carries public site and content without exposing private note fields', () => {
  const base = { version: 2, profile: {}, settings: {}, semester: {}, courses: [], tasks: [], schedule: [], grades: [], notes: [], tags: [], publicSite: { name: '旧名' }, publicContent: [{ id: 'p1', type: 'project', title: '旧条目' }] };
  const incoming = { version: 2, publicSite: { headline: '新介绍' }, publicContent: [{ id: 'p2', type: 'review', title: '新条目', bodyAssetId: 'local' }] };
  const merged = mergeState(base, incoming);
  assert.equal(merged.publicSite.name, '旧名');
  assert.equal(merged.publicSite.headline, '新介绍');
  assert.deepEqual(merged.publicContent.map(item => item.id), ['p1', 'p2']);
  assert.equal(merged.publicContent[1].bodyAssetId, 'local');
});

test('state merge preserves local theme mappings from both backups', () => {
  const merged = mergeState(
    { version: 2, settings: { localThemeAssets: { public: 'asset-a' } }, courses: [], tasks: [], schedule: [], grades: [], notes: [], tags: [], publicContent: [] },
    { version: 2, settings: { localThemeAssets: { makura: 'asset-b' } }, courses: [], tasks: [], schedule: [], grades: [], notes: [], tags: [], publicContent: [] }
  );
  assert.deepEqual(merged.settings.localThemeAssets, { public: 'asset-a', makura: 'asset-b' });
});
