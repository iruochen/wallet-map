# 图谱可视化计划

English version: [graph-visualization.md](graph-visualization.md)

## 目标

Wallet Map 需要一个图谱浏览器，帮助用户检查 watched wallets、observed counterparties、contracts、known entities 和 evidence 之间的关系。图谱体验应从 MVP 足够简单的形态开始，同时避免在数据量增长后被早期技术选择限制。

本文关注前端图谱可视化，不替代后端 `RelationshipGraph` 模型或 analyzer contracts。

## 工具选择

### React Flow

适合需要丰富 React 节点 UI 和较小可见图谱的 MVP。

优势：

- React 集成自然。
- 易于实现自定义节点卡片、边标签、侧栏、菜单和受控状态。
- 适合选择节点、展开邻域、过滤边类型、按 finding 高亮路径。

限制：

- 不适合非常大的密集图。
- 布局通常依赖 Dagre、ELK、d3-force 或自定义逻辑。
- DOM 节点过多时性能会下降。

### Cytoscape.js

适合中等规模图谱和更图原生的分析交互。

优势：

- 成熟的图模型、selector、style、layout 和算法。
- 支持 neighborhood selection、shortest path、聚类等图操作。
- 比 DOM-heavy 图工具更适合数百到数千节点。

限制：

- React 集成不如 React Flow 自然。
- 自定义 React 节点不是默认路径。
- 需要清晰管理 Cytoscape state 和 React state 边界。

当前项目已采用 Cytoscape 方向作为工作台图谱实现基础，应继续强化 view model 和交互稳定性。

### Sigma.js / Graphology

适合大规模 WebGL 图谱探索。

优势：

- 适合数千到数万节点。
- Graphology 提供图结构、指标、遍历和 layout 支持。
- 适合性能优先的大图模式。

限制：

- 应用交互 glue code 更多。
- 自定义节点 UI 通常通过 overlay 和侧栏实现。
- 需要服务端切片、聚类和渐进加载设计。

## 推荐路线

使用分阶段策略，而不是一次性为所有规模选择同一个库。

### MVP：Cytoscape.js 工作台

当前工作台应继续保持 Cytoscape 图谱，重点是：

- 稳定 `GraphViewModel`。
- 控制默认可见图谱规模。
- 让 finding、edge、evidence table 之间可以互相定位。
- 对公共实体、高度数节点和截断状态做明确展示。

### 中等规模图谱

当用户需要 500 到 3,000 节点探索时：

- 保持同一 view model。
- 增加 neighborhood expansion、path highlighting 和 layout controls。
- 昂贵布局只在数据变化后运行，不因 hover 或 panel 状态变化触发。

### 大规模图谱

当用户需要 5,000+ 节点时：

- 引入 server-side graph slice API。
- 预聚合低价值边，折叠高频公共实体。
- 使用 Web Worker 或后端 layout。
- 以 Sigma.js / Graphology 作为大图渲染候选。

## 前端图谱数据契约

UI 不应直接渲染 `RelationshipGraph`。它应消费稳定、面向展示的 view model：

```ts
export interface GraphViewModel {
  schemaVersion: "1.0";
  generatedAt: string;
  summary: GraphViewSummary;
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  groups?: GraphViewGroup[];
}
```

契约原则：

- API 层负责 truncation、aggregation 和默认可见性。
- Renderer 不应静默丢弃数据。
- Findings 应把 `findingIds` 关联到相关 edges，并增加相关 node 的 `findingCount`。
- `GraphEdge.metadata` 可补充 label、timestamp、amount summary 和 chain-specific display。

## MVP 交互要求

- 点击节点打开详情 panel。
- 点击边展示 evidence events 和 tx hashes。
- 过滤边类型：transfer、token transfer、NFT transfer、contract interaction、shared counterparty、bridge route。
- 按 finding 高亮相关边和节点。
- 分析器提供路径时高亮 watched wallets 之间的 direct path。
- 搜索 address、label、tx hash 或 tag。
- Evidence table 与 graph selection 双向联动。
- 明确展示 loading、empty、truncated 状态。

## 数据量策略

默认渲染 graph slice，而不是全量 raw event graph。

MVP 默认：

- 始终展示 watched wallets。
- 展示 watched wallets 之间直接边。
- 展示与 findings 相关的 observed nodes。
- 展示按 evidence count 排序的 top counterparties，并设置上限。
- 隐藏孤立节点，除非用户搜索。

中等规模：

- 重复交易聚合为 relationship edge。
- 公共实体折叠为 grouped node。
- 按需加载一跳邻域。

大规模：

- 服务端图谱切片。
- 显式 node/edge caps。
- 预计算 metrics 和 clusters。
- WebGL renderer。

## 早期版本不做

- 仅为了可视化引入完整图数据库。
- 默认把每一笔 raw transaction 渲染成独立可见边。
- 3D 图谱。
- 实时流式图谱更新。
- 协作式图谱编辑。
- 仅凭图谱邻近性自动宣称“同一所有者”。
