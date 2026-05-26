# Wallet Map 产品设计文档与迭代规划

## 1. 文档目的

本文面向 Wallet Map 当前 MVP 之后的产品决策和工程排期。它基于现有仓库状态、已完成的前端可视化 MVP，以及后续关于数据源、图分析、风险评分和商业化方向的讨论。

Wallet Map 的产品表述应保持克制：它是一个本地优先的钱包关系与链上暴露面审计工具，帮助用户理解一组地址之间已经可见的资金、合约、时间和实体关联。产品不提供私钥托管、自动化钱包操作、绕过平台规则的脚本，也不把分析结论包装成“安全规避保证”。

## 2. 当前进度判断

当前 MVP 已经跑通核心链路：

- 数据获取：`/api/analyze` 支持 fixture、auto、live 三种模式；live 模式接入 Etherscan V2，并覆盖 Ethereum、Arbitrum、Base、BSC。
- 数据结构化：`@wallet-map/adapters` 将 native transfer、internal transfer、ERC20、ERC721 数据归一为 `NormalizedEvent`。
- 图构建：`@wallet-map/core` 已能从 watched wallets 和 normalized events 构建 `RelationshipGraph`。
- 分析器：`@wallet-map/analyzers` 已包含 direct transfer、shared counterparty、same contract interaction 三类基础信号。
- 评分：`scoreFindings` 已提供 0-100 的基础加权评分和 confidence。
- 前端：Next.js workbench 已展示输入区、总评分、pair insights、findings、evidence 和 Cytoscape 图谱。
- 本地基础设施：仓库已包含 PostgreSQL、Redis 的 Docker Compose 配置和初版 SQL migration，但 API 尚未真正持久化 job、events、graph、findings。

这说明项目已经完成从“想法验证”到“可演示工具”的跨越。下一阶段重点不应是堆 UI，而是让分析结果更稳定、更快、更可信，并让用户理解每个风险判断背后的证据。

## 3. 产品定位

### 3.1 一句话定位

Wallet Map 是面向个人研究者、小团队和工作室的本地优先钱包关系审计台，用图谱、证据表和可解释评分展示一组 EVM 地址之间的链上关联信号。

### 3.2 差异化

主流工具通常偏向巨鲸追踪、黑客资金流调查、实体标签查询和项目方风控。Wallet Map 的差异点是：

- 从“输入一组自有或待审计地址”出发，而不是从单个巨鲸或黑客地址出发。
- 关注地址组内部的关联强度，而不是全网实体画像。
- 默认本地优先，降低私有地址清单上传到第三方平台的顾虑。
- 以 evidence-first 的方式呈现结果，避免黑盒结论。
- 可插拔数据源和 analyzer，适合持续跟随项目方审查方法演进。

### 3.3 产品边界

应明确支持：

- 钱包地址组的资金关联审计。
- 共同上游、共同下游、共同合约、时间相近行为等信号检测。
- 证据化图谱、交易明细、Markdown/JSON/CSV 报告。
- 本地数据缓存、结果复盘、标签维护。

不应支持：

- 批量自动化钱包交互。
- 私钥、助记词、签名、授权或代操作。
- 自动生成绕过审查的执行脚本。
- 给出“保证通过”“不可检测”等确定性承诺。

## 4. 目标用户与使用场景

### 4.1 个人用户

用户特征：

- 持有少量钱包，需要理解这些地址之间是否存在明显链上关联。
- 关心隐私暴露、资金路径、历史误操作。
- 技术能力不一定强，依赖清晰的可视化和结论摘要。

核心任务：

- 导入 2-20 个钱包。
- 快速查看是否有直接转账或共同交互对象。
- 点开证据，确认具体 tx hash、时间、金额和链。
- 导出一份本地报告用于自查。

### 4.2 小团队或工作室

用户特征：

- 管理数十到数百个地址。
- 更关心批量地址之间的群组关系、强关联 pair、共同交互路径。
- 愿意为性能、批量导入、深度分析和历史报告付费。

核心任务：

- 批量导入 CSV。
- 为地址添加本地标签。
- 跑完整地址组分析，按强关联程度排序。
- 复盘历史 job，比较不同时间窗口下的关联变化。

### 4.3 研究者或项目方

用户特征：

- 关注公开链上数据研究、可解释风控、实体聚类验证。
- 需要可复现的分析流程和可导出的 evidence。

核心任务：

- 使用 fixture 或公开样本复现实验。
- 自定义 analyzer。
- 导出结构化 JSON 做二次分析。

