# Wallet Map 文档

English version: [docs/README.md](README.md)

本目录包含 Wallet Map 的公开项目文档。文档同时维护英文和中文版本，便于贡献者在没有私有上下文的情况下理解架构、产品边界和发布要求。内部路线图、agent 运行记录和本地 assistant 指令不进入公开仓库。

## 推荐阅读顺序

1. [开发流程](development-workflow.zh.md)
2. [架构图](architecture-map.md)
3. [分析规范](analysis-guidelines.zh.md)
4. [数据库结构](database-schema.zh.md)
5. [Vercel 部署](vercel-deployment.zh.md)
6. [开源规范](open-source.zh.md)
7. [发布流程](release-process.zh.md)

## 当前发布说明

- 仓库仍处于 pre-1.0 阶段。
- fixture 模式是本地演示和贡献者快速上手的默认路径。
- Vercel Preview 和 Production 部署建议使用托管 Redis 保存分析 job 状态。
- PostgreSQL、Redis、标签持久化、标签缓存和标签管理页面均为可选运行时能力。
- 标签管理页面默认关闭，由 `NEXT_PUBLIC_LABEL_MANAGER_ENABLED` 控制。
- 公开示例必须使用合成钱包地址。

## 语言对照

| 主题 | English | 中文 |
| --- | --- | --- |
| 架构 | [architecture-map.en.md](architecture-map.en.md) | [architecture-map.md](architecture-map.md) |
| 开发流程 | [development-workflow.md](development-workflow.md) | [development-workflow.zh.md](development-workflow.zh.md) |
| 代码风格 | [code-style.md](code-style.md) | [code-style.zh.md](code-style.zh.md) |
| 提交规范 | [commit-convention.md](commit-convention.md) | [commit-convention.zh.md](commit-convention.zh.md) |
| 文档风格 | [documentation-style.md](documentation-style.md) | [documentation-style.zh.md](documentation-style.zh.md) |
| 数据库结构 | [database-schema.md](database-schema.md) | [database-schema.zh.md](database-schema.zh.md) |
| Vercel 部署 | [vercel-deployment.md](vercel-deployment.md) | [vercel-deployment.zh.md](vercel-deployment.zh.md) |
| 分析规范 | [analysis-guidelines.md](analysis-guidelines.md) | [analysis-guidelines.zh.md](analysis-guidelines.zh.md) |
| 开源规范 | [open-source.md](open-source.md) | [open-source.zh.md](open-source.zh.md) |
| 发布流程 | [release-process.md](release-process.md) | [release-process.zh.md](release-process.zh.md) |
