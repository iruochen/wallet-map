# Wallet Map

Wallet Map 是一个本地优先的钱包关系分析工具，面向 EVM 地址组审计、公开链上数据研究和合规友好的复盘工作流。

它帮助用户检查两个或多个钱包之间已经公开可见的链上关联信号：

- 直接转账
- 共同交易对手
- 多跳路径
- 共同合约交互
- 时间相近的行为模式

本项目不处理私钥、助记词、签名、资产托管或自动化钱包操作，也不提供规避第三方规则的建议。

English documentation starts at [README.md](README.md). 项目文档同时维护英文和中文版本，见[项目文档](#项目文档)。

## 当前状态

Wallet Map 目前处于 pre-1.0 阶段，适合本地评估、fixture 演示和早期贡献者审阅。

已完成能力包括：

- Next.js 工作台：地址输入、进度、图谱、证据、历史记录和报告导出。
- 不依赖私有 API key 或数据库的合成 fixture 模式。
- 配置 provider key 后，可通过 Etherscan-like live path 获取 Ethereum、Arbitrum、Base 和 BSC 数据。
- NodeReal 与 Solscan provider 接入点。
- 核心图构建、默认分析器、多维 Exposure Score 和报告导出器。
- 可选 PostgreSQL 持久化、Redis job 进度/缓存，以及默认关闭的私有标签管理页面。

公开稳定发布前仍需补齐：

- CI workflow：typecheck、test、lint、build。
- 更多 live provider 覆盖和缓存命中验证。
- 双语文档完整性和 release checklist 审核。
- 正式安全联系渠道和依赖更新策略。

## 工作区结构

```text
apps/
  web/                 Next.js UI
packages/
  core/                共享领域模型、图类型、评分基础
  adapters/            数据源和链适配器边界
  analyzers/           钱包关系分析器插件
  exporters/           报告和导出接口
  labels/              标签 provider 和 enrichment
  storage/             持久化接口与 SQL migrations
docs/                  双语项目文档
fixtures/              测试和演示用公开样本数据
```

## 常用命令

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev
```

## 环境变量

复制示例文件后再进行本地开发：

```bash
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
```

不要提交真实 `.env` 文件、API key、带凭据的 RPC URL 或私有钱包数据。Next.js 应用从 `apps/web/.env.local` 读取运行时配置。

## 可选基础设施

PostgreSQL 和 Redis 是可选能力。首次本地运行和暂未配置托管存储的 Vercel 部署，可以只使用 fixture 模式。

只有在需要持久化历史、多实例 job 进度、Redis 标签缓存或私有标签管理时，才启用本地 PostgreSQL/Redis：

```bash
docker-compose up -d
pnpm db:migrate
```

相关开关：

```bash
STORAGE_POSTGRES_ENABLED=true
DATABASE_URL=postgresql://...
STORAGE_REDIS_ENABLED=true
REDIS_URL=redis://...
LABEL_DATABASE_ENABLED=true
LABEL_REDIS_CACHE_ENABLED=true
LABEL_LIST_CACHE_ENABLED=true
NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false
```

`/labels` 标签库管理页面默认关闭。只有维护者明确设置 `NEXT_PUBLIC_LABEL_MANAGER_ENABLED=true` 后，导航和路由才会开放。

## MVP 使用流程

当前 MVP 可在 fixture 模式下完整运行：

1. 执行 `pnpm dev`。
2. 打开工作台。
3. 使用首页样例地址或导入 `.txt`、`.csv`、`.tsv` 地址文件。
4. 提交分析表单。
5. 应用调用 `/api/analyze`，构建关系图，运行默认分析器，并返回带证据的 findings。
6. 从摘要区导出 PDF、Markdown、JSON 或 CSV evidence。

`fixtures/sample-events.json` 是合成公开演示数据，覆盖直接转账、共同资金来源、共同去向、共同合约、多跳路径、时间模式和桥相关信号。

## 数据源模式

- `Auto`：存在 live provider key 时使用 live 数据，否则回退到 fixture。
- `Fixture`：始终使用 `fixtures/sample-events.json`。
- `Live`：要求相关 provider key，缺失时返回明确错误。

Etherscan API key 可支持 Ethereum、Arbitrum、Base 和 BSC。NodeReal、Solscan 和 Chainbase 相关能力通过对应环境变量启用。

## 项目文档

- 总览：[English](docs/README.md), [中文](docs/README.zh.md)
- 架构图：[English](docs/architecture-map.en.md), [中文](docs/architecture-map.md)
- 开发流程：[English](docs/development-workflow.md), [中文](docs/development-workflow.zh.md)
- 代码风格：[English](docs/code-style.md), [中文](docs/code-style.zh.md)
- 提交规范：[English](docs/commit-convention.md), [中文](docs/commit-convention.zh.md)
- 文档风格：[English](docs/documentation-style.md), [中文](docs/documentation-style.zh.md)
- 数据库结构：[English](docs/database-schema.md), [中文](docs/database-schema.zh.md)
- 分析规范：[English](docs/analysis-guidelines.md), [中文](docs/analysis-guidelines.zh.md)
- 开源规范：[English](docs/open-source.md), [中文](docs/open-source.zh.md)
- 发布流程：[English](docs/release-process.md), [中文](docs/release-process.zh.md)
- 贡献指南：[English](CONTRIBUTING.md), [中文](CONTRIBUTING.zh.md)
- 安全策略：[English](SECURITY.md), [中文](SECURITY.zh.md)
- 行为准则：[English](CODE_OF_CONDUCT.md), [中文](CODE_OF_CONDUCT.zh.md)
- 更新日志：[English](CHANGELOG.md), [中文](CHANGELOG.zh.md)
