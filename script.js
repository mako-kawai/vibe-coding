// ===== 樱花飘落效果 =====
function createSakura() {
  const container = document.getElementById('sakuraContainer');
  const sakuraChars = ['❀', '✿', '❁', '✾', '🏵'];

  setInterval(() => {
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
  }, 400);
}

// ===== 淡入效果 =====
function handleScrollAnimation() {
  const elements = document.querySelectorAll('.fade-in');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // 添加延迟，实现依次出现
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

  // Tab 切换
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      if (tabName === 'edit') {
        if (editorPanel) editorPanel.style.display = 'block';
        if (previewPanel) previewPanel.style.display = 'none';
      } else {
        renderPreview(textarea.value);
        if (editorPanel) editorPanel.style.display = 'none';
        if (previewPanel) previewPanel.style.display = 'block';
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

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  createSakura();
  handleScrollAnimation();
  handleNavHighlight();
  initNotes();
});
