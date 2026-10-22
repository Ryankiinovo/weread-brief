# 阅读档案 / WeRead Reading Archive

> 把微信读书的划线、想法与阅读统计，整理成一份可复现、可公开的个人阅读档案。

![阅读档案预览](docs/preview.png)

这是一个真实在用的个人项目：把微信读书同步到 Obsidian 的 Markdown 笔记解析成 JSON，再生成一个无框架、无第三方请求的静态页面。所有数字都可以由原始笔记重新算出来。

## 为什么做这个

微信读书记录「读了多少」，但划线、想法和阅读时长散落在 App 与笔记里，很难回看。市面上的年度报告通常只给截图，不能检索，也不能迁移。

这个项目只做一件事：把「读过的痕迹」变成结构化数据，再用编辑式排版呈现出来。同时守住两条边界——不提供整书内容、不上传任何登录凭据；书籍原文只作为批注的短对照出现。

## 站点包含什么

- **总览**：官方累计阅读时长、读过的书、读完的书、笔记数；2021—2026 历年柱状图与当年逐月分布。
- **书架**：同步到本地的书，含作者、进度、阅读时长、摘录与批注数量、阅读状态。
- **我的摘录**：720 条摘录全部公开，其中 60 条带原创批注。默认按时间线（年月倒序）浏览，可切到「按书」按书架与章节查看；每页 20 条，支持按书、月份、章节筛选，视图状态写进 URL。
- **方法**：同步 → 解析 → 生成 → 校验的流水线说明，以及隐私、去重与口径决策。

页面是纯静态的：`site/index.html` + 手写的 `site/assets/style.css` 与 `site/assets/app.js`，没有构建期前端依赖，也没有外部字体或统计脚本。

![摘录区预览](docs/preview-notes.png)

## 快速开始

要求：Node.js 18+、一个 Obsidian 笔记目录，以及已经同步过微信读书笔记。

```bash
git clone https://github.com/Ryankiinovo/weread-brief.git
cd weread-brief

# 指向你的微信读书笔记目录（默认路径见 scripts/build.mjs）
WEREAD_DIR="$HOME/Documents/Obsidian/Ryankiinovo/微信读书/10 Sources/WeRead" npm run build

# 本地预览
python3 -m http.server 8000 --directory site
```

不需要 `npm install`：项目没有任何运行时或构建依赖。

产物：

- `data/meta.json`：生成时间、来源、各项计数。
- `data/books.json`：书目与章节统计。
- `data/excerpts.json`：公开摘录（原文片段、书籍、章节、日期）与对应批注。
- `data/thoughts.json`：只含有原创批注的子集，便于单独消费。
- `data/stats.json`：官方 lifetime、历年与逐月。
- `site/index.html`：静态页面。

只生成数据、不渲染页面：

```bash
node scripts/build.mjs --no-site
```

## 数据从哪里来

### 1. 笔记目录

由 Obsidian 社区插件 obsidian-weread-plugin 同步生成，每本书一个 Markdown 文件，结构大致如下：

```markdown
---
bookId: "3300000000"
title: "书名"
author: "作者"
progress: "42%"
readingTime: "1小时5分钟"
lastReadDate: "2026-10-01"
readingStatus: "2"
---

# 高亮划线

## 第一章
> 📌 书籍原文（会随对应批注展示片段） ^abc123
    💭 我的想法
    ⏱ 2026-10-01 09:00:00

# 读书笔记

## 前言
### 划线评论
> 📌 书籍原文
    💭 我的想法
    ⏱ 2026-10-02 09:00:00
```

解析规则：

- 读取 frontmatter 中的书目元数据与阅读状态。
- 以 `> 📌` 开头识别一个划线块，向下读取 `💭`（想法）与 `⏱`（时间），遇到空行、标题或下一个划线块即结束。
- `### 划线评论` 不是章节，会被跳过，章节沿用上级标题。
- 摘录原文按空白规范化后去重：724 个划线块收敛为 720 条，重复的 4 条保留第一次出现的位置。
- 想法按文本去重，生成稳定 id；每条想法挂到对应摘录，独立想法（只有 `# 读书笔记`、没有划线块）也能单独成条。
- Quote hash 记录 SHA-1 前 12 位与字符数，用于校验解析完整性。
- 阅读状态：`readingStatus == 4` 或进度 100% 视为读完；180 天内有阅读记录视为在读；其余为搁置。

### 2. 阅读统计

需要一份包含「历年总览 / 历年阅读时长 / 逐月」的统计 Markdown。默认读取：

```text
~/Documents/Obsidian/Ryankiinovo/微信读书阅读统计.md
```

可用 `WEREAD_STATS` 指向其他文件。统计文件缺失时会退化为只使用笔记数据。

### 3. 示例数据

`example/notes/` 里有一份脱敏的占位笔记，可以直接跑通流程：

```bash
WEREAD_DIR=example/notes node scripts/build.mjs --no-site
```

预期 1 本书、3 条划线、3 条想法（重复想法被去重）。注意它会覆盖 `data/`，跑完请用真实笔记重新构建。

## 公开哪些内容

公开三类数据：

