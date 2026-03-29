// ===== 樱花飘落效果 =====
let sakuraEnabled = true;

function createSakura() {
  if (!sakuraEnabled) return;
  const container = document.getElementById('sakuraContainer');
  if (!container) return;
  const sakuraChars = ['❀', '✿', '❁', '✾', '🏵'];

  setInterval(() => {
    if (!sakuraEnabled) return;
    const sakura = document.createElement('div');
    sakura.classList.add('sakura');
    sakura.textContent = sakuraChars[Math.floor(Math.random() * sakuraChars.length)];

    // 随机初始位置
    sakura.style.left = Math.random() * 100 + '%';

    // 随机大小
    const size = Math.random() * 15 + 12;
    sakura.style.fontSize = size + 'px';

    // 随机动画时长
    const duration = Math.random() * 5 + 8;
    sakura.style.animationDuration = duration + 's';

    // 随机透明度
    sakura.style.opacity = Math.random() * 0.4 + 0.4;

    container.appendChild(sakura);

    // 动画结束后移除元素
    setTimeout(() => {
      sakura.remove();
    }, duration * 1000);
  }, 150);
}

// ===== Toast 通知系统 =====
function showToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== 防抖函数 =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ===== 深色模式 =====
function initDarkMode() {
  const userSettings = JSON.parse(localStorage.getItem('user_settings') || '{}');
  if (userSettings.darkMode) {
    document.body.classList.add('dark-mode');
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  const userSettings = JSON.parse(localStorage.getItem('user_settings') || '{}');
  userSettings.darkMode = isDark;
  localStorage.setItem('user_settings', JSON.stringify(userSettings));
  showToast(isDark ? '深色模式已开启' : '深色模式已关闭', 'success');
  // 更新按钮文字
  updateDarkModeBtn(isDark);
}

function updateDarkModeBtn(isDark) {
  const btn = document.getElementById('darkModeBtn');
  if (btn) btn.textContent = isDark ? '☀️ 浅色模式' : '🌙 深色模式';
}

function toggleSakura() {
  sakuraEnabled = !sakuraEnabled;
  const userSettings = JSON.parse(localStorage.getItem('user_settings') || '{}');
  userSettings.sakuraEnabled = sakuraEnabled;
  localStorage.setItem('user_settings', JSON.stringify(userSettings));
  showToast(sakuraEnabled ? '樱花动画已开启' : '樱花动画已关闭', 'success');
  updateSakuraBtn();
}

function updateSakuraBtn() {
  const btn = document.getElementById('sakuraBtn');
  if (btn) btn.textContent = sakuraEnabled ? '🌸 樱花动画' : '🚫 樱花动画';
}

function initSakuraSetting() {
  const userSettings = JSON.parse(localStorage.getItem('user_settings') || '{}');
  if (userSettings.sakuraEnabled === false) {
    sakuraEnabled = false;
  }
  updateSakuraBtn();
  updateDarkModeBtn(userSettings.darkMode);
}

// ===== 全局搜索 =====
function openSearchModal() {
  document.getElementById('searchModal').style.display = 'flex';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
  document.getElementById('searchInput').focus();
}

function closeSearchModal() {
  document.getElementById('searchModal').style.display = 'none';
}

function performSearch() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const resultsContainer = document.getElementById('searchResults');

  if (!query) {
    resultsContainer.innerHTML = '';
    return;
  }

  const results = [];
  const courses = typeof getCoursesArray !== 'undefined' ? getCoursesArray() : [];

  // 搜索笔记
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('course_notes_')) {
      const content = localStorage.getItem(key);
      if (content && content.toLowerCase().includes(query)) {
        const courseId = key.replace('course_notes_', '');
        const course = courses.find(c => c.id === courseId);
        const lines = content.split('\n');
        const matchedLine = lines.find(l => l.toLowerCase().includes(query)) || '';
        results.push({
          type: '笔记',
          title: course ? `${course.icon} ${course.name}` : '未知课程',
          meta: '课程笔记',
          content: matchedLine.substring(0, 100)
        });
      }
    }
  }

  // 搜索作业
  const homework = JSON.parse(localStorage.getItem('course_homework') || '[]');
  homework.forEach(hw => {
    if (hw.title.toLowerCase().includes(query) || (hw.description && hw.description.toLowerCase().includes(query))) {
      const course = courses.find(c => c.id === hw.courseId);
      results.push({
        type: '作业',
        title: hw.title,
        meta: course ? `${course.icon} ${course.name}` : '未知课程',
        content: hw.description ? hw.description.substring(0, 80) : ''
      });
    }
  });

  // 搜索待办
  const todos = JSON.parse(localStorage.getItem('user_todos') || '[]');
  todos.forEach(todo => {
    if (todo.text.toLowerCase().includes(query)) {
      results.push({
        type: '待办',
        title: todo.text,
        meta: todo.dueDate ? `截止: ${todo.dueDate}` : '无截止日期',
        content: ''
      });
    }
  });

  // 渲染结果
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-no-results">未找到相关内容</div>';
    return;
  }

  resultsContainer.innerHTML = results.map(r => `
    <div class="search-result-item">
      <div class="search-result-title">${r.title}</div>
      <div class="search-result-meta">${r.type} · ${r.meta}</div>
      ${r.content ? `<div class="search-result-content">${r.content}</div>` : ''}
    </div>
  `).join('');
}

