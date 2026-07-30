import { assetUrl, loadState, migrateLegacyNotes, updateState } from './store.js';

const NAV_ITEMS = [
  { id: 'dashboard', href: 'index.html', icon: 'layout-dashboard', label: '总览' },
  { id: 'tasks', href: 'tasks.html', icon: 'list-checks', label: '任务' },
  { id: 'courses', href: 'courses.html', icon: 'library-big', label: '课程' },
  { id: 'notes', href: 'notes.html', icon: 'notebook-pen', label: '笔记' },
  { id: 'schedule', href: 'schedule.html', icon: 'calendar-days', label: '日程' },
  { id: 'grades', href: 'grades.html', icon: 'chart-no-axes-column', label: '成绩' },
  { id: 'settings', href: 'settings.html', icon: 'settings-2', label: '设置' }
];

export function node(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value ?? '';
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined) element.setAttribute(key, value);
  });
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach(child => element.append(child instanceof Node ? child : document.createTextNode(String(child))));
  return element;
}

export function icon(name, size = 18) {
  return node('i', { 'data-lucide': name, width: size, height: size, 'aria-hidden': 'true' });
}

export function refreshIcons() {
  globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 1.8 } });
}

function renderShell(page) {
  const sidebar = node('aside', { class: 'app-sidebar' });
  const brand = node('a', { class: 'brand', href: 'index.html', 'aria-label': 'mako learning 总览' }, [
    node('span', { class: 'brand-mark', text: 'M' }),
    node('span', { class: 'brand-copy' }, [
      node('strong', { text: "mako's learning" }),
      node('small', { text: 'PHYSICS WORKSPACE' })
    ])
  ]);
  const nav = node('nav', { class: 'side-nav', 'aria-label': '主要导航' });
  NAV_ITEMS.forEach(item => {
    nav.append(node('a', {
      class: `nav-item${item.id === page ? ' active' : ''}`,
      href: item.href,
      'aria-current': item.id === page ? 'page' : null
    }, [icon(item.icon), node('span', { text: item.label })]));
  });
  const themeSwitch = node('div', { class: 'sidebar-footer' }, [
    node('span', { class: 'chapter-label', text: 'THEME SELECT' }),
    node('div', { class: 'theme-segments', role: 'group', 'aria-label': '主题' }, [
      ...['public', 'makura', 'yuzusoft'].map(theme => node('button', {
        class: 'theme-dot', type: 'button', title: theme === 'public' ? '原创主题' : theme === 'makura' ? '枕社风格' : '柚子社风格',
        dataset: { theme }, 'aria-label': theme
      }))
    ])
  ]);
  sidebar.append(brand, nav, themeSwitch);

  const header = node('header', { class: 'app-topbar' }, [
    node('div', { class: 'topbar-context' }, [
      node('span', { class: 'chapter-label', text: `CHAPTER / ${NAV_ITEMS.find(item => item.id === page)?.label || '学习'}` }),
      node('span', { class: 'offline-state', id: 'networkState', text: navigator.onLine ? 'ONLINE' : 'OFFLINE' })
    ]),
    node('div', { class: 'topbar-actions' }, [
      node('button', { class: 'icon-btn', type: 'button', title: '全局搜索', 'aria-label': '全局搜索', onClick: openGlobalSearch }, [icon('search')]),
      node('button', { class: 'primary-action', type: 'button', onClick: () => location.assign('tasks.html?new=1') }, [icon('plus'), node('span', { text: '新任务' })])
    ])
  ]);
  document.body.prepend(sidebar, header);

  sidebar.querySelectorAll('.theme-dot').forEach(button => {
    button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      updateState(draft => { draft.settings.theme = theme; });
      applyTheme(theme);
    });
  });
}

function globalSearchItems(query) {
  const state = loadState();
  const value = query.trim().toLowerCase();
  if (!value) return [];
  return [
    ...state.tasks.map(item => ({ type: '任务', title: item.title, href: `tasks.html?q=${encodeURIComponent(item.title)}` })),
    ...state.courses.map(item => ({ type: '课程', title: item.name, href: `courses.html?id=${encodeURIComponent(item.id)}` })),
    ...state.notes.map(item => ({ type: '笔记', title: item.title, href: `notes.html?id=${encodeURIComponent(item.id)}` }))
  ].filter(item => item.title.toLowerCase().includes(value)).slice(0, 12);
}

function openGlobalSearch() {
  const modal = document.getElementById('globalSearchModal');
  modal?.showModal();
  const input = document.getElementById('globalSearchInput');
  input?.focus();
}

function ensureGlobalSearch() {
  const dialog = node('dialog', { id: 'globalSearchModal', class: 'app-dialog search-dialog' });
  const input = node('input', { id: 'globalSearchInput', type: 'search', placeholder: '搜索任务、课程和笔记', autocomplete: 'off' });
  const results = node('div', { class: 'search-results', id: 'globalSearchResults' });
  input.addEventListener('input', () => {
    results.replaceChildren();
    globalSearchItems(input.value).forEach(item => {
      results.append(node('a', { class: 'search-hit', href: item.href }, [
        node('span', { class: 'tag', text: item.type }), node('strong', { text: item.title }), icon('arrow-up-right', 16)
      ]));
    });
  });
  dialog.append(node('div', { class: 'dialog-head' }, [
    node('div', {}, [node('span', { class: 'chapter-label', text: 'SEARCH' }), node('h2', { text: '全局搜索' })]),
    node('button', { class: 'icon-btn', type: 'button', title: '关闭', 'aria-label': '关闭', onClick: () => dialog.close() }, [icon('x')])
  ]), input, results);
  document.body.append(dialog);
}

export async function applyTheme(theme = loadState().settings.theme) {
  const state = loadState();
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('reduce-motion', Boolean(state.settings.reduceMotion));
  const assetId = state.settings.localThemeAssets?.[theme];
  if (assetId) {
    const url = await assetUrl(assetId);
    if (url) document.documentElement.style.setProperty('--local-theme-image', `url("${url}")`);
  } else {
    document.documentElement.style.removeProperty('--local-theme-image');
  }
  document.querySelectorAll('.theme-dot').forEach(button => button.classList.toggle('selected', button.dataset.theme === theme));
}

export function toast(message, tone = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = node('div', { class: 'toast-stack', 'aria-live': 'polite' });
    document.body.append(stack);
  }
  const item = node('div', { class: `toast ${tone}` }, [icon(tone === 'error' ? 'circle-alert' : tone === 'success' ? 'circle-check' : 'info'), node('span', { text: message })]);
  stack.append(item);
  setTimeout(() => item.remove(), 3200);
  refreshIcons();
}

export function openDialog(id) {
  document.getElementById(id)?.showModal();
}

export function closeDialog(id) {
  document.getElementById(id)?.close();
}

export function fillCourseOptions(select, { includeAll = false } = {}) {
  const current = select.value;
  select.replaceChildren();
  if (includeAll) select.append(node('option', { value: '', text: '全部课程' }));
  loadState().courses.forEach(course => select.append(node('option', { value: course.id, text: course.name })));
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker unavailable', error));
  }
}

export async function initApp(page) {
  renderShell(page);
  ensureGlobalSearch();
  await applyTheme();
  await migrateLegacyNotes().catch(error => console.warn('Legacy notes migration skipped', error));
  registerServiceWorker();
  window.addEventListener('online', () => { document.getElementById('networkState').textContent = 'ONLINE'; });
  window.addEventListener('offline', () => { document.getElementById('networkState').textContent = 'OFFLINE'; });
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close-dialog]');
    if (close) close.closest('dialog')?.close();
  });
  refreshIcons();
}
