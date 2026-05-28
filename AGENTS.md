# Agent Operating Notes

Before committing, pushing, creating a repository, or deploying this project, always perform a safety pass.

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
- Inspect `git status --short` and `git diff --stat` before staging.
- Review all newly added files before staging, especially generated reports, screenshots, local config, and deployment metadata.

## Deployment Notes

- Configure production secrets through the deployment provider environment variable UI or CLI, not through committed files.
- Keep the app deployable without local-only defaults; production should receive keys from Vercel environment variables.
