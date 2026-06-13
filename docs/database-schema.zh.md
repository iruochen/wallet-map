# 数据库结构

English version: [database-schema.md](database-schema.md)

Wallet Map 将 PostgreSQL 和 Redis 作为可选基础设施。没有配置这两项服务时，应用仍可在 fixture 模式或本地单实例演示中运行。Vercel Preview 和 Production 部署建议使用托管 Redis 保存分析 job 状态。

## 当前边界

- `@wallet-map/storage` 负责 schema 文件、repository 接口和 PostgreSQL 实现。
- Web 应用仅在 `STORAGE_POSTGRES_ENABLED=true` 且 `DATABASE_URL` 存在时写入 PostgreSQL。
- Analysis job 进度仅在 `STORAGE_REDIS_ENABLED=true` 且 `REDIS_URL` 存在时写入 Redis；否则使用内存 job store。
- 完成的分析快照和 normalized rows 在 PostgreSQL 中持久化，用于历史复盘。
- 公开实体标签可存入 `known_labels`，并在 Redis 中做热缓存。
- `/labels` 私有标签管理页面默认关闭，由 `NEXT_PUBLIC_LABEL_MANAGER_ENABLED` 控制。

## Migrations

按顺序执行：

1. `packages/storage/migrations/0001_initial_schema.sql`
2. `packages/storage/migrations/0002_analysis_job_metadata.sql`
3. `packages/storage/migrations/0003_scoped_event_and_job_subjects.sql`

本地 Docker Compose 示例：

```bash
docker-compose up -d
psql "$DATABASE_URL" -f packages/storage/migrations/0001_initial_schema.sql
psql "$DATABASE_URL" -f packages/storage/migrations/0002_analysis_job_metadata.sql
psql "$DATABASE_URL" -f packages/storage/migrations/0003_scoped_event_and_job_subjects.sql
```

## 表

### `analysis_jobs`

存储一次用户触发的分析请求。

关键字段：

- `id`：稳定 job id。
- `status`：`pending`、`running`、`completed`、`failed`。
- `progress`：最新 pipeline phase 的 JSON 快照。
- `result_snapshot`：用于快速 replay 的 API response。
- `input_addresses`、`chain_ids`、`data_mode`、`chain_name`、`source_label`。
- `subject_id`：`wallet:<address>` 或 `session:<id>`。
- `watched_address_count`、`event_count`。
- `score`：`runAnalysis` 生成的关系评分。
- `error_message`：失败原因。
- 创建、更新、开始、完成时间。

### `normalized_events`

存储作为 evidence 的 normalized chain events。Event ID 以 `analysis_job_id` 作用域隔离，避免重复分析同一源事件时产生主键冲突。

### `graph_nodes` / `graph_edges`

存储按 job 作用域隔离的关系图输出。

### `findings`

存储 `runAnalysis` 的 analyzer 输出。

### `known_labels`

存储 Chainbase、Etherscan nametag、静态 seed 或维护者本地标签产生的 public/team-curated labels。

PostgreSQL 查找优先级为：`chainbase-address-labels`、`etherscan-nametag`、`known-entity-labels`、`static-label-registry`。维护者手动记录使用 `local-labels` source。

## API 集成

| Endpoint | Storage |
| --- | --- |
| `POST /api/analyze` | 创建 Redis 或内存 job；启用 Pg 时创建 `analysis_jobs` |
| `GET /api/analyze/jobs/:id` | 优先读 Redis/内存 job，必要时回退到 PostgreSQL snapshot |
| `GET /api/analyze/jobs` | 启用 Pg 时列出近期 jobs |
| `GET /api/labels` | 标签管理开启且 Pg 可用时读取 `known_labels` |
| `POST /api/labels` | 标签管理开启且 Pg 可用时写入 `local-labels` |

## 环境变量

```bash
STORAGE_POSTGRES_ENABLED=true
DATABASE_URL=postgresql://...
STORAGE_REDIS_ENABLED=true
REDIS_URL=rediss://...
CHAINBASE_API_KEY=...
LABEL_DATABASE_ENABLED=true
LABEL_REDIS_CACHE_ENABLED=true
LABEL_LIST_CACHE_ENABLED=true
NEXT_PUBLIC_LABEL_MANAGER_ENABLED=false
```

Vercel 部署应使用 Upstash 等托管 Redis 保存 job 进度。只有需要持久化历史或标签管理时才启用 Neon 等托管 PostgreSQL。不要在 Vercel 上运行 Docker Compose。见 [Vercel 部署](vercel-deployment.zh.md)。
