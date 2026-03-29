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

// ===== IndexedDB 图片存储（解决 localStorage 5MB 限制）=====
const ImageDB = {
  DB_NAME: 'mako_image_db',
  DB_VERSION: 2,
  STORE_NAME: 'images',
  db: null,

  // 打开数据库
  open() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  },

  // 存储图片（使用 ArrayBuffer 避免浏览器兼容性问题）
  async storeImage(file) {
    console.log('ImageDB: Storing image, size:', file.size, 'bytes');

    // 将 File/Blob 转换为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('ImageDB: Converted to ArrayBuffer, size:', arrayBuffer.byteLength);

    const db = await this.open();
    const id = 'bg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      // 存储 ArrayBuffer 和 MIME 类型
      const request = store.put({
        id,
        data: arrayBuffer,
        mimeType: file.type,
        timestamp: Date.now()
      });

      request.onsuccess = () => {
        console.log('ImageDB: Stored successfully, id:', id);
        // 使用 blob URL 供 immediate 使用
        const blob = new Blob([arrayBuffer], { type: file.type });
        const blobUrl = URL.createObjectURL(blob);
        resolve({ id, blobUrl });
      };
      request.onerror = (e) => {
        console.error('ImageDB: Store failed:', e);
        reject(request.error);
      };
    });
  },

  // 获取图片 blob URL
  async getImageUrl(id) {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          const blob = new Blob([record.data], { type: record.mimeType });
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  // 删除图片
  async deleteImage(id) {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // 列出所有图片
  async listImages() {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
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
