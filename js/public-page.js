import { loadPublicBundle, publicCover, publicDate, publicItemHref, publicTags, renderPublicMarkdown } from './public-content.js';
import { initPublicShell, publicIcon, publicLink, publicNode } from './public-shell.js';

const page = document.body.dataset.publicPage || 'home';
const root = document.getElementById('publicContent');

function emptyState(title, copy, href = '', label = '') {
  return publicNode('div', { class: 'public-empty' }, [
    publicIcon('inbox'), publicNode('h2', { text: title }), publicNode('p', { text: copy }),
    href ? publicLink(label, href, 'arrow-right', 'public-button secondary') : null
  ]);
}

function sectionHeading(kicker, title, copy = '', href = '', label = '') {
  return publicNode('div', { class: 'public-section-heading' }, [
    publicNode('div', {}, [publicNode('span', { class: 'public-kicker', text: kicker }), publicNode('h2', { text: title }), copy ? publicNode('p', { text: copy }) : null]),
    href ? publicLink(label, href, 'arrow-right', 'public-text-link') : null
  ]);
}

function avatar(site) {
  if (site.avatar) return publicNode('img', { class: 'public-avatar-image', src: site.avatar, alt: `${site.name} 头像` });
  return publicNode('span', { class: 'public-avatar-initial', text: site.name.trim().charAt(0).toUpperCase() || 'M' });
}

function projectCard(item) {
  const facts = [item.projectStatus, item.stack?.slice(0, 3).join(' · ')].filter(Boolean).join(' / ');
  return publicNode('article', { class: 'public-item-card' }, [
    publicCover(item),
    publicNode('div', { class: 'public-item-card-body' }, [
      publicNode('div', { class: 'public-item-meta' }, [publicNode('span', { text: item.type === 'project' ? 'PROJECT' : item.type.toUpperCase() }), item.publishedAt ? publicNode('time', { text: publicDate(item.publishedAt) }) : null]),
      publicNode('h3', {}, [publicNode('a', { href: publicItemHref(item), text: item.title })]),
      item.summary ? publicNode('p', { text: item.summary }) : null,
      facts ? publicNode('small', { class: 'public-item-facts', text: facts }) : null,
      publicTags(item.tags),
      publicNode('a', { class: 'public-text-link', href: publicItemHref(item) }, [publicNode('span', { text: '查看记录' }), publicIcon('arrow-up-right', 14)])
    ])
  ]);
}

function genericCard(item) {
  const label = item.type === 'review' ? 'BOOK REVIEW' : item.type === 'interest' ? 'INTEREST' : 'PUBLIC NOTE';
  const facts = [
    item.author,
    item.readingDate ? `阅读于 ${publicDate(item.readingDate)}` : '',
    item.rating === null || item.rating === undefined ? '' : `评分 ${item.rating}/5`
  ].filter(Boolean).join(' · ');
  return publicNode('article', { class: 'public-item-card compact' }, [
    publicCover(item),
    publicNode('div', { class: 'public-item-card-body' }, [
      publicNode('div', { class: 'public-item-meta' }, [publicNode('span', { text: label }), item.publishedAt ? publicNode('time', { text: publicDate(item.publishedAt) }) : null]),
      publicNode('h3', {}, [publicNode('a', { href: publicItemHref(item), text: item.title })]),
      item.summary ? publicNode('p', { text: item.summary }) : null,
      facts ? publicNode('small', { class: 'public-item-facts', text: facts }) : null,
      publicTags(item.tags)
    ])
  ]);
}

