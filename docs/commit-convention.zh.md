# 提交规范

English version: [commit-convention.md](commit-convention.md)

提交应清晰、聚焦，只描述一个逻辑变更。

## 格式

使用轻量 Conventional Commits：

```text
type(scope): summary
```

`scope` 可选。

示例：

```text
feat(core): add graph builder
fix(adapters): handle empty csv rows
docs: add analysis guidelines
test(analyzers): cover direct transfers
chore: update local compose config
```

## 类型

- `feat`：用户可见功能或新能力。
- `fix`：bug 修复。
- `docs`：仅文档变更。
- `test`：测试或 fixture。
- `refactor`：不改变行为的代码调整。
- `chore`：工具、配置、仓库维护。
- `ci`：持续集成变更。
- `perf`：性能改进。

## 规则

- 使用祈使语气：`add`、`fix`、`update`、`remove`。
- summary 尽量少于 72 个字符。
- 不在一个提交里混合无关变更。
- 变更涉及隐私、数据模型或分析语义时，在正文说明。
- 不提交 secrets、私有钱包数据或真实 `.env` 文件。

## 推荐正文

当变更不明显时添加正文：

```text
feat(core): add shared counterparty analyzer

Adds a first-pass shared counterparty rule. The analyzer treats public
contracts as weak evidence and keeps transaction hashes in each finding.
```
