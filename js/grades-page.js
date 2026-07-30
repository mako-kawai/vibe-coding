import { loadState, updateState } from './store.js';
import { createId, gpaForScore, gradeSummary, parseGradeCsv } from './logic.js';
import { fillCourseOptions, icon, initApp, node, openDialog, refreshIcons, toast } from './ui.js';

let editingId = null;

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
  document.getElementById('gpaRuleLabel').textContent = state.settings.gpaRule === 'linear4' ? '当前：个人线性规则' : '当前：2019 版公式';
  document.getElementById('earnedCredits').textContent = summary.earnedCredits.toFixed(1).replace('.0', '');
  document.getElementById('weightedAverage').textContent = summary.weightedAverage === null ? '--' : summary.weightedAverage.toFixed(2);
  document.getElementById('estimatedGpa').textContent = summary.estimatedGpa === null ? '--' : summary.estimatedGpa.toFixed(2);
  document.getElementById('gpaCredits').textContent = summary.gpaCredits.toFixed(1).replace('.0', '');
  document.getElementById('gradeExclusionNote').textContent = summary.exclusions.length ? `${summary.exclusions.length} 条非百分制或手动排除记录未进入 GPA 估算。` : '当前百分制成绩均已进入 GPA 估算。';
  const terms = [...new Set(state.grades.map(record => record.term).filter(Boolean))].sort().reverse();
  const termFilter = document.getElementById('gradeTermFilter');
  const selected = termFilter.value;
  termFilter.replaceChildren(node('option', { value: '', text: '全部学期' }), ...terms.map(term => node('option', { value: term, text: term })));
  termFilter.value = terms.includes(selected) ? selected : '';
  const records = state.grades.filter(record => !termFilter.value || record.term === termFilter.value);
  const body = document.getElementById('gradeTableBody');
  body.replaceChildren(...(records.length ? records.map(record => {
    const course = state.courses.find(item => item.id === record.courseId);
    const estimate = record.gradingMode === 'percentage' && !record.excludedFromGpa ? gpaForScore(record.value, state.settings.gpaRule)?.toFixed(2) : '不纳入';
    const edit = node('button', { class: 'icon-btn', type: 'button', title: '编辑成绩', 'aria-label': `编辑 ${course?.name || '课程'} 成绩` }, [icon('pencil')]);
    edit.addEventListener('click', () => openGrade(record));
    return node('tr', {}, [node('td', {}, [node('strong', { text: course?.name || record.courseName || '未知课程' }), node('small', { text: course?.code || '' })]), node('td', { text: record.term }), node('td', { text: String(record.credits) }), node('td', { text: record.gradingMode === 'percentage' ? '百分制' : record.gradingMode === 'letter' ? '等级制' : '合格制/状态' }), node('td', { class: 'grade-value', text: String(record.value) }), node('td', { text: estimate }), node('td', {}, [edit])]);
  }) : [node('tr', {}, [node('td', { colspan: '7' }, [node('div', { class: 'empty-inline' }, [node('p', { text: '还没有正式成绩记录。' })])])])]));
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
    updateState(draft => {
      parsed.records.forEach(record => {
        let course = draft.courses.find(item => item.name === record.courseName || (record.courseCode && item.code === record.courseCode));
        if (!course) {
          course = { id: createId('course'), name: record.courseName, code: record.courseCode, credits: record.credits, category: '历史课程', status: 'completed', color: '#52627a', description: '' };
          draft.courses.push(course);
        }
        draft.grades.push({ ...record, id: createId('grade'), courseId: course.id, excludedFromGpa: record.gradingMode !== 'percentage', recordedAt: new Date().toISOString() });
      });
    });
    result.append(node('p', { text: `成功导入 ${parsed.records.length} 条成绩记录。` })); render();
  }
  openDialog('csvResultDialog'); event.target.value = '';
});

document.getElementById('gradeCourse').addEventListener('change', () => {
  const course = loadState().courses.find(item => item.id === document.getElementById('gradeCourse').value);
  if (course) document.getElementById('gradeCreditsInput').value = course.credits;
});
document.getElementById('addGradeButton').addEventListener('click', () => openGrade());
document.getElementById('gradeTermFilter').addEventListener('change', render);

await initApp('grades'); render();