## 5. 核心用户体验

### 5.1 主流程

1. 用户输入或导入地址组。
2. 选择链、时间范围和数据模式。
3. 系统拉取或读取缓存事件。
4. 系统构建图谱并运行 analyzers。
5. 页面展示总评分、重点 pair、图谱和 evidence。
6. 用户筛选信号类型、点选节点或边查看细节。
7. 用户导出报告或保存 job 以便复盘。

### 5.2 信息架构

Workbench 应聚焦分析任务本身：

- Input Panel：地址、链、时间范围、数据源、分析深度。
- Overview：总评分、confidence、事件数、图节点边数量、最高风险 pair。
- Pair Matrix：地址两两关系强度，支持按 score、confidence、signal count 排序。
- Graph Explorer：节点图、边类型过滤、搜索、布局重跑、证据联动。
- Evidence Table：tx hash、时间、链、from、to、合约、方法、金额、来源 analyzer。
- Report Export：本地 Markdown、JSON、CSV。
- History：本地分析 job 列表和复盘入口。

### 5.3 结果表达原则

- 只说“发现了关联信号”，不说“同一人控制”。
- 每个 finding 必须能追到证据。
- 评分是排序和优先级工具，不是最终裁决。
- 强提示应绑定具体证据：地址、交易、时间窗口、合约、共同实体。
- 对公共合约、CEX 热钱包、桥合约等高频实体要降权，避免误报。

## 6. 功能设计

### 6.1 地址组管理

MVP 后优先补齐：

- CSV 导入和导出。
- 地址格式校验、去重、链维度归一。
- 本地标签：主钱包、测试钱包、CEX 来源、废弃地址、自定义备注。
- 地址组保存为 local profile，默认不上传。

验收标准：

- 100 个地址导入后能清晰展示错误行、重复行和有效地址数。
- 标签能在 graph、pair matrix、evidence 中复用。

### 6.2 数据源层

短期保留 Etherscan-like 作为 live path，同时引入第二数据源作为缓冲：

- Ankr Advanced APIs 或 Moralis Wallet API：作为 Etherscan V2 的低改动替代源。
- CSV fixture/import：便于不依赖 API key 的本地分析。
- RPC `eth_getLogs`：作为工程化阶段的可控采集能力。

中期目标是抽象 provider：

```ts
interface EventProvider {
  id: string;
  supports(input: EventQuery): boolean;
  getEvents(input: EventQuery): Promise<NormalizedEvent[]>;
}
```

数据源选择策略：

- `fixture`：稳定演示和测试。
- `live-indexer`：快速拿全量钱包历史。
- `live-rpc`：按时间范围和合约 topic 精准抓取。
- `cache-first`：优先使用本地事件缓存，缺口再回源。

### 6.3 影子数据库与缓存

PostgreSQL 用于可复盘分析，Redis 用于热缓存和队列。

第一阶段落地：

- API 创建 `analysis_jobs`。
- 保存 `normalized_events`、`graph_nodes`、`graph_edges`、`findings`。
- 提供 `GET /api/analyze/:jobId` 回放结果。
- 对同一地址、链、时间范围做缓存命中。

第二阶段落地：

- BullMQ job queue。
- 后台并发拉取地址事件。
- 前端轮询 job 状态。
- 大地址组先返回 job id，再渐进展示结果。

性能目标：

- 20 个地址 fixture 分析在 1 秒内完成。
- 50 个地址 live 分析能返回进度，不让前端长时间空转。
- 已缓存 job 回放在 500ms 内返回核心摘要。

### 6.4 分析器体系

现有 analyzers 是正确起点。后续应按“高确定性资金信号 -> 中确定性实体信号 -> 弱行为相似信号”的顺序推进。

优先级 P0：

- Direct Transfer Analyzer：已完成，继续增强金额、次数、方向、时间聚合。
- Shared Counterparty Analyzer：已完成基础版，增加公共实体降权。
- Same Contract Interaction Analyzer：已完成基础版，增加合约标签和方法相似度。

优先级 P1：

- Shared Funding Source Analyzer：多个 watched wallets 是否从同一上游收到资金。
- Shared Withdrawal / Deposit Analyzer：多个 watched wallets 是否流向同一已知实体或疑似充值地址。
- Multi-hop Path Analyzer：2-4 跳路径发现，限制搜索深度和高频节点。
- Temporal Pattern Analyzer：相似时间窗口内的同类操作。