function renderHome(bundle) {
  const { site, items } = bundle;
  const projects = items.filter(item => item.type === 'project');
  const featured = site.featuredProjectIds.map(id => projects.find(item => item.id === id)).filter(Boolean);
  const selectedProjects = (featured.length ? featured : projects).slice(0, 3);
  const recent = items.filter(item => item.type !== 'project').sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 3);
  root.replaceChildren(
    publicNode('section', { class: 'public-intro' }, [
      publicNode('div', { class: 'public-identity-mark' }, [avatar(site)]),
      publicNode('div', { class: 'public-intro-copy' }, [
        publicNode('span', { class: 'public-kicker', text: 'PERSONAL ARCHIVE / 个人档案' }),
        publicNode('h1', { text: site.name }),
        publicNode('p', { class: 'public-headline', text: site.headline }),
        publicNode('p', { class: 'public-bio', text: site.bio }),
        publicNode('div', { class: 'public-intro-actions' }, [
          publicLink('进入学习驾驶舱', 'dashboard.html', 'layout-dashboard', 'public-button primary'),
          site.links[0] ? publicLink(site.links[0].label, site.links[0].url, 'github', 'public-button secondary') : null
        ])
      ]),
      publicNode('aside', { class: 'public-focus-panel' }, [
        publicNode('span', { class: 'public-kicker', text: 'NOW / 当前关注' }),
        publicNode('div', { class: 'public-focus-list' }, (site.focus.length ? site.focus : ['物理', '代码', '阅读']).map(item => publicNode('span', { text: item }))),
        publicNode('p', { text: '把正在学习、正在制作和正在阅读的事物放在同一张地图上。' })
      ])
    ]),
    publicNode('section', { class: 'public-section' }, [
      sectionHeading('SELECTED WORKS', '正在做的事', '一些仍在持续生长的项目。', 'projects.html', '查看全部项目'),
      publicNode('div', { class: 'public-card-grid projects-grid' }, selectedProjects.length ? selectedProjects.map(projectCard) : [emptyState('还没有公开项目', '在内容工作台中添加第一个项目。', 'content-studio.html', '打开内容工作台')])
    ]),
    publicNode('section', { class: 'public-section public-split-section' }, [
      publicNode('div', {}, [sectionHeading('RECENT RECORDS', '最近记录', '明确发布的书评和学习笔记。', '', ''), recent.length ? publicNode('div', { class: 'public-card-stack' }, recent.map(genericCard)) : emptyState('还没有公开记录', '书评或笔记明确发布后会出现在这里。')]),
      publicNode('aside', { class: 'public-quiet-panel' }, [
        publicNode('span', { class: 'public-kicker', text: 'A SMALL INDEX' }),
        publicNode('h2', { text: '一份慢慢长大的目录' }),
        publicNode('p', { text: '这里不追求把所有事情都展示出来，只保留值得回看的片段。' }),
        publicNode('div', { class: 'public-quiet-links' }, [
          publicNode('a', { href: 'reviews.html' }, [publicNode('span', { text: '课外书评' }), publicIcon('arrow-up-right', 14)]),
          publicNode('a', { href: 'interests.html' }, [publicNode('span', { text: '兴趣与长期关注' }), publicIcon('arrow-up-right', 14)]),
          publicNode('a', { href: 'about.html' }, [publicNode('span', { text: '关于这里' }), publicIcon('arrow-up-right', 14)])
        ])
      ])
    ])
  );
}

function collectionConfig(type) {
  return {
    project: ['PROJECTS', '项目', '以摘要、代码和结果链接记录正在制作的东西。'],
    review: ['READING', '课外书评', '不急着给每本书下结论，先记录它留下的疑问。'],
    interest: ['INTERESTS', '兴趣与长期关注', '一些会反复回到的主题、作品和方向。'],
    note: ['PUBLIC NOTES', '公开笔记', '从课程笔记中明确发布的可分享片段。']
  }[type];
}

function renderCollection(type, bundle) {
  const [kicker, title, lead] = collectionConfig(type);
  const items = bundle.items.filter(item => item.type === type);
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const detail = slug ? items.find(item => item.slug === slug) : null;
  if (slug) {
    if (detail) renderDetail(detail, bundle);
    else root.replaceChildren(emptyState('没有找到这条公开记录', '它可能尚未发布，或链接已经失效。', `${type === 'project' ? 'projects' : type === 'review' ? 'reviews' : type === 'interest' ? 'interests' : 'notes-public'}.html`, '返回列表'));
    return;
  }
  const search = publicNode('input', { class: 'public-search', type: 'search', placeholder: `搜索${title}`, 'aria-label': `搜索${title}` });
  const list = publicNode('div', { class: 'public-card-grid collection-grid' });
  const renderList = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = items.filter(item => !query || `${item.title} ${item.summary} ${(item.tags || []).join(' ')}`.toLowerCase().includes(query));
    list.replaceChildren(...(filtered.length ? filtered.map(item => type === 'project' ? projectCard(item) : genericCard(item)) : [emptyState('没有匹配的记录', '换一个关键词，或稍后再来看看。')]));
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 1.8 } });
  };
  search.addEventListener('input', renderList);
  renderList();
  root.replaceChildren(publicNode('section', { class: 'public-section public-list-page' }, [
    publicNode('div', { class: 'public-page-title' }, [publicNode('span', { class: 'public-kicker', text: kicker }), publicNode('h1', { text: title }), publicNode('p', { text: lead })]),
    publicNode('div', { class: 'public-list-tools' }, [publicNode('span', { text: `${items.length} 条公开记录` }), search]),
    list
  ]));
}

