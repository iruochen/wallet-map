# Wallet Map Documentation

中文版本：[docs/README.zh.md](README.zh.md)

This directory contains the public project documentation for Wallet Map. The documentation is maintained in both English and Chinese so contributors can review architecture, product boundaries, and release requirements without private context.

## Recommended Reading Order

1. [Development Workflow](development-workflow.md)
2. [Architecture Map](architecture-map.en.md)
3. [Product Design Roadmap](product-design-roadmap.md)
4. [Analysis Guidelines](analysis-guidelines.md)
5. [Database Schema](database-schema.md)
6. [Graph Visualization](graph-visualization.md)
7. [Open Source Guidelines](open-source.md)
8. [Release Process](release-process.md)
9. [Project Readiness](project-readiness.md)

## Current Publication Notes

- The repository is pre-1.0.
- Fixture mode is the default path for public demos and storage-free Vercel deployments.
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
| Graph visualization | [graph-visualization.md](graph-visualization.md) | [graph-visualization.zh.md](graph-visualization.zh.md) |
| Product roadmap | [product-design-roadmap.md](product-design-roadmap.md) | [product-design-roadmap.zh.md](product-design-roadmap.zh.md) |
| Analysis guidelines | [analysis-guidelines.md](analysis-guidelines.md) | [analysis-guidelines.zh.md](analysis-guidelines.zh.md) |
| Open source | [open-source.md](open-source.md) | [open-source.zh.md](open-source.zh.md) |
| Release process | [release-process.md](release-process.md) | [release-process.zh.md](release-process.zh.md) |
| Project readiness | [project-readiness.md](project-readiness.md) | [project-readiness.zh.md](project-readiness.zh.md) |
