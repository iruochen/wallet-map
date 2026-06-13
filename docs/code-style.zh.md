# 代码风格

English version: [code-style.md](code-style.md)

## 语言

核心项目使用 TypeScript。

- 公共 package 边界优先导出明确类型。
- 内部实现可在提升可读性时保留类型推断。
- 避免 `any`；未信任数据使用 `unknown`。
- Package API 应保持稳定且窄。

## 命名

统一使用领域名词：

- `NormalizedEvent`：adapter 归一化后的链上事件。
- `RelationshipGraph`：分析器使用的节点和边。
- `Finding`：带证据的分析结果。
- `EvidenceRef`：源事件或交易引用。
- `RelationshipScore`：最终可解释评分。

文件名应匹配领域概念：

```text
graph-builder.ts
direct-transfer.ts
shared-counterparty.ts
markdown-exporter.ts
```

## Package 边界

`packages/core` 不应依赖其他项目 package。

允许依赖方向：

```text
apps/web -> packages/*
packages/exporters -> packages/core
packages/analyzers -> packages/core
packages/adapters -> packages/core
packages/labels -> packages/core
packages/storage -> packages/core
packages/core -> no project packages
```

Adapters 不应导入 analyzers。Analyzers 不应拉取外部数据。

## 错误处理

可恢复的领域失败使用 typed result object，例如：

- 不支持的链。
- 无效地址。
- 数据源限流。
- 部分 ingestion 结果。

只有程序错误或真正意外的状态才抛出异常。

## 数据处理

外部数据在归一化前都不可信。

- 存储或分析前验证地址。
- 在有价值时保留 raw reference，但 canonical 字段以 normalized 数据为准。
- 金额使用字符串，避免精度损失。
- 显式保留 chain ID。
- 时间戳使用 ISO 8601 UTC 字符串。

## 测试

使用 Vitest。测试名称描述行为：

```ts
it("finds transfer edges between watched wallets", async () => {});
```

优先覆盖：

- 数据归一化。
- 图构建。
- Analyzer findings。
- 评分行为。
- 导出结构。

除非输出是稳定报告格式，否则避免对分析结果做大快照测试。

## UI 风格

UI 应像分析工作台，而不是营销页面。

- 以 workflow 开始，不以 landing page 开始。
- 控件应可见、稳定、可预测。
- 结论附近展示证据。
- 避免干扰图谱和表格的装饰元素。
- 重复分析场景优先紧凑、可扫描布局。