// ===== 数据备份与导出 =====
function exportAllData() {
  const data = {
    user_courses: localStorage.getItem('user_courses') || '[]',
    default_courses_edited: localStorage.getItem('default_courses_edited') || '{}',
    default_courses_deleted: localStorage.getItem('default_courses_deleted') || '[]',
    user_todos: localStorage.getItem('user_todos') || '[]',
    course_homework: localStorage.getItem('course_homework') || '[]',
    course_table_items: localStorage.getItem('course_table_items') || '[]',
    course_periods: localStorage.getItem('course_periods') || '[]',
    semester_settings: localStorage.getItem('semester_settings') || '{}',
    uploaded_files_meta: localStorage.getItem('uploaded_files_meta') || '[]',
    user_settings: localStorage.getItem('user_settings') || '{}',
    course_notes: {}
  };

  // 获取所有笔记
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('course_notes_')) {
      data.course_notes[key] = localStorage.getItem(key);
    }
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mako-learning-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据导出成功！', 'success');
}

function importAllData(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      // 恢复各项数据
      const keys = [
        'user_courses', 'default_courses_edited', 'default_courses_deleted',
        'user_todos', 'course_homework', 'course_table_items',
        'course_periods', 'semester_settings', 'uploaded_files_meta', 'user_settings'
      ];

      keys.forEach(key => {
        if (data[key]) {
          localStorage.setItem(key, data[key]);
        }
      });

      // 恢复笔记
      if (data.course_notes) {
        Object.entries(data.course_notes).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      }

      showToast('数据导入成功！请刷新页面。', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast('导入失败：文件格式错误', 'error');
    }
  };
  reader.readAsText(file);
}

// ===== 淡入效果 =====
function handleScrollAnimation() {
  const elements = document.querySelectorAll('.fade-in');

  // 立即显示已在视口中的元素
  elements.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setTimeout(() => {
        el.classList.add('visible');
      }, index * 100);
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 100);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

// ===== 导航高亮 =====
function handleNavHighlight() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  window.addEventListener('scroll', () => {
    let current = '';

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 100;
      const sectionHeight = section.clientHeight;

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  });
}

// ===== 多笔记功能 =====
let currentNoteId = null;
let lastSavedContent = '';

function getNotesListKey(courseId) {
  return 'notes_list_' + courseId;
}

