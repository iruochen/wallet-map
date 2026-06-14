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

## 前端模块布局

按职责组织 `apps/web/components/<domain>/`。以 `components/analysis/` 为规范示例。

```text
components/analysis/
  index.ts          # 页面级窄 barrel 导出
  types.ts          # 领域共享类型
  workbench/        # 页面编排与主面板
  evidence/         # 单一 workflow 区域的 UI
  lib/              # 纯逻辑、格式化、状态恢复
    foo.ts
    foo.test.ts     # 测试与源码同目录
```

约定：

- 纯逻辑、格式化、下载、状态恢复放在 `lib/`。
- 编排型组件放在 `workbench/` 或同类 UI 子目录。
- 可复用 UI 片段放在功能子目录，例如 `evidence/`。
- 共享类型放在领域根目录的 `types.ts`。
- `index.ts` 只导出页面或其他领域真正需要的 API。
- Vitest 测试与实现同目录（`foo.ts` + `foo.test.ts`）。
- React 组件超过约 350 行时先拆分 helper 和子组件，再扩展行为。
- 不要把 API helper 放在 `components/`；共享应用工具放在 `apps/web/lib/`。
- 其他领域变大时沿用同一模式，例如 `graph/lib/`、`history/lib/`、`labels/lib/`。

## Package 布局

`packages/<name>/src/` 默认保持扁平，除非 package 明显需要子目录。

```text
packages/analyzers/src/
  direct-transfer.ts
  direct-transfer.test.ts
  index.ts          # 窄公共导出
```

约定：

- package 测试与源码同目录。
- `index.ts` 保持窄导出面。
- 文件超过约 350 行时先拆分，再扩展行为。
- 领域逻辑留在 `packages/*`；路由与 UI 负责编排，不重复实现核心逻辑。

## 响应式与移动端布局

应用使用同一套 UI 代码库 + 自适应布局壳层。不要单独做移动端路由树，也不要复制业务逻辑。

断点（定义在 `apps/web/app/styles.css`）：

- `--bp-mobile: 768px` — 手机布局：底部应用导航 + 工作台单面板 Tab。
- `--bp-tablet: 1040px` — 中等宽度下工作台纵向堆叠。
- `--bp-desktop: 1200px` — 完整三栏工作台。

移动端模式：

- 应用壳：底部导航 `AppMobileNav` 切换 `/`、`/history`、`/labels`；顶栏保留品牌、语言、钱包连接。
- 工作台：`WorkbenchMobileTabs` 切换 输入 / 图谱 / 证据；运行分析后自动打开图谱；完成后轻提示查看证据。
- 控件：手机端用 `mobileOnly` 的 `<select>`，桌面端 segmented 控件加 `desktopOnly`。
- 历史：手机卡片列表 `historyCardList`，桌面表格 `historyTable desktopOnly`。
- 图谱：工具条可折叠 `graphToolbarCollapsed` / `graphToolbarExpanded`；保留 Cytoscape 触控平移缩放。
- 工具类：`desktopOnly`、`mobileOnly`；高度优先 `100dvh` 与 `env(safe-area-inset-*)`。

新增页面或面板时，除桌面外还需检查 `390×844`、`360×800` 视口。

## UI 风格

UI 应像分析工作台，而不是营销页面。

- 以 workflow 开始，不以 landing page 开始。
- 控件应可见、稳定、可预测。
- 结论附近展示证据。
- 避免干扰图谱和表格的装饰元素。
- 重复分析场景优先紧凑、可扫描布局。
