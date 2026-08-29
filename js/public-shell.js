const PUBLIC_NAV = [
  { id: 'home', href: 'index.html', label: '首页' },
  { id: 'projects', href: 'projects.html', label: '项目' },
  { id: 'reviews', href: 'reviews.html', label: '书评' },
  { id: 'interests', href: 'interests.html', label: '兴趣' },
  { id: 'notes', href: 'notes-public.html', label: '公开笔记' },
  { id: 'about', href: 'about.html', label: '关于' },
  { id: 'dashboard', href: 'dashboard.html', label: '学习驾驶舱' }
];

const THEMES = ['public', 'makura', 'yuzusoft'];

export function publicNode(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  Object.entries(options).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value ?? '';
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else element.setAttribute(key, value);
  });
  const list = Array.isArray(children) ? children : [children];
  list.filter(Boolean).forEach(child => element.append(child instanceof Node ? child : document.createTextNode(String(child))));
  return element;
}

export function publicIcon(name, size = 17) {
  return publicNode('i', { 'data-lucide': name, width: size, height: size, 'aria-hidden': 'true' });
}

function storedTheme() {
  try {
    const value = localStorage.getItem('mako_public_theme');
    return THEMES.includes(value) ? value : 'public';
  } catch {
    return 'public';
  }
}

export function applyPublicTheme(theme = storedTheme()) {
  const next = THEMES.includes(theme) ? theme : 'public';
  document.documentElement.dataset.theme = next;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('reduce-motion');
  else document.documentElement.classList.remove('reduce-motion');
  document.querySelectorAll('[data-public-theme]').forEach(button => button.classList.toggle('selected', button.dataset.publicTheme === next));
}

function setStoredTheme(theme) {
  try { localStorage.setItem('mako_public_theme', theme); } catch { /* private browsing may reject storage */ }
  applyPublicTheme(theme);
}

function registerPublicServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Public service worker unavailable', error));
  }
}

export function initPublicShell(page) {
  applyPublicTheme();
  const header = publicNode('header', { class: 'public-header' }, [
    publicNode('a', { class: 'public-brand', href: 'index.html', 'aria-label': '返回个人主页' }, [
      publicNode('span', { class: 'public-brand-mark', text: 'M' }),
      publicNode('span', { class: 'public-brand-copy' }, [
        publicNode('strong', { text: "mako's archive" }),
        publicNode('small', { text: 'PERSONAL NOTES / WORKS / INTERESTS' })
      ])
    ]),
    publicNode('nav', { class: 'public-nav', 'aria-label': '个人网站导航' }, PUBLIC_NAV.map(item => publicNode('a', {
      class: `public-nav-item${item.id === page ? ' active' : ''}`,
      href: item.href,
      'aria-current': item.id === page ? 'page' : null
    }, [publicNode('span', { text: item.label })]))),
    publicNode('div', { class: 'public-header-actions' }, [
      publicNode('span', { class: 'public-network', id: 'publicNetwork', text: navigator.onLine ? 'ONLINE' : 'OFFLINE' }),
      publicNode('div', { class: 'public-theme-switch', role: 'group', 'aria-label': '公开页面主题' }, THEMES.map(theme => publicNode('button', {
        class: 'public-theme-dot', type: 'button', 'data-public-theme': theme,
        title: theme === 'public' ? '原创主题' : theme === 'makura' ? '枕社风格' : '柚子社风格',
        'aria-label': theme === 'public' ? '原创主题' : theme === 'makura' ? '枕社风格' : '柚子社风格'
      })))
    ])
  ]);
  document.body.prepend(header);
  document.querySelectorAll('[data-public-theme]').forEach(button => button.addEventListener('click', () => setStoredTheme(button.dataset.publicTheme)));
  const footer = publicNode('footer', { class: 'public-footer' }, [
    publicNode('div', { class: 'public-footer-inner' }, [
      publicNode('span', { text: 'mako / personal archive' }),
      publicNode('span', { text: '公开内容由本人明确维护；学习驾驶舱数据只保存在本地浏览器。' }),
      publicNode('a', { href: 'dashboard.html' }, [publicIcon('layout-dashboard', 14), publicNode('span', { text: '进入学习驾驶舱' })])
    ])
  ]);
  document.body.append(footer);
  registerPublicServiceWorker();
  window.addEventListener('online', () => { const item = document.getElementById('publicNetwork'); if (item) item.textContent = 'ONLINE'; });
  window.addEventListener('offline', () => { const item = document.getElementById('publicNetwork'); if (item) item.textContent = 'OFFLINE'; });
  globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 1.8 } });
}

export function publicLink(label, href, iconName = 'arrow-up-right', className = 'public-button secondary') {
  const external = /^https?:\/\//i.test(String(href || ''));
  return publicNode('a', {
    class: className, href,
    target: external ? '_blank' : null,
    rel: external ? 'noopener noreferrer' : null
  }, [publicIcon(iconName), publicNode('span', { text: label })]);
}
