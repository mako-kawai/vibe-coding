// utils.js - 通用工具函数
// 封装常用工具函数，减少全局污染

// ===== localStorage 工具 =====
const Storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('localStorage save failed:', e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  }
};

// ===== Toast 通知 =====
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

// ===== 日期格式化 =====
function formatDate(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateFull(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== 确认对话框 =====
function confirmAction(message) {
  return confirm(message);
}

// ===== 复制到剪贴板 =====
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
    return true;
  } catch {
    showToast('复制失败', 'error');
    return false;
  }
}

// ===== 事件委托辅助 =====
function delegateEvent(element, selector, eventType, handler) {
  element.addEventListener(eventType, (e) => {
    const target = e.target.closest(selector);
    if (target && element.contains(target)) {
      handler.call(target, e);
    }
  });
}

// ===== DOM ready =====
function DOMReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

// ===== 关闭模态框（通过点击外部）=====
function setupModalCloseOnBackdrop(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// ===== 通用模态框打开/关闭 =====
const Modal = {
  open(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
  },

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  },

  closeAll() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  }
};

// ===== 用户设置管理 =====
const UserSettings = {
  KEY: 'user_settings',

  get(key, defaultValue = null) {
    const settings = Storage.get(this.KEY, {});
    return settings[key] !== undefined ? settings[key] : defaultValue;
  },

  set(key, value) {
    const settings = Storage.get(this.KEY, {});
    settings[key] = value;
    Storage.set(this.KEY, settings);
  },

  getAll() {
    return Storage.get(this.KEY, {});
  }
};

// ===== 初始化通用功能 =====
function initCommonFeatures() {
  // 点击模态框外部关闭
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });

  // ESC 键关闭模态框
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Modal.closeAll();
    }
  });
}

// 页面加载时自动初始化
DOMReady(initCommonFeatures);

// 导出供外部使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Storage,
    showToast,
    debounce,
    formatDate,
    formatDateFull,
    confirmAction,
    copyToClipboard,
    delegateEvent,
    DOMReady,
    setupModalCloseOnBackdrop,
    Modal,
    UserSettings,
    initCommonFeatures
  };
}
