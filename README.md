# mako's archive

这是一个中文为主的个人档案站，同时包含一个本地优先的北大物理学习驾驶舱。根地址用于展示明确公开的项目、阅读记录、兴趣和关于页面；驾驶舱用于每天处理任务、课程、笔记、日程和正式成绩。

## 入口

- 在线地址：[mako-kawai.github.io/vibe-coding](https://mako-kawai.github.io/vibe-coding/)
- 个人主页：[`index.html`](./index.html)
- 学习驾驶舱：[`dashboard.html`](./dashboard.html)
- 内容工作台：[`content-studio.html`](./content-studio.html)
- 本地预览：在仓库目录运行 `python -m http.server 4176`，打开 `http://127.0.0.1:4176/`

不要直接双击 HTML 文件。ES Modules、Service Worker、IndexedDB 和 PWA 离线缓存需要通过 HTTP 提供页面。

## 公开档案层

公开页面包括首页、项目、书评、兴趣、公开笔记和关于页面。它们只读取仓库中的 `content/site.json`、`content/manifest.json` 和已提交的正文，不读取任务、成绩、日程或私人课程笔记。

`content/` 是可审阅的发布目录：

```text
content/
├── site.json
├── manifest.json
├── projects/
├── reviews/
├── interests/
└── notes/
```

在内容工作台中编辑的条目默认是本地草稿。只有明确标记为“已发布”的条目才会进入“导出发布包”；导出后请审阅 Markdown、链接和图片，再手动将 `content/` 文件提交到仓库。网站不使用 GitHub API，也不会保存 GitHub 访问令牌。课程笔记的“发布为公开笔记”会生成独立快照，之后的私人修改不会自动改变公开正文。

目前仓库只收录经过整理的项目条目：地球自转轴进动与章动模型、Python 学习记录、Java 入门练习和本学习驾驶舱。书评和兴趣页面在没有真实内容时保持空状态，不虚构个人经历或观点。

## 学习驾驶舱

- 总览：截止任务、今日课程、考试倒计时、学期状态和工作区总入口
- 任务：统一管理课程作业与个人待办，支持精确截止、优先级、进度、标签、子任务、专注计时和已完成任务批量清理
- 课程：聚合课程任务、笔记、课表、正式成绩和资料页；课程类别包括专业任选、全校任选、全校必修、专业必修、任选、通选课
- 笔记：Markdown、KaTeX、DOMPurify、物理推导模板、章节字段、全文检索、Markdown 导入导出和本地附件
- 日程：手动录入、ICS 导入、UID 去重、每周重复和 `Asia/Shanghai` 时区
- 成绩：百分制、等级制、P/NP、EX、I、IP、W、F；支持 CSV、北大成绩页文字粘贴和 `.txt` 文件；提供总 GPA、专业必修 GPA、成绩单预览、打印保存 PDF 和 CSV 导出
- 设置：驾驶舱个人资料、头像裁剪、主题、左侧菜单背景、透明度/饱和度/亮度、备份和公开内容工作台入口

## 数据与隐私

结构化元数据存入版本化的 `AppStateV2`；笔记正文、附件、头像、主题图和公开草稿素材存入 IndexedDB。首次运行会幂等迁移旧课程、作业、待办、笔记和课表数据，旧键不会自动删除。驾驶舱数据不会上传 GitHub。

完整备份 ZIP 包含状态 JSON、Markdown、附件、主题素材和公开草稿。导入支持合并与替换；替换前会先生成可恢复快照。公开发布包只包含用户明确发布的公开条目和明确选择的公开图片，不等同于完整备份。

## 主题与版权

公开仓库只包含原创默认背景。枕社风格和柚子社风格仅作为个人色板与装饰层；用户可以在设置中导入自己有权使用的本地图片，图片保存在浏览器，不会自动进入仓库。本项目与北京大学、枕社、柚子社均无隶属或授权关系。

## 技术与测试

项目使用原生 HTML/CSS/ES Modules，无构建步骤。Marked、KaTeX、DOMPurify、Lucide、ical.js 和 JSZip 固定在本地 `vendor/`，Service Worker 预缓存公开页面、驾驶舱、模块、内容文件和公式字体。

```bash
npm.cmd test
```

发布前还应在 `1280x720`、`1440x900` 和 `390x844` 三档视口检查公开页面、驾驶舱、成绩单和内容工作台，并确认离线回退及 GitHub Pages 子路径 `/vibe-coding/` 正常。

## License

MIT
