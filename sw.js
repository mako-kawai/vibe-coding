const CACHE_PREFIX = 'mako-learning-static-';
const CACHE_NAME = `${CACHE_PREFIX}v2-20260731-r2`;

const CORE_FILES = [
  './', './index.html', './tasks.html', './courses.html', './notes.html',
  './schedule.html', './grades.html', './settings.html', './homework.html', './help.html',
  './styles.css', './manifest.webmanifest', './assets/app-icon.svg',
  './assets/theme-public.png', './assets/theme-makura.png', './assets/theme-yuzusoft.png',
  './js/logic.js', './js/store.js', './js/ui.js', './js/dashboard.js', './js/tasks.js',
  './js/courses-page.js', './js/notes-page.js', './js/schedule-page.js',
  './js/grades-page.js', './js/settings-page.js', './js/image-cropper.js',
  './vendor/lucide.min.js', './vendor/marked.min.js', './vendor/purify.min.js',
  './vendor/katex.min.css', './vendor/katex.min.js', './vendor/auto-render.min.js',
  './vendor/ical.min.js', './vendor/jszip.min.js',
  './pdf/math.html', './pdf/mathmethods.html', './pdf/theophy.html', './pdf/macro.html',
  './modules/module1.html', './modules/module2.html', './modules/module3.html',
  './modules/module4.html', './modules/module4plus.html', './modules/module5.html',
  './modules/module6.html', './modules/module7.html', './modules/module8.html', './modules/module9.html'
];

const KATEX_FONTS = [
  'KaTeX_AMS-Regular', 'KaTeX_Caligraphic-Bold', 'KaTeX_Caligraphic-Regular',
  'KaTeX_Fraktur-Bold', 'KaTeX_Fraktur-Regular', 'KaTeX_Main-Bold',
  'KaTeX_Main-BoldItalic', 'KaTeX_Main-Italic', 'KaTeX_Main-Regular',
  'KaTeX_Math-BoldItalic', 'KaTeX_Math-Italic', 'KaTeX_SansSerif-Bold',
  'KaTeX_SansSerif-Italic', 'KaTeX_SansSerif-Regular', 'KaTeX_Script-Regular',
  'KaTeX_Size1-Regular', 'KaTeX_Size2-Regular', 'KaTeX_Size3-Regular',
  'KaTeX_Size4-Regular', 'KaTeX_Typewriter-Regular'
].flatMap(name => ['ttf', 'woff', 'woff2'].map(extension => `./vendor/fonts/${name}.${extension}`));

const scopedUrl = path => new URL(path, self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...CORE_FILES, ...KATEX_FONTS].map(scopedUrl))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) || caches.match(scopedUrl('./index.html'))));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
