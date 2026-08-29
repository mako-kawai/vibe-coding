# mako's archive 项目说明

## 定位

项目由两层组成：根地址是公开的个人档案站，`dashboard.html` 是本地优先的北大物理学习驾驶舱。公开页面只读仓库中的 `content/` 文件；任务、成绩、日程、私人笔记和本地图片不进入公开页面。

## 技术约束

- 原生 HTML、CSS 和 ES Modules，无构建步骤
- GitHub Pages 子路径兼容，所有运行时依赖放在 `vendor/`
- Service Worker 只缓存静态文件，不修改或清理用户数据
- Markdown 经过 Marked 与 DOMPurify 清理后才进入 DOM
- 外部链接仅允许 HTTP/HTTPS，并设置 `noopener noreferrer`

## 主要入口

| 页面 | 用途 |
|------|------|
| `index.html` | 公开个人主页 |
| `projects.html` | 公开项目 |
| `reviews.html` | 公开书评 |
| `interests.html` | 公开兴趣 |
| `notes-public.html` | 公开笔记 |
| `about.html` | 公开介绍 |
| `dashboard.html` | 学习驾驶舱总览 |
| `tasks.html` / `courses.html` / `notes.html` | 驾驶舱工作区 |
| `schedule.html` / `grades.html` / `transcript.html` | 日程、成绩和成绩单 |
| `settings.html` / `content-studio.html` | 本地设置与公开内容工作台 |

## 数据边界

结构化状态使用 localStorage 键 `mako_learning_v2`，资源使用 IndexedDB `mako_learning_assets_v2`。状态中保留 `publicSite` 和本地 `publicContent` 草稿；公开发布必须经过内容包导出和人工审阅。不要在公开脚本中导入 `js/store.js`，也不要把任务、成绩、日程或私人附件序列化到 `content/`。

## 修改与验收

优先复用 `js/logic.js` 的纯函数、`js/store.js` 的状态接口和 `js/ui.js` 的驾驶舱外壳。改动后运行 `npm.cmd test`、`node --check`，再进行桌面和手机视口检查。涉及打印时同时检查 `@media print`，涉及公开内容时检查脚本、事件属性、危险链接和图片路径清理。
