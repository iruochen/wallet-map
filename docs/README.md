# Wallet Map Documentation

中文版本：[docs/README.zh.md](README.zh.md)

This directory contains the public project documentation for Wallet Map. The documentation is maintained in both English and Chinese so contributors can review architecture, product boundaries, and release requirements without private context. Internal roadmaps, agent run notes, and local assistant instructions are intentionally kept out of the public repository.

## Recommended Reading Order

1. [Development Workflow](development-workflow.md)
2. [Architecture Map](architecture-map.en.md)
3. [Analysis Guidelines](analysis-guidelines.md)
4. [Database Schema](database-schema.md)
5. [Vercel Deployment](vercel-deployment.md)
6. [Open Source Guidelines](open-source.md)
7. [Release Process](release-process.md)

## Publication Notes

- Fixture mode is the default path for local demos and contributor onboarding.
- Vercel preview and production deployments should use managed Redis for analysis job status.
- PostgreSQL, Redis, label persistence, label cache, and the label manager page are optional runtime capabilities.
- The label manager is private by default and is controlled by `NEXT_PUBLIC_LABEL_MANAGER_ENABLED`.
- Public examples must use synthetic wallet addresses.

## Language Map

| Topic | English | 中文 |
| --- | --- | --- |
| Architecture | [architecture-map.en.md](architecture-map.en.md) | [architecture-map.md](architecture-map.md) |
| Development workflow | [development-workflow.md](development-workflow.md) | [development-workflow.zh.md](development-workflow.zh.md) |
| Code style | [code-style.md](code-style.md) | [code-style.zh.md](code-style.zh.md) |
| Commit convention | [commit-convention.md](commit-convention.md) | [commit-convention.zh.md](commit-convention.zh.md) |
| Documentation style | [documentation-style.md](documentation-style.md) | [documentation-style.zh.md](documentation-style.zh.md) |
| Database schema | [database-schema.md](database-schema.md) | [database-schema.zh.md](database-schema.zh.md) |
| Vercel deployment | [vercel-deployment.md](vercel-deployment.md) | [vercel-deployment.zh.md](vercel-deployment.zh.md) |
| Analysis guidelines | [analysis-guidelines.md](analysis-guidelines.md) | [analysis-guidelines.zh.md](analysis-guidelines.zh.md) |
| Open source | [open-source.md](open-source.md) | [open-source.zh.md](open-source.zh.md) |
| Release process | [release-process.md](release-process.md) | [release-process.zh.md](release-process.zh.md) |
