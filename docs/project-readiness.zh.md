# 项目就绪清单

English version: [project-readiness.md](project-readiness.md)

本清单跟踪项目在公开发布和功能扩展前需要完成的基础工作。

## 已完成

- [x] 架构图。
- [x] TypeScript monorepo scaffold。
- [x] 本地优先环境默认值。
- [x] Docker Compose PostgreSQL 和 Redis 本地配置。
- [x] 开发流程。
- [x] 代码风格指南。
- [x] 提交规范。
- [x] 文档风格指南。
- [x] 分析规范。
- [x] 开源规范。
- [x] 安全策略。
- [x] 行为准则。
- [x] License。
- [x] Changelog。
- [x] GitHub issue templates。
- [x] GitHub pull request template。
- [x] 核心 package 基础测试。
- [x] 并行 agent 任务记录。
- [x] PostgreSQL、Redis 和标签管理能力可通过配置关闭。
- [x] README 和 docs 建立英文/中文入口。

## 公开发布前

- [ ] 添加 CI：`pnpm typecheck`、`pnpm test`、`pnpm lint`、`pnpm build`。
- [x] 添加数据库 migrations 和 schema 文档。
- [x] 分析 job 和结果可持久化到 PostgreSQL。
- [x] 运行中分析进度可写入 Redis。
- [x] 添加分析历史页 `/history`。
- [x] 添加不包含私有钱包数据的 public demo fixture。
- [x] 添加报告脱敏指导。
- [ ] 添加依赖更新策略。
- [x] 建立双语文档结构。
- [ ] 将临时安全联系说明替换为具体联系渠道。

## 第一个 Tag 前

- [ ] 确认 license 选择。
- [ ] 更新 `CHANGELOG.md`。
- [ ] 执行 `docs/release-process.zh.md` 的发布清单。
- [ ] Tag `v0.1.0`。
