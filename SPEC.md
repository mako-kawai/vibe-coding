# 个人档案站与学习驾驶舱规范

## 1. 产品边界

根地址展示个人档案、精选项目、课外书评、兴趣记录和公开学习笔记。`dashboard.html` 及其子页面负责日常学习管理。两层共享视觉变量和主题，但公开页面不得访问本地学习状态。

## 2. 页面结构

公开层：`index.html`、`projects.html`、`reviews.html`、`interests.html`、`notes-public.html`、`about.html`。

驾驶舱层：`dashboard.html`、`tasks.html`、`courses.html`、`notes.html`、`schedule.html`、`grades.html`、`transcript.html`、`settings.html`。

兼容页面：课程资料 PDF 页面和 `modules/` 页面保留，并返回新的课程页或公开主页。

## 3. 公开内容

仓库内容位于 `content/`。`manifest.json` 只列出 `published` 条目；条目正文通过相对路径加载。内容工作台的 `draft`、`ready` 和本地素材不会自动发布。课程笔记发布采用独立快照，公开快照与私有正文分开保存。

## 4. 隐私与安全

- 任务、成绩、日程、私人笔记、驾驶舱头像和本地主题素材只在浏览器保存
- 公开 Markdown 经过 DOMPurify 清理，禁止脚本、事件属性、嵌入式文档和危险链接
- 外部链接只允许 HTTP/HTTPS；公开图片只允许 HTTP/HTTPS 或仓库内相对路径
- 公开发布包由用户明确选择并人工审阅后提交，不调用 GitHub API

## 5. 离线与部署

所有页面、模块、公开内容、第三方库和 KaTeX 字体由 Service Worker 按版本缓存。缓存更新时只清理旧静态缓存，不触碰 localStorage 或 IndexedDB。相对 URL 必须在 GitHub Pages `/vibe-coding/` 子路径下有效。

## 6. 验收

运行 `npm.cmd test`，并检查公开页面、驾驶舱、成绩单和内容工作台在桌面、手机、打印和离线状态下的可用性；尤其确认公开页面没有读取私有状态，成绩单导航在打印输出中隐藏，且内容包导入失败不会写入半成品数据。
