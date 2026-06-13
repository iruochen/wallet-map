# Wallet Map Product Design Roadmap

中文版本：[product-design-roadmap.zh.md](product-design-roadmap.zh.md)

## 1. Purpose

This document summarizes Wallet Map's product direction after the MVP. It reflects the current repository state, the implemented workbench, graph analysis, report export, optional persistence, and the publication requirements for an open-source release.

Wallet Map should remain a restrained, evidence-first product: a local-first wallet relationship and on-chain exposure audit tool. It does not provide wallet custody, signing, automation, or evasion guidance.

## 2. Current Progress

The project has moved from concept validation to a usable pre-1.0 workbench.

Completed:

- `/api/analyze` supports fixture, auto, and live modes.
- Etherscan-like live mode covers Ethereum, Arbitrum, Base, and BSC when configured.
- NodeReal and Solscan provider hooks are available for supported chains.
- `@wallet-map/adapters` normalizes native transfers, internal transfers, ERC20 transfers, ERC721 transfers, and provider events into `NormalizedEvent`.
- `@wallet-map/core` builds `RelationshipGraph` and runs the analysis pipeline.
- `@wallet-map/analyzers` includes direct transfer, shared counterparty, same-contract interaction, shared flow, multi-hop path, temporal pattern, and bridge correlation signals.
- Scoring supports multidimensional exposure review.
- The Next.js workbench displays input, progress, summary, pair insights, findings, evidence, graph view, and report export.
- Report export supports PDF, Markdown, JSON, and CSV evidence.
- PostgreSQL persistence, Redis job/cache support, and local label management exist as optional capabilities.
- Storage and label management can now be disabled by configuration for Vercel deployments without PostgreSQL/Redis.

Still required before a public stable release:

- CI for typecheck, test, lint, and build.
- More provider resilience and cache validation.
- Formal security contact.
- Dependency update policy.
- Release checklist completion.

## 3. Product Positioning

Wallet Map is a local-first wallet relationship audit workbench for personal researchers, small teams, and public-data reviewers. It uses graphs, evidence tables, and explainable scores to show visible on-chain relationship signals across a group of EVM addresses.

Differentiators:

- Starts from a user-provided address group rather than a single whale or exploit address.
- Focuses on relationship strength inside the group.
- Defaults to local-first workflows and avoids uploading private address lists by default.
- Presents evidence before conclusions.
- Keeps data providers, analyzers, labels, and exporters pluggable.

## 4. Product Boundaries

Supported:

- wallet group relationship review
- shared funding, shared destination, shared contract, temporal, bridge, and path signals
- graph, evidence, report, and history workflows
- optional local labels maintained by the project owner

Not supported:

- automated wallet operations
- private keys, seed phrases, signatures, or custody
- generated scripts for bypassing review systems
- deterministic claims such as “same owner” or “undetectable”

## 5. User Segments

### Individual Users

Need to review 2-20 wallets, understand visible relationships, inspect transaction evidence, and export a local report.

### Small Teams

Need larger batches, labels, history replay, pair ranking, and repeatable review workflows.

### Researchers

Need reproducible fixtures, structured JSON, custom analyzers, and evidence-preserving exports.

## 6. Core Experience

1. Enter or import address groups.
2. Select chain, time range, and data mode.
3. Resolve fixture, cached, or live events.
4. Build graph and run analyzers.
5. Show score, key pairs, graph, findings, and evidence.
6. Let users filter, inspect, and export reports.
7. Persist and replay jobs only when storage is configured.

## 7. Infrastructure Policy

PostgreSQL and Redis are optional.

Default publication posture:

- Fixture mode works without external infrastructure.
- Vercel deployments can run without Pg/Redis.
- `STORAGE_POSTGRES_ENABLED=false` and `STORAGE_REDIS_ENABLED=false` are valid defaults.
- `/labels` is private and disabled unless `NEXT_PUBLIC_LABEL_MANAGER_ENABLED=true`.

Enable storage only when history persistence, multi-instance job progress, label cache, or maintainer-managed labels are required.

## 8. Roadmap

### M0: MVP Stabilization

Status: mostly complete.

- [x] Workbench flow.
- [x] Fixture mode.
- [x] Live Etherscan-like path.
- [x] Graph and evidence display.
- [x] Report export.
- [x] Storage-disabled configuration path.
- [ ] CI workflow.

### M1: Evidence Workflow

Status: substantially complete.

- [x] Graph/evidence presentation.
- [x] Pair insights.
- [x] Markdown/JSON/CSV/PDF exports.
- [x] Public synthetic fixture.
- [ ] Continued graph/evidence linking polish.

### M2: Data Layer Engineering

Status: partially complete.

- [x] PostgreSQL analysis storage.
- [x] Redis job progress and label cache.
- [x] Job replay and history page.
- [x] Provider selector and live concurrency guard.
- [x] Storage and label feature switches.
- [ ] Cache hit-rate validation.
- [ ] Additional live provider path.

### M3: Advanced Analyzers

Status: core set complete.

- [x] Shared funding source.
- [x] Shared withdrawal/deposit.
- [x] Multi-hop path.
- [x] Temporal pattern.
- [x] Bridge correlation.
- [x] Known entity label provider.
- [x] Public entity down-weighting.

### M4: Professional Review Shape

Status: early implementation complete.

- [x] Multidimensional Exposure Score.
- [x] Workbench score dimensions and top signals.
- [x] PDF, Markdown, JSON, and CSV export.
- [x] History comparison.
- [x] CSV import improvements.
- [x] Local label manager, private by default.
- [x] Typed product capability model.

## 9. Risks

- Data source cost and rate limits.
- False positives from public entities and popular contracts.
- Graph performance on large address groups.
- Privacy risk from address lists and exports.
- Product language that overstates certainty.
- Long-term maintenance cost across providers and chains.

## 10. Success Criteria

Product:

- Users can complete a 10-20 address review in under five minutes.
- High-priority findings link to evidence within two interactions.
- Exported reports can be reviewed without frontend state.

Engineering:

- Fixture tests are stable.
- Analyzers cover false-positive and boundary cases.
- Live providers have timeouts and fallback paths.
- Storage-disabled deployments remain a supported path.

Open source:

- New contributors can run fixture mode without secrets.
- Documentation is bilingual and aligned.
- Release checks include secret scanning and environment safety review.
