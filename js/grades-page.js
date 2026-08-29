import { loadState, updateState } from './store.js?v=20260829';
import { UNCATEGORIZED, createId, filterGradesByTerm, formatGpa, gpaForScore, gradeSummary, gradeSummaryForCategory, isGpaEligibleRecord, normalizeCourseCategory, parseGradeCsv, parsePkuGradeText } from './logic.js?v=20260829';
import { fillCourseOptions, icon, initApp, node, openDialog, refreshIcons, toast } from './ui.js';

let editingId = null;
let pendingPortalRecords = [];

function importGradeRecords(records) {
  let added = 0;
  let updated = 0;
  updateState(draft => {
    records.forEach(record => {
      const rawValue = record.value ?? '';
      const mode = record.gradingMode || (/^\d+(?:\.\d+)?$/.test(String(rawValue)) ? 'percentage' : 'letter');
      let course = draft.courses.find(item => item.name === record.courseName || (record.courseCode && item.code === record.courseCode));
      if (!course) {
        course = { id: createId('course'), name: record.courseName, code: record.courseCode || '', credits: record.credits, category: normalizeCourseCategory(record.category || UNCATEGORIZED), status: 'completed', color: '#52627a', description: '' };
        draft.courses.push(course);
      } else if (record.category) {
        course.category = normalizeCourseCategory(record.category);
      }
      const payload = {
        courseId: course.id,
        term: record.term || draft.semester.name,
        credits: Number(record.credits) || Number(course.credits) || 0,
        gradingMode: mode,
        value: mode === 'percentage' ? Number(rawValue) : String(rawValue).toUpperCase(),
        status: String(record.status || (mode === 'percentage' ? '' : rawValue) || '').toUpperCase(),
        repeated: Boolean(record.repeated),
        excludedFromGpa: mode !== 'percentage',
        recordedAt: new Date().toISOString()
      };
      const existing = draft.grades.find(item => item.courseId === course.id && item.term === payload.term);
      if (existing) {
        Object.assign(existing, payload, { id: existing.id, excludedFromGpa: existing.excludedFromGpa || payload.excludedFromGpa });
        delete existing.category;
        delete existing.courseName;
        delete existing.courseCode;
        updated += 1;
      } else {
        draft.grades.push({ ...payload, id: createId('grade') });
        added += 1;
      }
    });
  });
  return { added, updated };
}

function openGrade(record = null) {
  const state = loadState();
  editingId = record?.id || null;
  fillCourseOptions(document.getElementById('gradeCourse'));
  const course = state.courses.find(item => item.id === record?.courseId) || state.courses[0];
  document.getElementById('gradeDialogTitle').textContent = record ? '编辑正式成绩' : '录入正式成绩';
  document.getElementById('gradeCourse').value = course?.id || '';
  document.getElementById('gradeTerm').value = record?.term || state.semester.name.replace('学期', '');
  document.getElementById('gradeCreditsInput').value = record?.credits ?? course?.credits ?? 0;
  document.getElementById('gradingMode').value = record?.gradingMode || 'percentage';
  document.getElementById('gradeValue').value = record?.value ?? '';
  document.getElementById('gradeExcluded').checked = Boolean(record?.excludedFromGpa);
  document.getElementById('deleteGradeButton').classList.toggle('hidden', !record);
  openDialog('gradeDialog');
}

