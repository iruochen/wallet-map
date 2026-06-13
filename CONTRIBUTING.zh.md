# 贡献指南

English version: [CONTRIBUTING.md](CONTRIBUTING.md)

感谢参与 Wallet Map。

## 快速开始

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm dev
```

首次运行可以保持 PostgreSQL 和 Redis 关闭，使用 fixture 模式完成本地验证。

## 请先阅读

- [架构图](docs/architecture-map.md)
- [开发流程](docs/development-workflow.zh.md)
- [代码风格](docs/code-style.zh.md)
- [提交规范](docs/commit-convention.zh.md)
- [文档风格](docs/documentation-style.zh.md)
- [分析规范](docs/analysis-guidelines.zh.md)
- [开源规范](docs/open-source.zh.md)
- [发布流程](docs/release-process.zh.md)
- [项目就绪清单](docs/project-readiness.zh.md)

## 好的贡献应具备

- 变更小而聚焦。
- 为新行为添加测试。
- 分析输出有证据支持。
- 公开行为变化时更新文档。
- 不提交私钥、助记词、API key 或敏感钱包数据。

## 提交信息

使用 [提交规范](docs/commit-convention.zh.md) 中的轻量 Conventional Commits：

```text
feat(core): add graph builder
fix(adapters): handle empty csv rows
docs: add security policy
```

## Package 边界

```text
apps/web -> packages/*
packages/adapters -> packages/core
packages/analyzers -> packages/core
packages/exporters -> packages/core
packages/core -> no project packages
```

数据拉取逻辑放在 adapters，检测逻辑放在 analyzers。

## PR 清单

- [ ] 我已运行 `pnpm typecheck`。
- [ ] 我已运行 `pnpm test`。
- [ ] 我已运行 `pnpm lint`。
- [ ] 我在有价值时添加或更新了测试。
- [ ] 公开行为或分析语义变化时已更新文档。
- [ ] 我没有提交 secrets 或私有钱包数据。