优先级 P2：

- Path Similarity Analyzer：按有序合约路径计算相似度。
- Bridge Correlation Analyzer：跨链桥入桥、出桥时间和金额关联。
- NFT / SBT / POAP Overlap Analyzer：共同持有或领取同类资产。
- Amount Pattern Analyzer：金额分布是否过度一致。

### 6.5 风险评分模型

评分模型应从简单累加升级为多维度可解释评分。

建议维度：

- Funding Link：资金来源、直接转账、多跳资金路径。
- Destination Link：共同下游、CEX/桥/聚合器去向。
- Contract Link：共同合约、共同方法、交互序列。
- Time Link：时间窗口重合、周期性行为。
- Asset Link：Token、NFT、SBT、POAP 重合。
- Confidence Adjustment：公共实体降权、样本量不足降权、证据时间过旧降权。

输出结构建议：

```ts
interface SybilExposureScore {
  score: number;
  confidence: "low" | "medium" | "high";
  dimensions: {
    funding: number;
    destination: number;
    contract: number;
    temporal: number;
    asset: number;
  };
  topSignals: string[];
  counterEvidence: string[];
}
```

命名建议避免使用“Sybil Safe”。可以使用：

- Exposure Score
- Linkage Score
- Relationship Risk
- Review Priority

### 6.6 图谱体验

当前 Cytoscape 方向适合继续强化。

短期优化：

- 图谱和 evidence 双向联动。
- 点击 finding 高亮相关边。
- 地址搜索和节点聚焦。
- 边类型开关保持稳定，不触发布局大跳动。
- 高度数节点折叠，避免图谱被 CEX、桥、热门合约淹没。

中期优化：

- Pair matrix 与 graph 联动。
- 图谱分层：watched wallets、observed wallets、contracts、known entities。
- 局部展开：默认只看命中 finding 的子图，用户再展开邻居。
- 大图模式：Web Worker layout 或后端预聚合 graph slice。

### 6.7 报告

报告应服务复盘和人工审查。

首版报告包含：

- 输入摘要：链、地址数、时间范围、数据源。
- 总体评分和 confidence。
- Top wallet pairs。
- Top findings。
- Evidence 明细。
- 图谱摘要。
- 分析限制和免责声明。

导出格式：

- Markdown：人读。
- JSON：二次分析。
- CSV：表格和外部工具。

## 7. 技术架构演进

### 7.1 阶段 A：MVP 加固

目标：让当前 demo 变成稳定可用的本地工具。

关键任务：

- 为 `/api/analyze` 增加请求大小限制、地址数量限制、错误分层。
- 为 live mode 增加并发控制和 provider 超时。
- 将 graph view model 从 API response 中稳定下来。
- 补充 public demo fixture。
- 完善 CI：typecheck、test、lint、build。

### 7.2 阶段 B：数据源替换与缓存

目标：摆脱单一 Etherscan 依赖。

关键任务：

- 新增 Ankr 或 Moralis provider。
- 定义 provider selector。
- 接入 PostgreSQL-backed storage。
- 接入 Redis cache。
- 同一地址查询结果按 chain、block range、provider 维度缓存。

### 7.3 阶段 C：后台任务化

目标：支持 50-200 地址组，不让前端同步等待。

关键任务：

- 新增 job queue。
- `/api/analyze` 返回 job id。
- `/api/analyze/:jobId` 返回状态和 partial result。
- 前端显示 fetching、normalizing、analyzing、rendering 阶段。
- 支持取消 job。

### 7.4 阶段 D：风险模型产品化

目标：从“查关联”升级为“审计台”。

关键任务：

- 多维评分。
- Pair matrix。
- 时间窗口和路径相似度分析。
- Known entity label provider。
- 报告模板。

### 7.5 阶段 E：商业化准备

目标：形成可付费的本地优先专业工具。

可选方向：

- Free：5-10 地址、fixture/CSV、本地报告。
- Pro：100+ 地址、live provider、多维评分、历史 job、批量导出。
- Team：共享标签库、审计模板、私有部署、团队报告。

商业化功能应以“效率、容量、可复盘、团队协作”为卖点，而不是承诺规避任何第三方审查。

## 8. 迭代路线图

### M0：当前 MVP 整理

目标时间：已基本完成，补文档和稳定性。

交付：

- 当前功能清单。
- 产品定位文档。
- 图谱交互基本可用。
- Etherscan live path 可跑。
- 核心包测试稳定。

退出标准：

