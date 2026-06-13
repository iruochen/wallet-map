# 发布流程

English version: [release-process.md](release-process.md)

项目仍处于 pre-1.0。发布应保持简单、可审计。

## 版本规则

使用 semantic versioning：

- Patch：bug 修复、文档、内部改进。
- Minor：新 analyzer、adapter、UI flow 或报告格式。
- Major：破坏性 API、schema 或报告格式变更。

在 `1.0.0` 前，minor 版本可能包含 breaking changes，但必须在 `CHANGELOG.md` 中明确说明。

## 发布清单

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] 更新 `CHANGELOG.md`
- [ ] 确认 `.env` 文件和私有数据未被追踪
- [ ] 执行 secret scan
- [ ] 确认 Pg/Redis/标签管理开关的默认值适合目标部署环境
- [ ] 打 tag

## Tag 格式

```text
v0.1.0
v0.2.0
v1.0.0
```

## Changelog 风格

使用以下章节：

- Added
- Changed
- Fixed
- Security
- Docs

条目应面向用户，保持简洁。
