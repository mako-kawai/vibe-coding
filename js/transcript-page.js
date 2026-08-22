import { filterGradesByTerm, formatGpa, gpaForScore, gradeSummary, serializeGradeTranscriptCsv } from './logic.js';
import { loadState } from './store.js';
import { node, refreshIcons } from './ui.js';

const state = loadState();
const requestedTerm = new URLSearchParams(location.search).get('term')?.trim() || '';
const records = filterGradesByTerm(state.grades, requestedTerm);
const knownTerms = new Set(state.grades.map(record => record.term).filter(Boolean));
const summary = gradeSummary(records, state.courses, state.settings.gpaEnabled, state.settings.gpaRule);
const courseMap = new Map(state.courses.map(course => [course.id, course]));

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

function render() {
  const profile = state.profile || {};
  const scope = requestedTerm || '全部学期';
  document.getElementById('transcriptScope').textContent = `输出范围：${scope}`;
  document.getElementById('studentName').textContent = profile.displayName || '未设置';
  document.getElementById('studentDepartment').textContent = profile.department || '未设置';
  document.getElementById('studentCohort').textContent = profile.cohort ? `${profile.cohort} 级` : '未设置';
  document.getElementById('generatedAt').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium' }).format(new Date());
  document.getElementById('recordCount').textContent = `${records.length} 条记录`;
  if (requestedTerm && !knownTerms.has(requestedTerm)) {
    const warning = document.getElementById('transcriptWarning');
    warning.textContent = `没有找到“${requestedTerm}”的成绩记录。`;
    warning.classList.remove('hidden');
  }

  const body = document.getElementById('transcriptBody');
  body.replaceChildren(...(records.length ? records.map(record => {
    const course = courseMap.get(record.courseId);
    return node('tr', {}, [
      node('td', {}, [node('strong', { text: course?.name || record.courseName || '未知课程' }), node('small', { text: course?.code || record.courseCode || '' })]),
      node('td', { text: record.term || '未设置' }),
      node('td', { text: formatCredits(record.credits ?? course?.credits) }),
      node('td', { text: modeLabel(record.gradingMode) }),
      node('td', { class: 'grade-value', text: String(record.value ?? '') }),
      node('td', { text: gradeEstimate(record) })
    ]);
  }) : [node('tr', {}, [node('td', { colspan: '6' }, [node('div', { class: 'empty-inline' }, [node('p', { text: '当前范围内没有正式成绩记录。' })])])])]));

  document.getElementById('transcriptSummary').replaceChildren(
    renderMetric('已获学分', formatCredits(summary.earnedCredits)),
    renderMetric('百分制加权平均', summary.weightedAverage === null ? '--' : summary.weightedAverage.toFixed(2)),
    renderMetric('GPA 非官方估算', formatGpa(summary.estimatedGpa), 'accent'),
    renderMetric('纳入估算学分', formatCredits(summary.gpaCredits))
  );

  const terms = [...new Set(records.map(record => record.term).filter(Boolean))].sort().reverse();
  document.getElementById('termSummaries').replaceChildren(...terms.map(term => {
    const termRecords = filterGradesByTerm(records, term);
    const termSummary = gradeSummary(termRecords, state.courses, state.settings.gpaEnabled, state.settings.gpaRule);
    return node('div', { class: 'term-summary' }, [
      node('strong', { text: term }),
      node('span', { text: `${termRecords.length} 门课程 · ${formatCredits(termSummary.earnedCredits)} 学分` }),
      node('span', { text: `百分制平均 ${termSummary.weightedAverage === null ? '--' : termSummary.weightedAverage.toFixed(2)}` }),
      node('span', { text: `GPA ${formatGpa(termSummary.estimatedGpa)}` })
    ]);
  }));
  document.getElementById('transcriptGeneratedNote').textContent = `生成于 ${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full', timeStyle: 'short' }).format(new Date())}`;
  refreshIcons();
}

document.getElementById('printTranscript').addEventListener('click', () => window.print());
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
