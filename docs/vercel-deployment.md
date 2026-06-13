# Vercel Deployment

中文版本：[vercel-deployment.zh.md](vercel-deployment.zh.md)

Wallet Map can run on Vercel without local Docker services. For deployed preview or production environments, configure managed Redis before enabling public analysis flows so job status and progress remain available across serverless function instances.

## Recommended Services

- Redis: Upstash Redis through Vercel Marketplace or the Upstash Console.
- PostgreSQL: optional. Use a managed provider such as Neon only when persistent history, replay, or label management is required.

The application can still run in fixture mode without managed storage, but the in-memory job store is only appropriate for local development and single-instance demos.

Upstash provides a free tier suitable for early preview deployments. Confirm the current limits on the official pricing page before publishing or inviting external users.

## Upstash Redis

The Vercel deployment path should use Upstash REST variables:

```bash
STORAGE_REDIS_ENABLED=true
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

The job store also supports Vercel KV variable names (`KV_REST_API_URL` and `KV_REST_API_TOKEN`) and a Redis protocol fallback through `REDIS_URL=rediss://...`.

Keep label caches disabled unless a maintainer intentionally enables them:

```bash
LABEL_REDIS_CACHE_ENABLED=false
LABEL_LIST_CACHE_ENABLED=false
```

## Optional PostgreSQL

Enable PostgreSQL only when durable history or the private label manager is needed:

```bash
STORAGE_POSTGRES_ENABLED=true
DATABASE_URL=postgresql://...
LABEL_DATABASE_ENABLED=true
NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false
```

Run migrations before enabling history or label management:

```bash
pnpm db:migrate
```

Keep `NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false` for public deployments unless the maintainer intends to operate the label library through the web UI.

## Vercel Setup Checklist

1. Import or connect the GitHub repository in Vercel.
2. Set the root command to use pnpm. The current build command is `pnpm --filter @wallet-map/web build`.
3. Add Upstash Redis from Vercel Marketplace or create a database in Upstash.
4. Add `STORAGE_REDIS_ENABLED=true`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` to Production and Preview environments.
5. Keep PostgreSQL disabled unless history or label management is needed.
6. Keep the label manager disabled for public users.
7. Add provider keys only through Vercel environment variables.
8. Deploy and verify one fixture-mode analysis before enabling live provider keys.

References:

- [Vercel Redis documentation](https://vercel.com/docs/redis)
- [Vercel Storage overview](https://vercel.com/docs/storage)
- [Upstash client connection guide](https://upstash.com/docs/redis/howto/connect-client)
- [Upstash pricing](https://upstash.com/pricing)
