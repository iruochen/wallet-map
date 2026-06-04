# Agent Operating Notes

Before committing, pushing, creating a repository, or deploying this project, always perform a safety pass.

## Project Docs

- Start with [Development Workflow](docs/development-workflow.md), [Architecture Map](docs/architecture-map.md), and [Product Design Roadmap](docs/product-design-roadmap.zh.md) before broad product or architecture changes.
- Follow [Code Style](docs/code-style.md), [Documentation Style](docs/documentation-style.md), and [Commit Convention](docs/commit-convention.md) when editing code, docs, or preparing commits.
- Use [Analysis Guidelines](docs/analysis-guidelines.md), [Graph Visualization Plan](docs/graph-visualization.md), and [Database Schema](docs/database-schema.md) for analyzer behavior, graph data contracts, and persistence/API boundaries.
- Check [Project Readiness](docs/project-readiness.md), [Release Process](docs/release-process.md), and [Open Source Guidelines](docs/open-source.md) before public release, tagging, deployment, repository creation, or publishing.

## Secret and Data Safety

- Never commit local environment files: `.env`, `.env.*`, `apps/web/.env`, `apps/web/.env.*`.
- Only commit `.env.example` files with empty placeholder values.
- Never commit real API keys, bearer tokens, JWTs, RPC keys, GitHub tokens, Vercel tokens, or private wallet data.
- Never commit user-provided real wallet addresses as samples, defaults, tests, screenshots, docs, or fixtures.
- Use synthetic addresses such as `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` in examples and tests.
- Before every push or deployment, run a secret scan with `rg` for key terms such as `API_KEY`, `TOKEN`, `SECRET`, `eyJ`, and any user-provided addresses from the conversation.

## Verification Before Push

- Run the project checks that match the change scope. For broad changes, run:
  - `pnpm -r typecheck`
  - `pnpm -r test`
  - `pnpm --filter @wallet-map/web build`
- After changing frontend loading, progress, navigation, or report-export flows, verify the affected UI with a browser/dev-server check in addition to automated tests. Confirm loading/progress appears in only the intended region and that labels/buttons are not truncated.
- Inspect `git status --short` and `git diff --stat` before staging.
- Review all newly added files before staging, especially generated reports, screenshots, local config, and deployment metadata.
- When code changes are complete and verified, create a focused git commit unless the user explicitly asks not to commit.

## Deployment Notes

- Configure production secrets through the deployment provider environment variable UI or CLI, not through committed files.
- Keep the app deployable without local-only defaults; production should receive keys from Vercel environment variables.

## Module Boundaries and File Size

- Keep UI files focused. If a React component grows past roughly 350 lines, split pure types, formatting helpers, data shaping, subcomponents, and styles into nearby modules before adding more behavior.
- Avoid placing data-source, label-provider, storage, or normalization logic inside page/component files. Put those concerns in `packages/*` or route-local service modules.
- Treat address and contract labels as data enrichment. New label sources should implement provider-style modules, not hard-coded frontend conditionals.
- Prefer small pure helper modules with unit tests for graph shaping, presentation models, label enrichment, and API request planning.
- When adding a new feature to an already-large file such as `analysis-workbench.tsx` or `graph-explorer.tsx`, first extract at least one coherent helper/subcomponent if the change would make the file larger.
