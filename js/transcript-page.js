import { filterGradesByTerm, formatGpa, gpaForScore, gradeSummary, gradeSummaryForCategory, groupGradesByTerm, normalizeCourseCategory, serializeGradeTranscriptCsv, splitGradesByCategory } from './logic.js?v=20260822';
import { loadState, updateState } from './store.js?v=20260822';
import { node, refreshIcons } from './ui.js';

const state = loadState();
const requestedTerm = new URLSearchParams(location.search).get('term')?.trim() || '';
const records = filterGradesByTerm(state.grades, requestedTerm);
const courseMap = new Map(state.courses.map(course => [course.id, course]));
const { professional: professionalRecords, other: otherRecords } = splitGradesByCategory(records, state.courses);

function formatCredits(value) {
  return Number(value || 0).toFixed(1).replace('.0', '');
}

function modeLabel(mode) {
  return mode === 'percentage' ? '百分制' : mode === 'letter' ? '等级制' : '合格制/状态';
}

function gradeEstimate(record) {
  return record.gradingMode === 'percentage' && !record.excludedFromGpa
    ? formatGpa(gpaForScore(record.value, state.settings.gpaRule))
    : '不纳入';
}

function renderMetric(label, value, className = '') {
  return node('div', { class: `transcript-metric ${className}` }, [node('span', { text: label }), node('strong', { text: value })]);
}

function renderGradeRow(record) {
  const course = courseMap.get(record.courseId);
  const category = normalizeCourseCategory(course?.category || record.category);
  return node('tr', {}, [
    node('td', {}, [node('strong', { text: course?.name || record.courseName || '未知课程' }), node('small', { text: course?.code || record.courseCode || '' })]),
    node('td', { text: category }),
    node('td', { text: record.term || '未设置' }),
    node('td', { text: formatCredits(record.credits ?? course?.credits) }),
    node('td', { text: modeLabel(record.gradingMode) }),
    node('td', { class: 'grade-value', text: String(record.value ?? '') }),
    node('td', { text: gradeEstimate(record) })
  ]);
}

function emptyRow(message) {
  return node('tr', {}, [node('td', { colspan: '7' }, [node('div', { class: 'empty-inline' }, [node('p', { text: message })])])]);
}

function renderGroup(title, groupRecords, summary) {
  return node('section', { class: 'transcript-group' }, [
    node('div', { class: 'transcript-section-title' }, [node('h2', { text: title }), node('span', { text: `${groupRecords.length} 条记录` })]),
    node('div', { class: 'transcript-group-summary' }, [
      node('span', { text: `${formatCredits(summary.earnedCredits)} 学分` }),
      node('span', { text: `百分制平均 ${summary.weightedAverage === null ? '--' : summary.weightedAverage.toFixed(2)}` }),
      node('strong', { text: `GPA ${formatGpa(summary.estimatedGpa)}` })
    ]),
    node('div', { class: 'transcript-table-wrap' }, [
      node('table', { class: 'data-table transcript-table' }, [
        node('thead', {}, [node('tr', {}, ['课程', '课程类别', '学期', '学分', '记分方式', '成绩', '绩点估算'].map(text => node('th', { text })))]),
        node('tbody', {}, groupRecords.length ? groupRecords.map(renderGradeRow) : [emptyRow('该分组暂无正式成绩记录。')])
      ])
    ])
  ]);
}

function render() {
  const profile = state.profile || {};
  const scope = requestedTerm || '全部学期';
  const professionalSummary = gradeSummaryForCategory(records, state.courses, '专业必修', state.settings.gpaEnabled, state.settings.gpaRule);
  const summary = gradeSummary(records, state.courses, state.settings.gpaEnabled, state.settings.gpaRule);
  document.getElementById('transcriptScope').textContent = `输出范围：${scope}`;
  document.getElementById('studentNameInput').value = profile.displayName || '';
  document.getElementById('studentDepartment').textContent = profile.department || '未设置';
  document.getElementById('studentCohort').textContent = profile.cohort ? `${profile.cohort} 级` : '未设置';
  document.getElementById('generatedAt').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium' }).format(new Date());
  document.getElementById('recordCount').textContent = `${records.length} 条记录 · 百分制平均分保留两位`;
  document.getElementById('professionalRecordCount').textContent = `${professionalRecords.length} 条记录`;
  document.getElementById('nonProfessionalRecordCount').textContent = `${otherRecords.length} 条记录`;
  document.getElementById('professionalGpaSummary').replaceChildren(
    node('span', { text: `纳入 ${formatCredits(professionalSummary.gpaCredits)} 学分` }),
    node('span', { text: `百分制平均 ${professionalSummary.weightedAverage === null ? '--' : professionalSummary.weightedAverage.toFixed(2)}` }),
    node('strong', { text: `专业必修 GPA ${formatGpa(professionalSummary.estimatedGpa)}` })
  );
  if (requestedTerm && !new Set(state.grades.map(record => record.term).filter(Boolean)).has(requestedTerm)) {
    const warning = document.getElementById('transcriptWarning');
    warning.textContent = `没有找到“${requestedTerm}”的成绩记录。`;
    warning.classList.remove('hidden');
  }
  document.getElementById('professionalBody').replaceChildren(...(professionalRecords.length ? professionalRecords.map(renderGradeRow) : [emptyRow('暂无专业必修成绩记录。')]));
  document.getElementById('termGroups').replaceChildren(...groupGradesByTerm(otherRecords).map(({ term, records: termRecords }) => renderGroup(term, termRecords, gradeSummary(termRecords, state.courses, state.settings.gpaEnabled, state.settings.gpaRule))));
  document.getElementById('transcriptSummary').replaceChildren(
    renderMetric('已获学分', formatCredits(summary.earnedCredits)),
    renderMetric('百分制加权平均', summary.weightedAverage === null ? '--' : summary.weightedAverage.toFixed(2)),
    renderMetric('GPA 非官方估算', formatGpa(summary.estimatedGpa), 'accent'),
    renderMetric('纳入估算学分', formatCredits(summary.gpaCredits)),
    renderMetric('专业必修 GPA', formatGpa(professionalSummary.estimatedGpa), 'accent')
  );
  document.getElementById('transcriptGeneratedNote').textContent = `生成于 ${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full', timeStyle: 'short' }).format(new Date())}`;
  refreshIcons();
}

document.getElementById('printTranscript').addEventListener('click', () => window.print());
document.getElementById('studentNameInput').addEventListener('change', event => {
  const displayName = event.currentTarget.value.trim();
  updateState(draft => {
    draft.profile.displayName = displayName;
  });
  event.currentTarget.value = displayName;
});
document.getElementById('downloadTranscriptCsv').addEventListener('click', () => {
  const blob = new Blob([serializeGradeTranscriptCsv(records, state.courses, state.settings.gpaRule)], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `成绩单-${requestedTerm || '全部学期'}.csv`;
  document.body.append(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
});

render();