function render() {
  const state = loadState();
  const summary = gradeSummary(state.grades, state.courses, state.settings.gpaEnabled, state.settings.gpaRule);
  const professionalSummary = gradeSummaryForCategory(state.grades, state.courses, '专业必修', state.settings.gpaEnabled, state.settings.gpaRule);
  document.getElementById('gpaRuleLabel').textContent = state.settings.gpaRule === 'linear4' ? '当前：个人线性规则' : '当前：2019 版公式';
  document.getElementById('earnedCredits').textContent = summary.earnedCredits.toFixed(1).replace('.0', '');
  document.getElementById('weightedAverage').textContent = summary.weightedAverage === null ? '--' : summary.weightedAverage.toFixed(2);
  document.getElementById('estimatedGpa').textContent = formatGpa(summary.estimatedGpa);
  document.getElementById('gpaCredits').textContent = summary.gpaCredits.toFixed(1).replace('.0', '');
  document.getElementById('professionalGpa').textContent = formatGpa(professionalSummary.estimatedGpa);
  document.getElementById('professionalGpaCredits').textContent = professionalSummary.gpaCredits.toFixed(1).replace('.0', '');
  document.getElementById('gradeExclusionNote').textContent = summary.exclusions.length ? `${summary.exclusions.length} 条非百分制或手动排除记录未进入 GPA 估算。` : '当前百分制成绩均已进入 GPA 估算。';
  const terms = [...new Set(state.grades.map(record => record.term).filter(Boolean))].sort().reverse();
  const termFilter = document.getElementById('gradeTermFilter');
  const selected = termFilter.value;
  termFilter.replaceChildren(node('option', { value: '', text: '全部学期' }), ...terms.map(term => node('option', { value: term, text: term })));
  termFilter.value = terms.includes(selected) ? selected : '';
  const records = filterGradesByTerm(state.grades, termFilter.value);
  const body = document.getElementById('gradeTableBody');
  body.replaceChildren(...(records.length ? records.map(record => {
    const course = state.courses.find(item => item.id === record.courseId);
    const estimate = isGpaEligibleRecord(record, state.settings.gpaEnabled !== false) ? formatGpa(gpaForScore(record.value, state.settings.gpaRule)) : '不纳入';
    const edit = node('button', { class: 'icon-btn', type: 'button', title: '编辑成绩', 'aria-label': `编辑 ${course?.name || '课程'} 成绩` }, [icon('pencil')]);
    edit.addEventListener('click', () => openGrade(record));
    return node('tr', {}, [node('td', {}, [node('strong', { text: course?.name || record.courseName || '未知课程' }), node('small', { text: course?.code || '' })]), node('td', { text: normalizeCourseCategory(course?.category || record.category) }), node('td', { text: record.term }), node('td', { text: String(record.credits) }), node('td', { text: record.gradingMode === 'percentage' ? '百分制' : record.gradingMode === 'letter' ? '等级制' : '合格制/状态' }), node('td', { class: 'grade-value', text: String(record.value) }), node('td', { text: estimate }), node('td', {}, [edit])]);
  }) : [node('tr', {}, [node('td', { colspan: '8' }, [node('div', { class: 'empty-inline' }, [node('p', { text: '还没有正式成绩记录。' })])])])]));
  refreshIcons();
}

document.getElementById('gradeForm').addEventListener('submit', event => {
  event.preventDefault();
  const mode = document.getElementById('gradingMode').value;
  const raw = document.getElementById('gradeValue').value.trim().toUpperCase();
  if (mode === 'percentage' && (!/^\d+(\.\d+)?$/.test(raw) || Number(raw) < 0 || Number(raw) > 100)) { toast('百分制成绩必须在 0 到 100 之间', 'error'); return; }
  if (mode === 'letter' && !['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'].includes(raw)) { toast('等级制成绩应为 A+ 至 D 或 F', 'error'); return; }
  if (mode === 'pass_fail' && !['P', 'NP', 'EX', 'I', 'IP', 'W', 'F'].includes(raw)) { toast('特殊状态应为 P、NP、EX、I、IP、W 或 F', 'error'); return; }
  updateState(draft => {
    const existing = editingId ? draft.grades.find(record => record.id === editingId) : null;
    const payload = { id: editingId || createId('grade'), courseId: document.getElementById('gradeCourse').value, term: document.getElementById('gradeTerm').value.trim(), credits: Number(document.getElementById('gradeCreditsInput').value) || 0, gradingMode: mode, value: mode === 'percentage' ? Number(raw) : raw, status: mode === 'percentage' ? '' : raw, repeated: false, excludedFromGpa: document.getElementById('gradeExcluded').checked, recordedAt: new Date().toISOString() };
    if (existing) Object.assign(existing, payload); else draft.grades.push(payload);
  });
  document.getElementById('gradeDialog').close(); render(); toast('正式成绩已保存', 'success');
});

document.getElementById('deleteGradeButton').addEventListener('click', () => {
  if (!editingId || !confirm('确定删除这条成绩记录？')) return;
  updateState(draft => { draft.grades = draft.grades.filter(record => record.id !== editingId); });
  document.getElementById('gradeDialog').close(); render();
});

