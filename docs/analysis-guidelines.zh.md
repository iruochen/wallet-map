# 分析规范

English version: [analysis-guidelines.md](analysis-guidelines.md)

## 目的

Wallet Map 帮助用户理解钱包之间公开可见的链上关系。

项目不提供规避平台规则、自动化滥用行为或隐藏活动的操作建议。

## 分析原则

每个 finding 必须：

- 有证据支持。
- 可解释。
- 可由存储事件复现。
- 谨慎表达 confidence。
- 清楚呈现不确定性。

不要把弱信号表述为证明。

## Finding 结构

每个 analyzer 应返回 `Finding`：

- `title`：简短结果标签。
- `description`：面向用户的解释。
- `severity`：实际重要程度。
- `confidence`：证据强度。
- `scoreImpact`：对最终评分的贡献。
- `evidence`：交易或事件引用。
- `metadata`：供 UI 和导出使用的结构化细节。

## Confidence 指引

高 confidence：

- watched wallets 之间直接转账。
- 跨时间的多次直接转账。
- 中间地址不是公共实体的短多跳路径。

中 confidence：

- 共同非公共资金来源。
- 共同提现或流出目标。
- 跨链桥时间、金额和路径相互匹配。

低 confidence：

- 与热门合约共同交互。
- 只有时间相似，没有金额或 counterparty 重合。
- 仅交互相同 token 或 NFT collection。

## 评分指引

评分不是身份判断，而是人工复核优先级。

`RelationshipScore` 保留 `score`、`confidence`、`reasons` 和 `counterEvidence`，并提供多维度复核评分：

- `funding`：直接转账、共同资金来源、多跳资金路径。
- `destination`：共同去向、共同交易对手、桥目标。
- `contract`：共同合约交互。
- `temporal`：时间窗口和行为重合。
- `asset`：token、NFT、SBT、POAP 或其他资产重合。

公共实体标签应降低弱到中等信号的 confidence 和 score。finding 应保留证据，并在 metadata 中标明公共实体降权，方便 UI 和报告解释复核优先级。

## Analyzer 要求

新增 analyzer 应包含：

- 稳定 `id`。
- 简短 `name`。
- 使用合成 fixture 的聚焦测试。
- 清晰 evidence reference。
- 不在 analyzer 内部拉取外部数据。

Analyzers 读取 `AnalysisContext` 并返回 findings。数据加载属于 adapters 或 ingestion service。

## 报告语言

优先使用：

- “关联信号”
- “发现直接转账”
- “需要人工复核”

避免使用听起来像规避第三方审核系统的表达。
