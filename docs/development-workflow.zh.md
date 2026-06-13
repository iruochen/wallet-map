# 开发流程

English version: [development-workflow.md](development-workflow.md)

## 目标

开发流程应保持可审阅、可验证、边界清晰。

- 保持变更足够小，便于 review。
- 为行为添加测试，避免只测试实现细节。
- 优先稳定的领域模型，而不是临时字符串传递。
- 在每项功能中保护用户隐私和项目边界。

## 本地启动

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint
pnpm dev
```

Web 应用默认运行在：

```text
http://localhost:3000
```

PostgreSQL 和 Redis 是可选能力。首次开发或无存储部署可以保持 `STORAGE_POSTGRES_ENABLED=false`、`STORAGE_REDIS_ENABLED=false`，使用 fixture 模式完成分析。

## 开始变更前

1. 阅读相关 package 和邻近测试。
2. 判断变更归属层级：
   - `packages/core`：共享类型、图模型、评分基础。
   - `packages/adapters`：外部数据源和链数据入口。
   - `packages/analyzers`：关系检测规则。
   - `packages/exporters`：报告输出格式。
   - `packages/labels`：标签 provider 和 enrichment。
   - `packages/storage`：持久化接口、migrations 和 PostgreSQL 实现。
   - `apps/web`：用户界面、API route 和交互流程。
3. 判断是否需要 fixture。
4. 若公开行为、数据模型或分析语义变化，同步更新文档。

## 完成定义

一项变更完成时应满足：

- `pnpm typecheck` 通过。
- `pnpm test` 通过。
- `pnpm lint` 通过。
- 新行为有聚焦测试，或说明为什么暂不适合测试。
- 面向用户的分析结果包含证据，而不只是结论。
- 公开 workflow、数据模型或分析语义变化时文档已更新。

## 分支和 PR

使用聚焦分支：

```text
feature/graph-builder
feature/etherscan-adapter
fix/scoring-confidence
docs/analysis-guidelines
```

提交信息遵循 [提交规范](commit-convention.zh.md)。

PR 应包含：

- 变更内容。
- 变更原因。
- 验证方式。
- 隐私、数据模型或分析边界影响。

## Fixture 策略

Fixture 应满足：

- 小而易读。
- 公开或合成。
- 不包含私有 API key。
- 可以人工检查。

除非专门测试公开协议交易行为，否则优先使用合成钱包地址。
