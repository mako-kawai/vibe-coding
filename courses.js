/**
 * courses.js - 集中管理所有课程数据
 * mako's Learning
 */

// 默认课程数据
const DEFAULT_COURSES = {
  atmosphere: {
    id: 'atmosphere',
    name: '氛围编程',
    icon: '🌸',
    credit: 2,
    teacher: '学习科学实验室',
    status: 'in-progress',
    description: '探索 AI 辅助编程的奥秘，学习网页开发、数据处理、SKILL 设计等实用技能。不写代码！没有考试！氛围学习，轻松拿学分！',
    progress: 10,
    progressText: '1/9 模块完成',
    modules: ['认知与基础', '网页开发基础', '文档与文本处理', '数据处理与分析', '网络数据采集（自选）', 'SKILL设计', '网页开发进阶', '视频即代码', '综合项目', '课程总结']
  },
  math: {
    id: 'math',
    name: '高等数学',
    icon: '📐',
    credit: 4,
    category: 'Mathematics',
    status: 'in-progress',
    description: '微积分、线性代数与微分方程，构建数学基础。',
    hasPdf: true
  },
  mathmethods: {
    id: 'mathmethods',
    name: '数学物理方法',
    icon: '🔢',
    credit: 4,
    category: 'Physics',
    status: 'upcoming',
    description: '复变函数、积分变换与特殊函数，物理学的数学工具。',
    hasPdf: true
  },
  theophy: {
    id: 'theophy',
    name: '理论物理基础',
    icon: '⚛️',
    credit: 4,
    category: 'Physics',
    status: 'upcoming',
    description: '经典力学、热力学与统计物理，探索物理世界的基本原理。',
    hasPdf: true
  },
  macro: {
    id: 'macro',
    name: '中级宏观经济学',
    icon: '📊',
    credit: 3,
    category: 'Economics',
    status: 'upcoming',
    description: '国民收入核算、经济增长与宏观经济政策分析。',
    hasPdf: true
  }
};

// localStorage key
const USER_COURSES_KEY = 'user_courses';

/**
 * 获取所有课程（默认 + 用户添加 + 编辑过的默认课程 - 已删除的默认课程）
 */
function getAllCourses() {
  const userCourses = JSON.parse(localStorage.getItem(USER_COURSES_KEY) || '[]');
  const userCourseMap = {};
  userCourses.forEach(course => {
    userCourseMap[course.id] = course;
  });

  // 合并编辑过的默认课程
  const editedDefaults = getEditedDefaultCourses();
  const allDefaults = { ...DEFAULT_COURSES };
  Object.keys(editedDefaults).forEach(id => {
    if (allDefaults[id]) {
      allDefaults[id] = { ...allDefaults[id], ...editedDefaults[id] };
    }
  });

  // 过滤掉已删除的默认课程
  const deletedDefaults = getDeletedDefaultCourses();
  deletedDefaults.forEach(id => {
    delete allDefaults[id];
  });

  return { ...allDefaults, ...userCourseMap };
}

/**
 * 获取课程数组
 */
function getCoursesArray() {
  return Object.values(getAllCourses());
}

/**
 * 根据 ID 获取课程
 */
function getCourseById(id) {
  return getAllCourses()[id];
}

/**
 * 添加新课程
 */
function addUserCourse(courseData) {
  const userCourses = JSON.parse(localStorage.getItem(USER_COURSES_KEY) || '[]');

  // 生成 ID
  const id = 'user_' + Date.now();

  const newCourse = {
    id,
    name: courseData.name || '新课程',
    icon: courseData.icon || '📚',
    credit: courseData.credit || 3,
    category: courseData.category || '自定义',
    status: courseData.status || 'upcoming',
    description: courseData.description || '',
    hasPdf: false,
    isUserAdded: true,
    createdAt: new Date().toISOString()
  };

  userCourses.push(newCourse);
  localStorage.setItem(USER_COURSES_KEY, JSON.stringify(userCourses));

  return newCourse;
}

/**
 * 删除用户添加的课程
 */
function deleteUserCourse(courseId) {
  const userCourses = JSON.parse(localStorage.getItem(USER_COURSES_KEY) || '[]');
  const filtered = userCourses.filter(c => c.id !== courseId);
  localStorage.setItem(USER_COURSES_KEY, JSON.stringify(filtered));
}

/**
 * 获取已删除的默认课程ID列表
 */
function getDeletedDefaultCourses() {
  return JSON.parse(localStorage.getItem('default_courses_deleted') || '[]');
}

/**
 * 删除默认课程（标记为已删除）
 */
