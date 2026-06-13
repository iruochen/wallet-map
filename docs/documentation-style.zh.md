# 文档风格

English version: [documentation-style.md](documentation-style.md)

文档应帮助未来维护者和贡献者在没有私有上下文的情况下做出正确决策。

## 原则

- 面向维护者和贡献者，而不只面向当前作者。
- 优先使用具体示例，减少抽象描述。
- 清晰说明项目边界。
- 分析措辞必须谨慎、基于证据。
- 行为变化应与文档更新在同一变更中完成。
- 英文和中文文档应保持同等公开可读性。

## 结构

使用简短章节和描述性标题。

推荐顺序：

1. 目的。
2. 规则或行为。
3. 示例。
4. 运维说明。

## 语言

公开仓库文档维护英文和中文两个版本。英文文档使用清晰、正式的开源项目语气；中文文档应忠实表达同一边界、能力和限制，不使用口语化承诺。

## 分析措辞

不要在数据不足时使用确定性表达。

推荐：

- “relationship signal”
- “direct transfer found”
- “shared counterparty”
- “requires review”
- “关联信号”
- “发现直接转账”
- “共同交易对手”
- “需要人工复核”

避免：

- “same owner”
- “proves identity”
- “safe from detection”
- “bypass”
- “同一人控制”
- “保证规避”

## 示例和 Fixture

示例应满足：

- 合成或公开。
- 小而可检查。
- 不包含 secrets。
- 简化时明确标注。

不要包含私有钱包列表、API key、包含 secrets 的截图或私有调查备注。