- 新贡献者能根据 README 在本地跑起 demo。
- fixture 模式不依赖任何私密配置。

### M1：可用性与证据闭环

建议周期：1-2 周。

交付：

- Finding 与 graph edge 双向高亮。
- Evidence table 支持筛选和复制 tx hash。
- Pair insights 升级为 Pair Matrix。
- Markdown/JSON 报告导出进入 UI。
- Public demo fixture 完成。
- CI 跑通。

核心指标：

- 20 地址 fixture 分析稳定。
- 用户能从总评分一路点到 tx hash。
- 报告可完整复盘一次分析。

### M2：数据层工程化

建议周期：2-3 周。

交付：

- PostgreSQL storage implementation。
- Redis cache。
- Ankr 或 Moralis provider。
- Provider selector。
- Job persistence 和结果回放。
- Live mode 并发控制。

核心指标：

- 已分析地址组二次打开明显加速。
- Etherscan 失败时可切到备用 provider。
- job、events、graph、findings 均可持久化。

### M3：高级分析器

建议周期：2-4 周。

交付：

- Shared Funding Source Analyzer。
- Shared Withdrawal / Deposit Analyzer。
- Multi-hop Path Analyzer。
- Temporal Pattern Analyzer。
- Known Entity Label Provider 初版。
- 公共实体降权规则。

核心指标：

- 不只发现直接转账，还能发现共同上游和时间相近行为。
- 高频公共实体不会制造大量误报。
- 每个 analyzer 都有 synthetic fixture 和单测。

### M4：审计报告与专业版形态

建议周期：3-4 周。

交付：

- 多维 Exposure Score。
- 一键审计报告。
- 历史 job 对比。
- CSV 批量导入增强。
- 本地标签库管理。
- Pro 版功能边界设计。

核心指标：

- 100 地址组可以异步完成分析。
- 报告能用于团队内部复盘。
- 付费点围绕容量、速度、历史、导出和团队协作。

## 9. 近期工程任务建议

建议按下面顺序开 issue：

1. Stabilize graph response contract：把 `buildPresentationGraph` 的输出固定为 `GraphViewModel`。
2. Add report export to workbench：把 `@wallet-map/exporters` 接到 UI。
3. Add CI workflow：`pnpm typecheck`、`pnpm test`、`pnpm build`。
4. Implement PostgreSQL storage client：实现 `@wallet-map/storage` repository contracts。
5. Persist analyze jobs：`POST /api/analyze` 写入 job 和分析结果。
6. Add job replay endpoint：`GET /api/analyze/:jobId`。
7. Add second live provider：优先选 API 结构接近当前 adapter 的 provider。
8. Add known entity labels：先用本地 JSON seed 支持 CEX、bridge、DEX。
9. Add shared funding analyzer。
10. Add temporal pattern analyzer。

## 10. 关键风险

- 数据源成本：大地址组 live 查询会受到 API 限流和费用影响，需要 cache-first 和后台任务化。
- 误报：共同合约和共同实体很容易误伤，需要标签和降权。
- 性能：图谱不能无脑展示全量节点，需要子图、聚合和折叠。
- 隐私：地址组本身可能敏感，默认本地优先，避免无提示上传。
- 产品表述：避免把工具包装成“规避审查神器”，应强调审计、解释和复盘。
- 维护成本：多数据源和多链会带来长期适配压力，provider interface 必须早抽象。

## 11. 成功指标

产品指标：

- 用户能在 5 分钟内完成一次 10-20 地址组审计。
- 每个高风险 finding 都能在 2 次点击内看到 evidence。
- 报告导出后不依赖前端状态也能复盘。

工程指标：

- fixture 分析测试稳定。
- analyzer 覆盖率优先覆盖误报和边界输入。
- live provider 有超时、重试、降级路径。
- 100 地址组进入后台 job，不阻塞请求生命周期。

商业指标：

- 免费版足够验证价值，但容量和深度有限。
- Pro 版围绕批量地址、历史 job、多 provider、深度 analyzer 和报告模板收费。
- Team 版围绕私有部署、共享标签库、协作复盘和审计服务收费。

## 12. 下一步建议

下一步最值得做的是 M1：证据闭环和报告导出。原因是它不依赖昂贵数据源，也不会过早引入复杂基础设施，但能显著提高产品可信度。等用户能顺畅地从 score 看到 pair、从 pair 看到 edge、从 edge 看到 tx hash，再进入 M2 的数据库和缓存会更稳。

