# AGENTS.md

本仓是 **weread-brief**，把微信读书的划线、想法和阅读统计整理成可复现的个人阅读档案与静态站。

## 换机/部署

读 `README.md` 的「迁移与新机使用」章节。只需要 Node ≥ 18，没有前端框架、没有外部 CDN。

```bash
node --version      # >= 18
npm run build       # 生成 site/
npm run check       # 校验数据与页面
npm test            # 单元测试
open site/index.html
```

## 给 AI 的要点

1. **数据源不在本仓**：Obsidian 里的微信读书笔记（`微信读书/10 Sources/WeRead`）。没有源笔记无法重新生成。
2. `site/` 是生成产物，可以直接打开看，但不要手改——改完下次构建会被覆盖。
3. 这是**公开仓**，任何改动都会对外可见；不要放入个人隐私数据。
