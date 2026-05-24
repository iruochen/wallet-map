# Project Readiness Checklist

This checklist tracks the early project setup needed before feature work grows.

## Completed

- [x] Architecture map.
- [x] TypeScript monorepo scaffold.
- [x] Local-first environment defaults.
- [x] Docker Compose for PostgreSQL and Redis.
- [x] Development workflow.
- [x] Code style guide.
- [x] Commit convention.
- [x] Documentation style guide.
- [x] Analysis guidelines.
- [x] Open-source guidelines.
- [x] Security policy.
- [x] Code of conduct.
- [x] License.
- [x] Changelog.
- [x] GitHub issue templates.
- [x] GitHub pull request template.
- [x] Basic tests for core packages.

## Before Public Release

- [ ] Add CI for `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build`.
- [ ] Add database migrations and schema documentation.
- [ ] Add a public demo fixture that does not contain private wallet data.
- [ ] Add report redaction guidance.
- [ ] Add dependency update policy.
- [ ] Decide whether docs should remain English-only or become bilingual.
- [ ] Replace temporary security contact language with a concrete contact channel.

## Before First Tagged Version

- [ ] Confirm license choice.
- [ ] Update `CHANGELOG.md`.
- [ ] Run the release checklist from `docs/release-process.md`.
- [ ] Tag `v0.1.0`.

