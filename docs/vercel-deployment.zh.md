# Vercel 部署

English version: [vercel-deployment.md](vercel-deployment.md)

Wallet Map 可以部署到 Vercel，不需要在 Vercel 上运行本地 Docker 服务。对于 Preview 或 Production 环境，建议先配置托管 Redis，再开放分析流程，这样 job 状态和进度不会因为 serverless 函数实例切换而丢失。

## 推荐服务

- Redis：通过 Vercel Marketplace 或 Upstash Console 创建 Upstash Redis。
- PostgreSQL：可选。只有需要持久化历史、历史回放或标签管理时，才启用 Neon 等托管 PostgreSQL。

应用仍然可以在无托管存储的 fixture 模式运行，但内存 job store 只适合本地开发和单实例演示。

Upstash 提供适合早期预览部署的免费额度。正式发布或邀请外部用户前，请以官方价格页面的最新限制为准。

## Upstash Redis

当前代码使用 `redis` 包，并读取 `REDIS_URL`。Upstash 应配置 Redis 协议连接串，优先使用 TLS URL：

```bash
STORAGE_REDIS_ENABLED=true
REDIS_URL=rediss://:password@endpoint:port
```

如果 Vercel Marketplace 集成只注入了 `KV_REST_API_URL`、`KV_REST_API_TOKEN`、`UPSTASH_REDIS_REST_URL` 或 `UPSTASH_REDIS_REST_TOKEN`，请到 Upstash 数据库连接页面复制 Redis protocol connection string，并在 Vercel 项目环境变量中手动新增 `REDIS_URL`。

除非维护者明确需要 Redis 标签缓存，否则保持关闭：

```bash
LABEL_REDIS_CACHE_ENABLED=false
LABEL_LIST_CACHE_ENABLED=false
```

## 可选 PostgreSQL

只有需要持久化历史或私有标签管理时才启用 PostgreSQL：

```bash
STORAGE_POSTGRES_ENABLED=true
DATABASE_URL=postgresql://...
LABEL_DATABASE_ENABLED=true
NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false
```

启用历史或标签管理前先执行迁移：

```bash
pnpm db:migrate
```

公开部署中保持 `NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false`，除非维护者明确要通过 Web UI 维护标签库。

## Vercel 配置清单

1. 在 Vercel 中导入或连接 GitHub 仓库。
2. 使用 pnpm 构建；当前构建命令为 `pnpm --filter @wallet-map/web build`。
3. 通过 Vercel Marketplace 添加 Upstash Redis，或在 Upstash 创建数据库。
4. 为 Production 和 Preview 环境配置 `STORAGE_REDIS_ENABLED=true` 与 `REDIS_URL`。
5. 不需要历史或标签管理时保持 PostgreSQL 关闭。
6. 面向公开用户时保持标签管理页面关闭。
7. 所有 provider key 只通过 Vercel 环境变量配置。
8. 先用 fixture 模式验证一次分析，再启用 live provider key。

参考资料：

- [Vercel Redis documentation](https://vercel.com/docs/redis)
- [Vercel Storage overview](https://vercel.com/docs/storage)
- [Upstash client connection guide](https://upstash.com/docs/redis/howto/connect-client)
- [Upstash pricing](https://upstash.com/pricing)