1. **摘录**：从本地笔记解析出的 720 条书籍原文片段，每条都附书名、章节与日期；这是「我的摘录」的主体。
2. **原创批注**：60 条自己写下的想法，挂在对应摘录下；没有批注的摘录只显示原文。
3. **元数据与统计**：书名、作者、进度、时长、源划线数、去重后摘录数、批注数、阅读日期、章节名。

不公开：整书内容、微信读书账号信息、同步插件的 Cookie、带个人信息的本机路径。页面按「短片段对照」组织，不拼接整章，也不提供全文检索。

构建脚本支持用 `config/curation.json` 的 id 白名单收窄范围；本仓库没有启用，因此新增摘录与批注会自动进入页面。若版权方提出异议，可删除对应条目或用白名单收窄。

### 隐私检查

```bash
npm run check
```

检查项包括：手机号、邮箱、身份证号、微信读书 Cookie 关键词、本机绝对路径、第三方脚本引用；同时校验每条摘录原文非空且不超过 500 字、书籍与章节非空、quoteHash 与 quoteLength 一致，以及 `meta` 中的摘录数、批注数与 JSON 实际条数一致。

解析器本身不读取 Obsidian 插件的 `data.json`；那份文件里存有微信读书登录凭据，任何时候都不应提交或粘贴到公开场合。

## 口径说明

- **官方 lifetime** 来自微信读书统计页，截至统计文件中的 `updated` 日期（本仓库为 2026-09-15）：累计 46 小时 43 分、读过 32 本、读完 16 本、笔记 501 条。
- **本地同步覆盖** 只统计同步到 Obsidian 的 9 本书：源文件 724 个划线块，按原文去重后为 720 条摘录、60 条批注、34 小时 48 分。
- 两个口径不同，页面与文档都不做相加；501 条官方笔记也不等于 60 条本地批注（后者去重且只含写下的想法）。

## 项目结构

```text
.
├── scripts/
│   ├── lib.mjs          # 解析、去重、统计（无依赖）
│   ├── build.mjs        # 读取笔记 → 输出 data/ 与 site/
│   ├── render.mjs       # 生成静态 HTML
│   ├── check.mjs        # 隐私与数据结构检查
│   └── deploy-pages.sh  # 构建并同步 docs/ 后推送 main
├── tests/parse.test.mjs # 解析边界与统计口径测试
├── data/                # 构建产物（JSON）
├── site/                # 静态页面（可直接部署）
├── example/notes/       # 脱敏示例笔记
└── docs/                # 预览图、制作说明与 Pages 发布镜像
```

## 测试

```bash
npm test        # node --test
npm run check   # 隐私与产物检查
```

测试覆盖：frontmatter 与章节归属、标题紧贴上一块、连续划线块、想法去重、原文随批注保留、只有批注没有划线的条目、阅读状态判定、统计解析、分钟格式化。

## 部署

线上地址：<https://ryankiinovo.github.io/weread-brief/>

页面构建产物在 `site/`，发布镜像在 `docs/`。`./scripts/deploy-pages.sh` 会构建、做隐私检查、把 `site/` 同步到 `docs/` 并推送 `main`，不依赖 CI runner。

1. 运行 `./scripts/deploy-pages.sh`。
2. 仓库 Settings → Pages → Source 选择 **Deploy from a branch**，分支 `main`、目录 `/docs`。
3. 等 Pages 构建完成，打开线上地址。

如果修改了源码或笔记，重新运行一遍脚本即可；构建与检查都在里面。

## 已知限制

- 解析规则绑定 obsidian-weread-plugin 的输出格式；插件大改版时可能需要同步调整。
- 「在读 / 搁置」用 180 天启发式判断，不是微信读书的官方状态。
- 公开范围默认全量（720 条摘录 + 60 条批注）；如需收窄，可添加 `config/curation.json` 白名单，否则新增内容会直接公开。
- 摘录为书籍原文片段，版权归原作者与出版方；本站只做个人阅读记录的短对照，不提供整书或整章内容。
- 字体依赖系统：macOS 使用宋体/PingFang，其他系统会回退到 Noto 或 Georgia，排版略有差异。
- 站点是静态产物，没有全文搜索；摘录分页在前端完成，每页 20 条。

## English

A small, reproducible pipeline that turns WeRead highlights, thoughts and reading stats synced into Obsidian into a static reading archive.

- Zero dependencies; Node.js 18+.
- Parses Markdown, deduplicates excerpts (724 → 720) and thoughts, and keeps each highlighted excerpt beside its note.
- Publishes all 720 excerpts and 60 original notes by default; an optional id whitelist can narrow the set, and a privacy check guards the output.
- Browsable as a reverse-chronological timeline or by book and chapter, 20 excerpts per page.
- Visual design is editorial: warm paper, serif display type, restrained accent, responsive layout.

```bash
WEREAD_DIR=/path/to/WeRead npm run build
npm test && npm run check
```

## License

- Code: MIT (see `LICENSE`).
- Original written content and curated reading data: CC BY-NC-ND 4.0.
- Book excerpts remain the property of their authors and publishers; they are included only as short context for the accompanying notes.

Not affiliated with WeRead or Tencent.

## 致谢

- obsidian-weread-plugin：把微信读书同步成 Markdown。
- 字体与排版灵感来自中文书籍与独立杂志的编辑设计。