document.getElementById('importGradeCsv').addEventListener('click', () => document.getElementById('gradeCsvInput').click());
document.getElementById('gradeCsvInput').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const parsed = parseGradeCsv(await file.text());
  const result = document.getElementById('csvResult'); result.replaceChildren();
  if (parsed.errors.length) {
    result.append(node('p', { class: 'error-copy', text: `未导入：${parsed.errors.length} 个问题` }), node('ul', {}, parsed.errors.map(error => node('li', { text: error }))));
  } else {
    const counts = importGradeRecords(parsed.records);
    result.append(node('p', { text: `导入完成：新增 ${counts.added} 条，更新 ${counts.updated} 条。` })); render();
  }
  openDialog('csvResultDialog'); event.target.value = '';
});

document.getElementById('openPortalImport').addEventListener('click', () => {
  pendingPortalRecords = [];
  document.getElementById('portalGradeText').value = '';
  document.getElementById('portalGradeResult').replaceChildren();
  document.getElementById('confirmPortalGrades').disabled = true;
  openDialog('portalGradeDialog');
  document.getElementById('portalGradeText').focus();
});

function parsePortalInput() {
  const parsed = parsePkuGradeText(document.getElementById('portalGradeText').value);
  pendingPortalRecords = parsed.records;
  const result = document.getElementById('portalGradeResult');
  const messages = [...parsed.errors.map(error => node('li', { class: 'error-copy', text: error })), ...parsed.warnings.map(warning => node('li', { text: warning }))];
  const preview = parsed.records.length ? node('div', { class: 'table-wrap import-table-wrap' }, [
    node('table', { class: 'data-table compact-table' }, [
      node('thead', {}, [node('tr', {}, ['课程', '课程类别', '学期', '学分', '成绩'].map(text => node('th', { text })))]),
      node('tbody', {}, parsed.records.map(record => node('tr', {}, [
        node('td', { text: record.courseName }), node('td', { text: record.category || '未分类' }), node('td', { text: record.term || '当前学期' }),
        node('td', { text: String(record.credits) }), node('td', { class: 'grade-value', text: String(record.value) })
      ])))
    ])
  ]) : null;
  result.replaceChildren(...[
    node('p', { class: parsed.records.length ? 'import-success' : 'error-copy', text: parsed.records.length ? `识别到 ${parsed.records.length} 门课程，请核对后导入。` : '尚未识别到可导入成绩。' }),
    messages.length ? node('ul', { class: 'import-messages' }, messages) : null,
    preview
  ].filter(Boolean));
  document.getElementById('confirmPortalGrades').disabled = parsed.records.length === 0;
}

document.getElementById('parsePortalGrades').addEventListener('click', parsePortalInput);
document.getElementById('loadGradeTextFile').addEventListener('click', () => document.getElementById('gradeTextInput').click());
document.getElementById('gradeTextInput').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  event.target.value = '';
  if (!text.trim()) {
    pendingPortalRecords = [];
    document.getElementById('confirmPortalGrades').disabled = true;
    document.getElementById('portalGradeResult').replaceChildren(node('p', { class: 'error-copy', text: '所选文本文件为空，请先确认文件中包含成绩内容。' }));
    return;
  }
  document.getElementById('portalGradeText').value = text;
  parsePortalInput();
});

document.getElementById('confirmPortalGrades').addEventListener('click', () => {
  if (!pendingPortalRecords.length) return;
  const counts = importGradeRecords(pendingPortalRecords);
  document.getElementById('portalGradeDialog').close();
  render();
  toast(`成绩已导入：新增 ${counts.added} 条，更新 ${counts.updated} 条`, 'success');
});

document.getElementById('gradeCourse').addEventListener('change', () => {
  const course = loadState().courses.find(item => item.id === document.getElementById('gradeCourse').value);
  if (course) document.getElementById('gradeCreditsInput').value = course.credits;
});
document.getElementById('addGradeButton').addEventListener('click', () => openGrade());
document.getElementById('gradeTermFilter').addEventListener('change', render);
document.getElementById('exportTranscriptButton').addEventListener('click', () => {
  const term = document.getElementById('gradeTermFilter').value;
  location.assign(`transcript.html${term ? `?term=${encodeURIComponent(term)}` : ''}`);
});

await initApp('grades'); render();