function renderDetail(item, bundle) {
  const back = item.type === 'project' ? 'projects.html' : item.type === 'review' ? 'reviews.html' : item.type === 'interest' ? 'interests.html' : 'notes-public.html';
  const meta = [item.publishedAt ? `发布于 ${publicDate(item.publishedAt)}` : '', item.author, item.projectStatus].filter(Boolean).join(' · ');
  const links = [
    item.sourceUrl ? publicLink('源代码', item.sourceUrl, 'github', 'public-button secondary') : null,
    item.demoUrl ? publicLink('在线演示', item.demoUrl, 'external-link', 'public-button secondary') : null,
    ...(item.links || []).map(link => publicLink(link.label, link.url, 'arrow-up-right', 'public-button secondary'))
  ].filter(Boolean);
  const reviewFacts = item.type === 'review' ? [
    item.author ? publicNode('div', { class: 'public-fact-block' }, [publicNode('span', { class: 'public-kicker', text: 'AUTHOR' }), publicNode('p', { text: item.author })]) : null,
    item.readingDate ? publicNode('div', { class: 'public-fact-block' }, [publicNode('span', { class: 'public-kicker', text: 'READING DATE' }), publicNode('p', { text: publicDate(item.readingDate) })]) : null,
    item.rating === null || item.rating === undefined ? null : publicNode('div', { class: 'public-fact-block' }, [publicNode('span', { class: 'public-kicker', text: 'RATING' }), publicNode('p', { text: `${item.rating} / 5` })]),
    item.spoiler ? publicNode('div', { class: 'public-fact-block spoiler-note' }, [publicNode('span', { class: 'public-kicker', text: 'SPOILER' }), publicNode('p', { text: '本文包含剧透提示。' })]) : null
  ].filter(Boolean) : [];
  const body = publicNode('article', { class: 'markdown-body public-article-body' });
  renderPublicMarkdown(body, item.body);
  root.replaceChildren(publicNode('article', { class: 'public-detail' }, [
    publicNode('a', { class: 'public-back-link', href: back }, [publicIcon('arrow-left', 15), publicNode('span', { text: '返回列表' })]),
    publicNode('div', { class: 'public-detail-layout' }, [
      publicNode('div', { class: 'public-detail-main' }, [
        publicNode('div', { class: 'public-page-title' }, [publicNode('span', { class: 'public-kicker', text: item.type === 'project' ? 'PROJECT' : item.type === 'review' ? 'BOOK REVIEW' : item.type === 'interest' ? 'INTEREST' : 'PUBLIC NOTE' }), publicNode('h1', { text: item.title }), item.summary ? publicNode('p', { class: 'public-detail-summary', text: item.summary }) : null]),
        meta ? publicNode('p', { class: 'public-detail-meta', text: meta }) : null,
        publicTags(item.tags),
        body
      ]),
      publicNode('aside', { class: 'public-detail-aside' }, [
        publicCover(item, { detail: true }),
        ...reviewFacts,
        item.stack?.length ? publicNode('div', { class: 'public-fact-block' }, [publicNode('span', { class: 'public-kicker', text: 'STACK' }), publicNode('p', { text: item.stack.join(' · ') })]) : null,
        item.highlights?.length ? publicNode('div', { class: 'public-fact-block' }, [publicNode('span', { class: 'public-kicker', text: 'HIGHLIGHTS' }), publicNode('ul', {}, item.highlights.map(value => publicNode('li', { text: value })))]) : null,
        links.length ? publicNode('div', { class: 'public-detail-links' }, links) : null
      ])
    ])
  ]));
}

function renderAbout(bundle) {
  const { site } = bundle;
  root.replaceChildren(publicNode('section', { class: 'public-section public-about-page' }, [
    publicNode('div', { class: 'public-page-title' }, [publicNode('span', { class: 'public-kicker', text: 'ABOUT THIS ARCHIVE' }), publicNode('h1', { text: '关于这里' }), publicNode('p', { text: site.headline })]),
    publicNode('div', { class: 'public-about-grid' }, [
      publicNode('article', { class: 'public-essay' }, [publicNode('p', { text: site.bio }), publicNode('p', { text: '这是一个个人档案，不试图替代正式简历，也不把每一段经历都包装成成果。项目、阅读和兴趣会以适合回看的速度慢慢补上。' })]),
      publicNode('aside', { class: 'public-quiet-panel' }, [publicNode('span', { class: 'public-kicker', text: 'CONTACT' }), publicNode('div', { class: 'public-detail-links' }, site.links.map(link => publicLink(link.label, link.url, 'arrow-up-right', 'public-button secondary'))), publicNode('p', { class: 'public-privacy-note', text: '学习驾驶舱中的任务、成绩、日程和私人笔记不会出现在这个公开网站。' })])
    ])
  ]));
}

async function start() {
  initPublicShell(page);
  try {
    const bundle = await loadPublicBundle();
    if (page === 'home') renderHome(bundle);
    else if (page === 'about') renderAbout(bundle);
    else renderCollection(page === 'projects' ? 'project' : page === 'reviews' ? 'review' : page === 'interests' ? 'interest' : 'note', bundle);
    globalThis.lucide?.createIcons?.({ attrs: { 'stroke-width': 1.8 } });
  } catch (error) {
    root.replaceChildren(emptyState('公开内容暂时无法读取', '请检查网络连接，或稍后重新加载页面。'));
    console.warn('Public content unavailable', error);
  }
}

start();
