# 更新日志

English version: [CHANGELOG.md](CHANGELOG.md)

Wallet Map 的重要变更会记录在此文件中。

格式大致遵循 Keep a Changelog，项目使用 semantic versioning。

## Unreleased

### Added

- 初始 TypeScript monorepo scaffold。
- 本地 PostgreSQL 和 Redis Docker Compose 配置。
- 核心 normalized event、graph、finding、scoring 和 analysis pipeline 类型。
- Direct transfer、shared counterparty、same-contract interaction、shared flow、multi-hop、temporal pattern 和 bridge correlation analyzers。
- Fixture-mode Web 工作台和 `/api/analyze` endpoint。
- Etherscan API V2 live mode，支持通过 `chainid` 复用一个 API key。
- Ethereum、Arbitrum、Base 和 BSC live mode 支持。
- Storage package contracts 和 PostgreSQL schema migrations。
- JSON、Markdown、CSV 和 PDF 报告导出。
- 历史分析和 job replay。
- 已知实体标签、Chainbase/Etherscan label enrichment、Redis label cache 和本地标签管理初版。
- 并行 agent 工作记录。
- 开发、代码风格、分析、开源和环境安全文档。
- README 与 docs 的英文/中文发布入口。

### Changed

- PostgreSQL、Redis、标签持久化、标签缓存和标签管理页面现在可通过环境变量显式开启或关闭。
- 示例环境变量默认适合无 Pg/Redis 的 fixture 模式和 Vercel 预览部署。
- `/labels` 标签管理页面默认关闭，仅在 `NEXT_PUBLIC_LABEL_MANAGER_ENABLED=true` 时开放。