function getNoteContentKey(courseId, noteId) {
  return 'note_content_' + courseId + '_' + noteId;
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function loadNotesList(courseId) {
  const noteSelect = document.getElementById('noteSelect');
  if (!noteSelect) return;

  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  const currentValue = noteSelect.value;

  noteSelect.innerHTML = '<option value="">➕ 新建笔记</option>';
  notesList.forEach(note => {
    const option = document.createElement('option');
    option.value = note.id;
    option.textContent = note.name + ' (' + formatDate(note.updatedAt) + ')';
    noteSelect.appendChild(option);
  });

  if (currentValue && notesList.find(n => n.id === currentValue)) {
    noteSelect.value = currentValue;
  } else if (notesList.length > 0) {
    noteSelect.value = notesList[0].id;
  }
}

function loadNoteContent(courseId, noteId) {
  const textarea = document.getElementById('notesTextarea');
  const statusEl = document.getElementById('notesStatus');
  const previewPanel = document.getElementById('notesPreview');
  const markdownBody = previewPanel ? previewPanel.querySelector('.markdown-body') : null;

  if (!noteId) {
    textarea.value = '';
    lastSavedContent = '';
    currentNoteId = null;
    if (statusEl) statusEl.textContent = '新建笔记中...';
    if (markdownBody) markdownBody.innerHTML = '';
    return;
  }

  currentNoteId = noteId;
  const content = localStorage.getItem(getNoteContentKey(courseId, noteId)) || '';
  textarea.value = content;
  lastSavedContent = content;

  // 加载笔记标签
  loadNoteTagIds(courseId, noteId);
  renderNotesTagsList();

  if (statusEl) {
    const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
    const note = notesList.find(n => n.id === noteId);
    statusEl.textContent = note ? '已加载: ' + note.name : '已加载笔记';
  }

  if (markdownBody) {
    renderNotePreview(content);
  }
}

function saveCurrentNote() {
  const courseSelect = document.getElementById('courseSelect');
  const textarea = document.getElementById('notesTextarea');
  const statusEl = document.getElementById('notesStatus');
  if (!courseSelect || !textarea) return;

  const courseId = courseSelect.value;
  const content = textarea.value;

  if (!currentNoteId) {
    showToast('请先选择或创建笔记', 'info');
    return;
  }

  localStorage.setItem(getNoteContentKey(courseId, currentNoteId), content);
  lastSavedContent = content;

  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  const noteIndex = notesList.findIndex(n => n.id === currentNoteId);
  if (noteIndex !== -1) {
    notesList[noteIndex].updatedAt = Date.now();
    localStorage.setItem(getNotesListKey(courseId), JSON.stringify(notesList));
    loadNotesList(courseId);
  }

  if (statusEl) statusEl.textContent = '已保存 ' + new Date().toLocaleTimeString();
  showToast('笔记已保存', 'success');
}

function createNewNote() {
  const courseSelect = document.getElementById('courseSelect');
  const noteSelect = document.getElementById('noteSelect');
  if (!courseSelect || !noteSelect) return;

  const courseId = courseSelect.value;
  const noteName = prompt('请输入笔记名称：', '新笔记 ' + new Date().toLocaleDateString());
  if (!noteName) return;

  const noteId = 'note_' + Date.now();
  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  notesList.unshift({
    id: noteId,
    name: noteName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tagIds: []
  });
  localStorage.setItem(getNotesListKey(courseId), JSON.stringify(notesList));

  loadNotesList(courseId);
  noteSelect.value = noteId;
  loadNoteContent(courseId, noteId);
  currentNoteTagIds = [];
  renderNotesTagsList();
  showToast('已创建新笔记', 'success');
}

function deleteCurrentNote() {
  const courseSelect = document.getElementById('courseSelect');
  const noteSelect = document.getElementById('noteSelect');
  if (!courseSelect || !noteSelect) return;

  const courseId = courseSelect.value;
  if (!currentNoteId) {
    showToast('没有要删除的笔记', 'info');
    return;
  }

  if (!confirm('确定要删除当前笔记吗？此操作不可恢复。')) return;

  let notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  notesList = notesList.filter(n => n.id !== currentNoteId);
  localStorage.setItem(getNotesListKey(courseId), JSON.stringify(notesList));
  localStorage.removeItem(getNoteContentKey(courseId, currentNoteId));

  if (notesList.length > 0) {
    noteSelect.value = notesList[0].id;
    loadNoteContent(courseId, notesList[0].id);
  } else {
    loadNoteContent(courseId, null);
  }
  loadNotesList(courseId);
  showToast('笔记已删除', 'success');
}

function renameCurrentNote() {
  const courseSelect = document.getElementById('courseSelect');
  const noteSelect = document.getElementById('noteSelect');
  if (!courseSelect || !noteSelect || !currentNoteId) return;

  const courseId = courseSelect.value;
  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  const note = notesList.find(n => n.id === currentNoteId);
  if (!note) return;

  const newName = prompt('请输入新的笔记名称：', note.name);
  if (!newName || newName.trim() === note.name) return;

  note.name = newName.trim();
  note.updatedAt = Date.now();
  localStorage.setItem(getNotesListKey(courseId), JSON.stringify(notesList));
  loadNotesList(courseId);
  noteSelect.value = currentNoteId;
  showToast('笔记已重命名', 'success');
}

function importMarkdownFile() {
  const courseSelect = document.getElementById('courseSelect');
  const noteSelect = document.getElementById('noteSelect');
  const mdImportInput = document.getElementById('mdImportInput');
  if (!courseSelect || !noteSelect || !mdImportInput) return;

  mdImportInput.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const courseId = courseSelect.value;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const noteId = 'note_' + Date.now();
      const noteName = file.name.replace('.md', '').replace('.txt', '');
      const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
      notesList.unshift({
        id: noteId,
        name: noteName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tagIds: []
      });
      localStorage.setItem(getNotesListKey(courseId), JSON.stringify(notesList));
      localStorage.setItem(getNoteContentKey(courseId, noteId), evt.target.result);

      loadNotesList(courseId);
      noteSelect.value = noteId;
      loadNoteContent(courseId, noteId);
      showToast('已导入: ' + noteName, 'success');
    };
    reader.readAsText(file);
    mdImportInput.value = '';
  };
  mdImportInput.click();
}

