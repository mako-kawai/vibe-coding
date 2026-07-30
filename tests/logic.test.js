import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeScheduleEvents, getDueState, gpaForScore, gradeSummary, legacyPkuGpa,
  mergeState, migrateLegacyTasks, parseGradeCsv
} from '../js/logic.js';

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

test('state merge updates matching IDs without duplicating schedule UIDs', () => {
  const base = { version: 2, profile: {}, settings: {}, semester: {}, courses: [{ id: 'c', name: '旧名' }], tasks: [], schedule: [{ id: 'e1', uid: 'u1' }], grades: [], notes: [], tags: [] };
  const incoming = { ...base, courses: [{ id: 'c', name: '新名' }], schedule: [{ id: 'e2', uid: 'u1' }] };
  const merged = mergeState(base, incoming);
  assert.equal(merged.courses.length, 1);
  assert.equal(merged.courses[0].name, '新名');
  assert.equal(merged.schedule.length, 1);
});
