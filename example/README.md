# 示例笔记

`example/notes/示例笔记.md` 是脱敏后的占位数据，只用来验证解析与构建流程，不包含任何真实书籍原文。

用它跑一遍构建（会覆盖 `data/` 与 `site/index.html`，跑完记得用真实笔记重新构建）：

```bash
WEREAD_DIR=example/notes npm run build
```

预期输出：1 本书、3 条划线、3 条想法（重复的想法会被去重）。