function exportMarkdownFile() {
  const courseSelect = document.getElementById('courseSelect');
  const textarea = document.getElementById('notesTextarea');
  if (!courseSelect || !textarea) return;

  const courseId = courseSelect.value;
  const content = textarea.value;
  if (!content) {
    showToast('没有内容可导出', 'info');
    return;
  }

  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  const note = notesList.find(n => n.id === currentNoteId);
  const filename = (note ? note.name : '笔记') + '.md';

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出: ' + filename, 'success');
}

// ===== 笔记标签管理 =====
let currentNoteTagIds = []; // 当前笔记的标签

function loadNoteTagIds(courseId, noteId) {
  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  const note = notesList.find(n => n.id === noteId);
  if (note && note.tagIds) {
    currentNoteTagIds = [...note.tagIds];
  } else {
    currentNoteTagIds = [];
  }
}

function saveNoteTagIds(courseId, noteId) {
  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
  const noteIndex = notesList.findIndex(n => n.id === noteId);
  if (noteIndex !== -1) {
    notesList[noteIndex].tagIds = currentNoteTagIds;
    localStorage.setItem(getNotesListKey(courseId), JSON.stringify(notesList));
  }
}

function toggleNoteTag(tagId) {
  const index = currentNoteTagIds.indexOf(tagId);
  if (index === -1) {
    currentNoteTagIds.push(tagId);
  } else {
    currentNoteTagIds.splice(index, 1);
  }
  const courseSelect = document.getElementById('courseSelect');
  if (courseSelect && currentNoteId) {
    saveNoteTagIds(courseSelect.value, currentNoteId);
  }
  renderNotesTagsList();
}

function renderNotesTagsList() {
  const container = document.getElementById('tagsList');
  const tags = loadNotesTags();
  const currentCourse = document.getElementById('courseSelect')?.value;
  if (!currentCourse) {
    container.innerHTML = '<span class="tags-empty">请先选择课程</span>';
    return;
  }
  const courseTags = tags.filter(t => t.courseId === currentCourse);

  if (courseTags.length === 0) {
    container.innerHTML = '<span class="tags-empty">当前课程暂无标签</span>';
    return;
  }

  container.innerHTML = courseTags.map(tag => {
    const isSelected = currentNoteTagIds.includes(tag.id);
    const icon = tag.icon ? tag.icon + ' ' : '';
    return `
      <span class="tag-item ${isSelected ? 'tag-selected' : ''}"
            style="background-color: ${tag.color}20; border-color: ${tag.color};"
            onclick="toggleNoteTag('${tag.id}')" title="点击切换标签">
        <span class="tag-name">${icon}${tag.name}${isSelected ? ' ✓' : ''}</span>
      </span>
    `;
  }).join('');
}

