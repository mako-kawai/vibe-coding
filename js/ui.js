import { assetUrl, getAsset, loadState, migrateLegacyNotes, updateState } from './store.js';

const NAV_ITEMS = [
  { id: 'dashboard', href: 'dashboard.html', icon: 'layout-dashboard', label: '总览' },
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
  const state = loadState();
  const sidebar = node('aside', { class: 'app-sidebar' });
  const brand = node('a', { class: 'brand', href: 'dashboard.html', 'aria-label': 'mako learning 学习驾驶舱' }, [
    node('span', { class: 'brand-mark', text: (state.profile.displayName || 'M').trim().charAt(0).toUpperCase() || 'M' }),
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
    node('a', { class: 'topbar-home-link', href: 'index.html' }, [icon('user-round', 15), node('span', { text: '个人主页' })])
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

export function applyVisualSettings(state = loadState()) {
  const settings = state.settings || {};
  document.documentElement.style.setProperty('--theme-image-opacity', String((Number(settings.themeImageOpacity) || 100) / 100));
  document.documentElement.style.setProperty('--theme-image-saturation', `${Number(settings.themeImageSaturation) || 0}%`);
  document.documentElement.style.setProperty('--theme-image-brightness', `${Number(settings.themeImageBrightness) || 100}%`);
  const overlay = Math.min(0.92, Math.max(0.3, (Number(settings.themeOverlayOpacity) || 74) / 100));
  document.documentElement.style.setProperty('--theme-overlay-opacity', String(overlay));
  document.documentElement.style.setProperty('--theme-overlay-strong', String(Math.min(0.98, overlay + 0.16)));
  document.documentElement.dataset.backgroundMode = settings.backgroundMode === 'soft' ? 'soft' : 'clear';
  document.documentElement.style.setProperty('--sidebar-image-opacity', String((Number(settings.sidebarImageOpacity) || 0) / 100));
  document.documentElement.style.setProperty('--sidebar-image-saturation', `${Number(settings.sidebarImageSaturation) || 0}%`);
  document.documentElement.style.setProperty('--sidebar-image-brightness', `${Number(settings.sidebarImageBrightness) || 100}%`);
}

export async function applyTheme(theme = loadState().settings.theme) {
  const state = loadState();
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('reduce-motion', Boolean(state.settings.reduceMotion));
  applyVisualSettings(state);
  const themeAssetId = state.settings.localThemeAssets?.[theme];
  const [themeRecord, themeUrl, sidebarUrl, avatarUrl] = await Promise.all([
    themeAssetId ? getAsset(themeAssetId) : null,
    themeAssetId ? assetUrl(themeAssetId) : null,
    state.settings.sidebarImageAssetId ? assetUrl(state.settings.sidebarImageAssetId) : null,
    state.profile.avatarAssetId ? assetUrl(state.profile.avatarAssetId) : null
  ]);
  if (themeUrl) document.documentElement.style.setProperty('--local-theme-image', `url("${themeUrl}")`);
  else document.documentElement.style.removeProperty('--local-theme-image');
  if (sidebarUrl) document.documentElement.style.setProperty('--sidebar-image', `url("${sidebarUrl}")`);
  else document.documentElement.style.removeProperty('--sidebar-image');
  if (avatarUrl) document.documentElement.style.setProperty('--profile-avatar', `url("${avatarUrl}")`);
  else document.documentElement.style.removeProperty('--profile-avatar');
  const desktopCrop = themeRecord?.crop?.desktop || {};
  const mobileCrop = themeRecord?.crop?.mobile || desktopCrop;
  document.documentElement.style.setProperty('--theme-image-position-desktop', `${Number(desktopCrop.positionX ?? 50)}% ${Number(desktopCrop.positionY ?? 50)}%`);
  document.documentElement.style.setProperty('--theme-image-position-mobile', `${Number(mobileCrop.positionX ?? 50)}% ${Number(mobileCrop.positionY ?? 50)}%`);
  document.documentElement.style.setProperty('--theme-image-zoom-desktop', String(Math.max(1, Number(desktopCrop.zoom) || 1)));
  document.documentElement.style.setProperty('--theme-image-zoom-mobile', String(Math.max(1, Number(mobileCrop.zoom) || 1)));
  document.documentElement.classList.toggle('has-profile-avatar', Boolean(avatarUrl));
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