function deleteDefaultCourse(courseId) {
  const deleted = getDeletedDefaultCourses();
  if (!deleted.includes(courseId)) {
    deleted.push(courseId);
    localStorage.setItem('default_courses_deleted', JSON.stringify(deleted));
  }
}

/**
 * 综合删除课程（用户添加或默认课程）
 */
function deleteCourse(courseId) {
  const course = getCourseById(courseId);
  if (!course) return false;

  if (course.isUserAdded) {
    deleteUserCourse(courseId);
  } else {
    deleteDefaultCourse(courseId);
  }
  return true;
}

/**
 * 更新用户课程
 */
function updateUserCourse(courseId, updates) {
  const userCourses = JSON.parse(localStorage.getItem(USER_COURSES_KEY) || '[]');
  const index = userCourses.findIndex(c => c.id === courseId);
  if (index !== -1) {
    userCourses[index] = { ...userCourses[index], ...updates };
    localStorage.setItem(USER_COURSES_KEY, JSON.stringify(userCourses));
  }
}

/**
 * 渲染课程卡片到容器
 */
function renderCourseCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const courses = getCoursesArray();
  container.innerHTML = courses.map((course, index) => {
    const statusClass = course.status === 'in-progress' ? 'in-progress' :
                        course.status === 'completed' ? 'completed' : 'upcoming';
    const statusText = course.status === 'in-progress' ? '学习中' :
                       course.status === 'completed' ? '已完成' : '未开始';

    const progressHtml = course.progress !== undefined ? `
      <div class="course-progress">
        <div class="progress-bar">
          <div class="progress-fill progress-${Math.min(course.progress, 100)}"></div>
        </div>
        <span class="progress-text">${course.progressText || (course.progress + '%')}</span>
      </div>
    ` : '';

    const metaText = course.teacher ? `${course.teacher} · ${course.credit}学分` :
                     (course.category ? `${course.category} · ${course.credit}学分` : `${course.credit}学分`);

    return `
      <div class="course-card-main fade-in" data-course-id="${course.id}">
        <button type="button" class="course-edit-btn" onclick="openEditCourseModal('${course.id}')">✏️</button>
        <div class="course-card-header">
          <span class="course-icon">${course.icon}</span>
          <div class="course-info">
            <h3>${course.name}</h3>
            <p class="course-meta">${metaText}</p>
          </div>
          <span class="course-status ${statusClass}">${statusText}</span>
        </div>
        <p class="course-desc">${course.description}</p>
        ${progressHtml}
        <div class="course-actions">
          <button type="button" class="course-btn-secondary" onclick="openCourseDetailModal('${course.id}')">查看详情</button>
          <button type="button" class="course-btn-delete" onclick="handleDeleteCourse('${course.id}')">🗑️ 删除</button>
        </div>
      </div>
    `;
  }).join('');

  // 立即显示新添加的卡片（避免 IntersectionObserver 延迟）
  setTimeout(() => {
    container.querySelectorAll('.fade-in').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 100);
    });
  }, 0);
}

/**
 * 处理删除课程
 */
function handleDeleteCourse(courseId) {
  if (!confirm('确定要删除这门课程吗？此操作不可恢复。')) return;
  deleteCourse(courseId);
  renderCourseCards('coursesGrid');
}

/**
 * 打开编辑课程模态框
 */
function openEditCourseModal(courseId) {
  const course = getCourseById(courseId);
  if (!course) return;

  document.getElementById('editCourseId').value = courseId;
  document.getElementById('editCourseName').value = course.name;
  document.getElementById('editCourseIcon').value = course.icon;
  document.getElementById('editCourseCredit').value = course.credit;
  document.getElementById('editCourseCategory').value = course.category || '';
  document.getElementById('editCourseStatus').value = course.status;
  document.getElementById('editCourseDesc').value = course.description || '';

  // 显示/隐藏删除按钮（只有用户添加的课程可以删除）
  const deleteBtn = document.getElementById('deleteCourseBtn');
  if (deleteBtn) {
    deleteBtn.style.display = course.isUserAdded ? 'inline-block' : 'none';
  }

  document.getElementById('editCourseModal').style.display = 'flex';
}

/**
 * 处理编辑课程提交
 */
function handleEditCourse(e) {
  e.preventDefault();
  const courseId = document.getElementById('editCourseId').value;
  const updates = {
    name: document.getElementById('editCourseName').value,
    icon: document.getElementById('editCourseIcon').value || '📚',
    credit: parseInt(document.getElementById('editCourseCredit').value) || 3,
    category: document.getElementById('editCourseCategory').value || '自定义',
    status: document.getElementById('editCourseStatus').value,
    description: document.getElementById('editCourseDesc').value
  };

  // 检查是默认课程还是用户添加的课程
  const course = getCourseById(courseId);
  if (course && course.isUserAdded) {
    updateUserCourse(courseId, updates);
  } else {
    // 更新默认课程需要通过特殊方式
    updateDefaultCourse(courseId, updates);
  }

  renderCourseCards('coursesGrid');
  closeEditCourseModal();
}

