# 并行 Agent 工作

English version: [README.md](README.md)

本目录记录并行 Codex agent 工作，便于追踪实现历史。

当工作可以拆成互不重叠的写入范围时，可以使用这一模式。主线程负责：

- 定义所有权边界
- 启动或分发 prompts
- 审查结果
- 集成变更
- 运行完整检查
- 创建最终 Git commit

## 规则

- 每个 agent 必须拥有互不重叠的写入范围。
- Agent 不应直接提交 commit。
- Agent 不应回滚其他 agent 的变更。
- Agent 必须报告修改文件、验证命令和集成说明。
- 除非明确委派，主线程负责 README、CHANGELOG 和跨 package 集成。

## 当前记录

- [2026-05-24 MVP parallel run](2026-05-24-mvp-parallel-run.md)
- [2026-05-24 graph visualization thread](2026-05-24-graph-visualization-thread.md)
- [2026-05-24 UI interaction thread](2026-05-24-ui-interaction-thread.md)
