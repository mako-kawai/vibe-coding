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
 * 获取所有课程（默认 + 用户添加）
 */
function getAllCourses() {
  const userCourses = JSON.parse(localStorage.getItem(USER_COURSES_KEY) || '[]');
  const userCourseMap = {};
  userCourses.forEach(course => {
    userCourseMap[course.id] = course;
  });
  return { ...DEFAULT_COURSES, ...userCourseMap };
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

    const moduleLink = course.id === 'atmosphere' ? 'modules/module1.html' : `notes.html?course=${course.id}`;
    const btnText = course.id === 'atmosphere' ? '开始学习' : '查看笔记';

    return `
      <div class="course-card-main fade-in" data-course-id="${course.id}">
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
          ${course.id === 'atmosphere' ? `<a href="${moduleLink}" class="course-btn">${btnText}</a>` : ''}
          <a href="notes.html?course=${course.id}" class="course-btn-secondary">查看笔记</a>
          ${course.hasPdf ? `<a href="pdf/${course.id}.html" class="course-btn-pdf">📄 PDF</a>` : ''}
          ${course.isUserAdded ? `<button type="button" class="course-btn-delete" onclick="handleDeleteCourse('${course.id}')">删除</button>` : ''}
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
  if (confirm('确定要删除这门课程吗？')) {
    deleteUserCourse(courseId);
    renderCourseCards('coursesGrid');
  }
}

// 导出供外部使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getAllCourses, getCoursesArray, getCourseById, addUserCourse, deleteUserCourse, updateUserCourse, renderCourseCards };
}