function closeEditCourseModal() {
  document.getElementById('editCourseModal').style.display = 'none';
}

/**
 * 从编辑模态框删除课程
 */
function handleDeleteCourseFromEdit() {
  const courseId = document.getElementById('editCourseId').value;
  if (!confirm('确定要删除这门课程吗？此操作不可恢复。')) return;
  deleteCourse(courseId);
  renderCourseCards('coursesGrid');
  closeEditCourseModal();
}

/**
 * 打开课程详情模态框
 */
let currentDetailCourseId = null;

function openCourseDetailModal(courseId) {
  currentDetailCourseId = courseId;
  const course = getCourseById(courseId);
  if (!course) return;

  document.getElementById('detailCourseTitle').textContent = course.icon + ' ' + course.name;

  // 加载课程简介
  const introText = course.description || '暂无简介';
  document.getElementById('detailIntroText').textContent = introText;
  document.getElementById('detailIntroInput').value = course.description || '';

  // 加载笔记
  const notesKey = 'course_notes_' + courseId;
  const notes = localStorage.getItem(notesKey) || '';
  document.getElementById('detailNotesTextarea').value = notes;

  // 设置 GitHub 文件夹路径
  const folderPath = `https://github.com/mako-kawai/vibe-coding/tree/main/${courseId}`;
  document.getElementById('githubFolderPath').innerHTML = `<a href="${folderPath}" target="_blank">${folderPath}</a>`;

  // 渲染文件列表
  renderDetailFiles(courseId);

  // 渲染作业列表
  renderDetailHomework(courseId);

  // 重置 tab
  switchDetailTab('notes');

  document.getElementById('courseDetailModal').style.display = 'flex';
}

function closeCourseDetailModal() {
  document.getElementById('courseDetailModal').style.display = 'none';
  currentDetailCourseId = null;
}

function toggleCourseIntroEdit() {
  const viewEl = document.getElementById('detailIntroView');
  const editEl = document.getElementById('detailIntroEdit');
  viewEl.style.display = viewEl.style.display === 'none' ? 'block' : 'none';
  editEl.style.display = editEl.style.display === 'none' ? 'block' : 'none';
}

function cancelCourseIntroEdit() {
  const course = getCourseById(currentDetailCourseId);
  if (course) {
    document.getElementById('detailIntroInput').value = course.description || '';
  }
  document.getElementById('detailIntroView').style.display = 'block';
  document.getElementById('detailIntroEdit').style.display = 'none';
}

function saveCourseIntro() {
  if (!currentDetailCourseId) return;
  const intro = document.getElementById('detailIntroInput').value;
  const course = getCourseById(currentDetailCourseId);

  if (course.isUserAdded) {
    updateUserCourse(currentDetailCourseId, { description: intro });
  } else {
    updateDefaultCourse(currentDetailCourseId, { description: intro });
  }

  document.getElementById('detailIntroText').textContent = intro || '暂无简介';
  document.getElementById('detailIntroView').style.display = 'block';
  document.getElementById('detailIntroEdit').style.display = 'none';
  renderCourseCards('coursesGrid');
}