function renderNotePreview(content) {
  const previewPanel = document.getElementById('notesPreview');
  const markdownBody = previewPanel ? previewPanel.querySelector('.markdown-body') : null;
  if (typeof marked !== 'undefined' && markdownBody) {
    // 保护公式块，防止 marked 处理其中的内容
    const formulas = [];
    let processedContent = content;

    // 保护 $$...$$ 块（display 公式）
    processedContent = processedContent.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      formulas.push(match);
      return `<<<FORMULA_${formulas.length - 1}>>>`;
    });

    // 保护 \[...\] 块
    processedContent = processedContent.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
      formulas.push(match);
      return `<<<FORMULA_${formulas.length - 1}>>>`;
    });

    // 保护 $...$ 块（行内公式）
    processedContent = processedContent.replace(/\$[^\$\n]+?\$/g, (match) => {
      formulas.push(match);
      return `<<<FORMULA_${formulas.length - 1}>>>`;
    });

    // 保护 \(...\) 块
    processedContent = processedContent.replace(/\\\([\s\S]*?\\\)/g, (match) => {
      formulas.push(match);
      return `<<<FORMULA_${formulas.length - 1}>>>`;
    });

    // marked 解析
    let html = marked.parse(processedContent);

    // 恢复公式（转回原始格式）
    formulas.forEach((formula, index) => {
      html = html.replace(`<<<FORMULA_${index}>>>`, formula);
    });

    markdownBody.innerHTML = html;
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(markdownBody, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\[', right: '\\]', display: true},
          {left: '\\(', right: '\\)', display: false}
        ],
        throwOnError: false,
        strict: function() { return false; },
        trust: true
      });
    }
  }
}

// ===== 课程笔记功能 =====
function initNotes() {
  const textarea = document.getElementById('notesTextarea');
  const courseSelect = document.getElementById('courseSelect');
  const noteSelect = document.getElementById('noteSelect');
  const editorPanel = document.getElementById('notesEditor');
  const previewPanel = document.getElementById('notesPreview');
  const markdownBody = previewPanel ? previewPanel.querySelector('.markdown-body') : null;
  const saveBtn = document.getElementById('saveNotes');
  const statusEl = document.getElementById('notesStatus');
  const tabs = document.querySelectorAll('.notes-tab');
  const mdImportInput = document.getElementById('mdImportInput');

  if (!textarea) return;

  // 填充课程选择下拉框（去重）
  if (courseSelect) {
    const existingValues = Array.from(courseSelect.options).map(o => o.value);
    const courses = typeof getCoursesArray !== 'undefined' ? getCoursesArray() : [];
    courses.forEach(c => {
      if (!existingValues.includes(c.id)) {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.icon + ' ' + c.name;
        courseSelect.appendChild(option);
      }
    });
  }

  // 初始化笔记列表
  const currentCourse = courseSelect ? courseSelect.value : 'atmosphere';
  loadNotesList(currentCourse);
  const notesList = JSON.parse(localStorage.getItem(getNotesListKey(currentCourse)) || '[]');
  if (notesList.length > 0) {
    loadNoteContent(currentCourse, notesList[0].id);
  }
  renderNotesTagsList();

  // 课程切换
  if (courseSelect) {
    courseSelect.addEventListener('change', () => {
      const courseId = courseSelect.value;
      loadNotesList(courseId);
      const notes = JSON.parse(localStorage.getItem(getNotesListKey(courseId)) || '[]');
      if (notes.length > 0) {
        loadNoteContent(courseId, notes[0].id);
      } else {
        loadNoteContent(courseId, null);
      }
      renderNotesTagsList();
    });
  }

  // 笔记切换
  if (noteSelect) {
    noteSelect.addEventListener('change', () => {
      const courseId = courseSelect ? courseSelect.value : 'atmosphere';
      loadNoteContent(courseId, noteSelect.value);
      renderNotesTagsList();
    });
  }

  // 实时预览
  textarea.addEventListener('input', () => {
    if (previewPanel && previewPanel.style.display !== 'none') {
      renderNotePreview(textarea.value);
    }
  });

  // 自动保存（每30秒）
  setInterval(() => {
    if (textarea.value !== lastSavedContent && currentNoteId) {
      const courseId = courseSelect ? courseSelect.value : 'atmosphere';
      localStorage.setItem(getNoteContentKey(courseId, currentNoteId), textarea.value);
      lastSavedContent = textarea.value;
      if (statusEl) {
        statusEl.textContent = '已自动保存 ' + new Date().toLocaleTimeString();
      }
    }
  }, 30000);

  // Ctrl+S 保存
  textarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveCurrentNote();
      const saveBtn = document.getElementById('saveNotes');
      if (saveBtn) {
        saveBtn.textContent = '✅ 已保存';
        setTimeout(() => { saveBtn.textContent = '💾 保存'; }, 1500);
      }
    }
  });

  // Tab 切换
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      if (tabName === 'edit') {
        if (editorPanel) editorPanel.classList.remove('notes-editor-hidden');
        if (previewPanel) previewPanel.classList.add('notes-preview-hidden');
      } else {
        renderNotePreview(textarea.value);
        if (editorPanel) editorPanel.classList.add('notes-editor-hidden');
        if (previewPanel) previewPanel.classList.remove('notes-preview-hidden');
      }
    });
  });

  // 保存按钮
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveCurrentNote();
      saveBtn.textContent = '✅ 已保存';
      setTimeout(() => { saveBtn.textContent = '💾 保存'; }, 1500);
    });
  }

  // 离开页面时保存
  window.addEventListener('beforeunload', () => {
    if (textarea.value !== lastSavedContent && currentNoteId) {
      const courseId = courseSelect ? courseSelect.value : 'atmosphere';
      localStorage.setItem(getNoteContentKey(courseId, currentNoteId), textarea.value);
    }
  });
}

