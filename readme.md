# Starward2026

秘封组同人接力创作活动网站。

## 项目概览

Starward2026 的目标范围包含以下三类能力：

1. 公共活动站点
2. 报名与审核流程
3. 参与者门户与管理员后台

当前技术方向为：

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript + Vite |
| API | Hono on Cloudflare Workers |
| 数据库 | Cloudflare D1 |
| 参与者认证 | Better Auth + Email OTP + Cookie Session |
| 反滥用 | Cloudflare Turnstile + Workers Rate Limiting |
| 管理后台保护 | Cloudflare Access |
| 文件存储 | Cloudflare R2（仅在需要上传文件时启用） |

## 当前里程碑

第一期的主要目标如下：

- 开始页
- 报名页
- 报名成功页
- 管理员后台
- 参与者入口的基础能力

公开作品归档与详情页属于后续阶段，不属于当前最小上线范围。

## 仓库结构

```text
Starward2026/
├── docs/
├── migrations/
├── src/
├── worker/
├── package.json
├── vite.config.ts
└── wrangler.jsonc
```

目录约定：

- `src/` 包含前端页面、共享类型与客户端逻辑
- `worker/` 包含 Hono API、认证集成与数据访问逻辑
- `migrations/` 包含 Cloudflare D1 SQL 迁移文件
- `docs/` 包含架构、范围、页面规范与产品文档

## 文档索引

文档入口：

- [docs/README.md](./docs/README.md)

架构与范围：

- [docs/architecture/system.md](./docs/architecture/system.md)
- [docs/architecture/time-segment-model.md](./docs/architecture/time-segment-model.md)
- [docs/delivery/phase-1/scope.md](./docs/delivery/phase-1/scope.md)
- [docs/delivery/phase-1/plan.md](./docs/delivery/phase-1/plan.md)

账号与流程：

- [docs/product/accounts/participant-account-system.md](./docs/product/accounts/participant-account-system.md)
- [docs/product/portal/skeleton.md](./docs/product/portal/skeleton.md)
- [docs/product/portal/data-api.md](./docs/product/portal/data-api.md)

站点与页面：

- [docs/product/site/skeleton.md](./docs/product/site/skeleton.md)
- [docs/design/homepage-wireframe.md](./docs/design/homepage-wireframe.md)
- [docs/design/apply-page-wireframe.md](./docs/design/apply-page-wireframe.md)
- [docs/design/works-page-wireframe.md](./docs/design/works-page-wireframe.md)
- [docs/design/work-detail-page-spec.md](./docs/design/work-detail-page-spec.md)

## 当前状态

仓库已经迁移到当前的 React + Hono + D1 结构。

- 前端路由位于 `src/routes`
- 页面实现位于 `src/app`、`src/admin`、`src/portal`
- Worker 入口位于 `worker/`
- 数据迁移位于 `migrations/`

后续实现应以架构文档与一期交付计划为准。

## License

TBD