function switchDetailTab(tabName) {
  document.querySelectorAll('.detail-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.getElementById('detailNotesPanel').style.display = tabName === 'notes' ? 'block' : 'none';
  document.getElementById('detailFilesPanel').style.display = tabName === 'files' ? 'block' : 'none';
}

function saveDetailNotes() {
  if (!currentDetailCourseId) return;
  const notes = document.getElementById('detailNotesTextarea').value;
  const notesKey = 'course_notes_' + currentDetailCourseId;
  localStorage.setItem(notesKey, notes);
  alert('笔记已保存！');
}

function renderDetailFiles(courseId) {
  const container = document.getElementById('detailFilesList');
  const filesMeta = JSON.parse(localStorage.getItem('uploaded_files_meta') || '[]');
  const courseFiles = filesMeta.filter(f => f.courseId === courseId);

  if (courseFiles.length === 0) {
    container.innerHTML = '<div class="detail-files-empty">暂无上传文件</div>';
    return;
  }

  container.innerHTML = courseFiles.map(f => `
    <div class="detail-file-item">
      <span class="file-icon">${f.type === 'pdf' ? '📕' : '📄'}</span>
      <span class="file-name">${f.filename}</span>
      <button type="button" class="file-action-btn file-delete-btn" onclick="deleteDetailFile('${f.id}')">删除</button>
    </div>
  `).join('');
}

function deleteDetailFile(fileId) {
  if (!confirm('确定要删除这个文件吗？')) return;
  const filesMeta = JSON.parse(localStorage.getItem('uploaded_files_meta') || '[]');
  const filtered = filesMeta.filter(f => f.id !== fileId);
  localStorage.setItem('uploaded_files_meta', JSON.stringify(filtered));
  renderDetailFiles(currentDetailCourseId);
}

function renderDetailHomework(courseId) {
  const container = document.getElementById('detailHomeworkList');
  const homework = JSON.parse(localStorage.getItem('course_homework') || '[]');
  const courseHomework = homework.filter(h => h.courseId === courseId);

  if (courseHomework.length === 0) {
    container.innerHTML = '<div class="detail-homework-empty">暂无作业</div>';
    return;
  }

  courseHomework.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    return 0;
  });

  container.innerHTML = courseHomework.map(hw => {
    const statusClass = hw.completed ? 'completed' : '';
    const statusText = hw.completed ? '✓ 已完成' : '○ 待完成';
    return `
      <div class="detail-homework-item ${statusClass}">
        <label class="detail-hw-checkbox">
          <input type="checkbox" ${hw.completed ? 'checked' : ''}
                 onchange="toggleDetailHomework('${hw.id}')">
          <span class="checkmark"></span>
        </label>
        <div class="detail-hw-content">
          <span class="detail-hw-title">${hw.title}</span>
          ${hw.dueDate ? `<span class="detail-hw-date">截止：${hw.dueDate}</span>` : ''}
        </div>
        <button type="button" class="detail-hw-delete" onclick="deleteDetailHomework('${hw.id}')">×</button>
      </div>
    `;
  }).join('');
}

function toggleDetailHomework(homeworkId) {
  const homework = JSON.parse(localStorage.getItem('course_homework') || '[]');
  const item = homework.find(h => h.id === homeworkId);
  if (item) {
    item.completed = !item.completed;
    localStorage.setItem('course_homework', JSON.stringify(homework));
    renderDetailHomework(currentDetailCourseId);
  }
}

function deleteDetailHomework(homeworkId) {
  if (!confirm('确定要删除这个作业吗？')) return;
  const homework = JSON.parse(localStorage.getItem('course_homework') || '[]');
  const filtered = homework.filter(h => h.id !== homeworkId);
  localStorage.setItem('course_homework', JSON.stringify(filtered));
  renderDetailHomework(currentDetailCourseId);
}

function openDetailAddHomework() {
  if (!currentDetailCourseId) return;
  document.getElementById('detailHomeworkCourseId').value = currentDetailCourseId;
  document.getElementById('detailHomeworkTitle').value = '';
  document.getElementById('detailHomeworkDesc').value = '';
  document.getElementById('detailHomeworkDueDate').value = '';
  document.getElementById('detailAddHomeworkModal').style.display = 'flex';
}

function closeDetailAddHomeworkModal() {
  document.getElementById('detailAddHomeworkModal').style.display = 'none';
}

function handleDetailAddHomework(e) {
  e.preventDefault();
  const courseId = document.getElementById('detailHomeworkCourseId').value;
  const title = document.getElementById('detailHomeworkTitle').value;
  const desc = document.getElementById('detailHomeworkDesc').value;
  const dueDate = document.getElementById('detailHomeworkDueDate').value;

  if (!title) return;

  const homework = JSON.parse(localStorage.getItem('course_homework') || '[]');
  homework.push({
    id: 'hw_' + Date.now(),
    title,
    courseId,
    description: desc,
    dueDate: dueDate || null,
    completed: false,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem('course_homework', JSON.stringify(homework));

  closeDetailAddHomeworkModal();
  renderDetailHomework(courseId);
}

/**
 * 更新默认课程（存储在 localStorage 的副本）
 */
function updateDefaultCourse(courseId, updates) {
  const DEFAULT_COURSES_EDITED_KEY = 'default_courses_edited';
  const edited = JSON.parse(localStorage.getItem(DEFAULT_COURSES_EDITED_KEY) || '{}');
  edited[courseId] = { ...updates, edited: true };
  localStorage.setItem(DEFAULT_COURSES_EDITED_KEY, JSON.stringify(edited));
}

/**
 * 获取编辑后的默认课程
 */
function getEditedDefaultCourses() {
  return JSON.parse(localStorage.getItem('default_courses_edited') || '{}');
}

// 导出供外部使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getAllCourses, getCoursesArray, getCourseById, addUserCourse, deleteUserCourse, updateUserCourse, renderCourseCards };
}