// ===== 背景图初始化（支持 per-page + IndexedDB）=====
async function initGlobalBackground() {
  const userSettings = JSON.parse(localStorage.getItem('user_settings') || '{}');
  const bgImages = userSettings.bgImages || {};

  // 获取当前页面标识
  const path = window.location.pathname;
  const pageId = path.split('/').pop()?.replace('.html', '') || 'index';

  // 优先使用 per-page 背景
  if (bgImages[pageId]) {
    try {
      const blobUrl = await ImageDB.getImageUrl(bgImages[pageId]);
      if (blobUrl) {
        // 测试图片是否能实际加载
        const img = new Image();
        img.onload = () => {
          document.body.style.background = `url('${blobUrl}')`;
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundPosition = 'center';
          document.body.style.backgroundAttachment = 'fixed';
          document.body.style.backgroundRepeat = 'no-repeat';
        };
        img.onerror = () => {
          // 图片加载失败，清除设置并使用默认渐变
          console.warn('Background image failed to load, using default gradient');
          delete bgImages[pageId];
          userSettings.bgImages = bgImages;
          localStorage.setItem('user_settings', JSON.stringify(userSettings));
        };
        img.src = blobUrl;
        return;
      }
    } catch (e) {
      console.warn('Failed to load page background:', e);
    }
  }

  // 回退到旧的全局 bgImage（兼容性）
  if (userSettings.bgImage) {
    document.body.style.background = `url('${userSettings.bgImage}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat = 'no-repeat';
  }
  // 否则使用 CSS 默认渐变背景（由 styles.css 定义）
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  createSakura();
  handleScrollAnimation();
  handleNavHighlight();
  initNotes();
  initGlobalBackground();
});

// 键盘快捷键 Ctrl+K 打开搜索
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openSearchModal();
  }
  if (e.key === 'Escape') {
    closeSearchModal();
  }
});

// 点击模态框外部关闭
document.addEventListener('click', (e) => {
  if (e.target.id === 'searchModal') {
    closeSearchModal();
  }
});
