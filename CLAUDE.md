# CLAUDE.md - mako的学习记录

## 项目概述
个人学习记录网站，用于展示课程信息、记录笔记、管理作业。采用日漫风格设计。

## 技术栈
- HTML5 + CSS3 + JavaScript（纯原生，无框架依赖）
- Google Fonts (Noto Sans JP)
- Marked.js (Markdown 渲染)
- 背景图片：日式樱花风格

## 文件结构
```
├── index.html          # 首页（我的课程）
├── notes.html          # 课程笔记
├── homework.html       # 课程作业
├── help.html           # 帮助页面
├── styles.css          # 共享样式
├── script.js           # 共享脚本
├── modules/            # 氛围编程模块详情页
│   ├── module1.html    # 模块一
│   ├── module2.html
│   ├── module3.html
│   ├── module4.html
│   ├── module4plus.html # 自选模块
│   ├── module5.html
│   ├── module6.html
│   ├── module7.html
│   ├── module8.html
│   └── module9.html
├── 学习科学实验室氛围编程课程简章.pdf
├── SPEC.md             # 原始规范文档
├── CLAUDE.md           # 本文件
└── README.md           # 项目说明
```

## 导航结构
- 首页：个人介绍 + 课程列表
- 课程笔记：按课程分类的 Markdown 笔记
- 课程作业：按课程分组的作业展示
- 帮助页面：使用指南和常见问题

## 功能特性
- 樱花飘落动画
- 淡入滚动效果
- Markdown 笔记编辑与预览
- localStorage 本地存储（按课程独立保存）
- 响应式布局（适配手机和电脑）

## 笔记存储
- 存储 key：`course_notes_{course_id}`
- 支持课程：atmosphere, python, uiux
- 自动保存：离开页面时提示保存
- 手动保存：点击保存按钮

## 快速修改
| 内容 | 文件位置 |
|------|----------|
| 个人介绍 | index.html 约第 38-46 行 |
| 课程信息 | index.html 约第 52-124 行 |
| 笔记功能 | notes.html + script.js initNotes() |
| 作业列表 | homework.html |
| 帮助内容 | help.html |

## 注意事项
- PDF 阅读使用链接新标签页打开（浏览器安全限制）
- 笔记数据存储在浏览器 localStorage 中
- 背景图片 URL 需要可访问
