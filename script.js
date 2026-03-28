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

// ===== 课程笔记功能 =====
function initNotes() {
  const textarea = document.getElementById('notesTextarea');
  const courseSelect = document.getElementById('courseSelect');
  const editorPanel = document.getElementById('notesEditor');
  const previewPanel = document.getElementById('notesPreview');
  const markdownBody = previewPanel ? previewPanel.querySelector('.markdown-body') : null;
  const saveBtn = document.getElementById('saveNotes');
  const clearBtn = document.getElementById('clearNotes');
  const statusEl = document.getElementById('notesStatus');
  const tabs = document.querySelectorAll('.notes-tab');

  if (!textarea) return;

  // 填充课程选择下拉框（去重）
  if (courseSelect) {
    // 检查是否已存在该课程选项
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

  function getStorageKey(courseId) {
    return 'course_notes_' + courseId;
  }

  function loadNotes(courseId) {
    const savedNotes = localStorage.getItem(getStorageKey(courseId));
    if (savedNotes) {
      textarea.value = savedNotes;
      statusEl.textContent = '已加载保存的笔记';
    } else {
      textarea.value = '';
      statusEl.textContent = '开始记录新笔记';
    }
    if (markdownBody) {
      renderPreview(textarea.value);
    }
  }

  function renderPreview(content) {
    if (typeof marked !== 'undefined' && markdownBody) {
      markdownBody.innerHTML = marked.parse(content);
    }
  }

  // 加载当前课程笔记
  const currentCourse = courseSelect ? courseSelect.value : 'atmosphere';
  loadNotes(currentCourse);

  // 课程切换
  if (courseSelect) {
    courseSelect.addEventListener('change', () => {
      loadNotes(courseSelect.value);
    });
  }

  // 实时预览（编辑模式下）
  textarea.addEventListener('input', () => {
    if (previewPanel && previewPanel.style.display !== 'none') {
      renderPreview(textarea.value);
    }
  });

  // 自动保存（每30秒）
  let lastSavedContent = textarea.value;
  const autoSaveInterval = setInterval(() => {
    if (textarea.value !== lastSavedContent) {
      const courseId = courseSelect ? courseSelect.value : 'atmosphere';
      localStorage.setItem(getStorageKey(courseId), textarea.value);
      lastSavedContent = textarea.value;
      if (statusEl) {
        statusEl.textContent = '已自动保存 ' + new Date().toLocaleTimeString();
      }
    }
  }, 30000);

  // 键盘快捷键 Ctrl+S 保存
  textarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      const courseId = courseSelect ? courseSelect.value : 'atmosphere';
      const content = textarea.value;
      localStorage.setItem(getStorageKey(courseId), content);
      lastSavedContent = content;
      if (statusEl) {
        statusEl.textContent = '已保存 ' + new Date().toLocaleTimeString();
      }
      if (saveBtn) {
        saveBtn.textContent = '✅ 已保存';
        setTimeout(() => { saveBtn.textContent = '💾 保存'; }, 1500);
      }
      showToast('笔记已保存', 'success');
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
        renderPreview(textarea.value);
        if (editorPanel) editorPanel.classList.add('notes-editor-hidden');
        if (previewPanel) previewPanel.classList.remove('notes-preview-hidden');
      }
    });
  });

  // 保存笔记
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const courseId = courseSelect ? courseSelect.value : 'atmosphere';
      const content = textarea.value;
      localStorage.setItem(getStorageKey(courseId), content);
      statusEl.textContent = '已保存 ' + new Date().toLocaleTimeString();

      saveBtn.textContent = '✅ 已保存';
      setTimeout(() => {
        saveBtn.textContent = '💾 保存';
      }, 1500);
    });
  }

  // 清空笔记
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('确定要清空当前课程的笔记吗？此操作不可恢复。')) {
        const courseId = courseSelect ? courseSelect.value : 'atmosphere';
        textarea.value = '';
        localStorage.removeItem(getStorageKey(courseId));
        statusEl.textContent = '已清空';
        if (markdownBody) markdownBody.innerHTML = '';
      }
    });
  }

  // 离开页面时自动保存
  window.addEventListener('beforeunload', () => {
    const courseId = courseSelect ? courseSelect.value : 'atmosphere';
    if (textarea.value) {
      localStorage.setItem(getStorageKey(courseId), textarea.value);
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
        document.body.style.backgroundImage = `url('${blobUrl}')`;
        return;
      }
    } catch (e) {
      console.warn('Failed to load page background:', e);
    }
  }

  // 回退到旧的全局 bgImage（兼容性）
  if (userSettings.bgImage) {
    document.body.style.backgroundImage = `url('${userSettings.bgImage}')`;
  }
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
