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
├── .github/workflows/ # GitHub Actions 自动部署
├── deploy/            # Docker Compose + Caddy VPS stack（含 deploy.sh）
├── docs/
├── migrations/
├── server/            # Node/VPS 入口与平台适配器
├── src/
├── worker/
├── Dockerfile
├── package.json
├── vite.config.ts
├── vite.vps.config.ts
└── wrangler.jsonc
```

目录约定：

- `src/` 包含前端页面、共享类型与客户端逻辑
- `worker/` 包含 Hono API、认证集成与数据访问逻辑
- `server/` 包含 Node/VPS 入口、环境校验与 SQLite/管理员/限流适配器
- `deploy/` 包含 VPS 的 Docker Compose 与 Caddy 配置
- `migrations/` 包含 SQL 迁移文件（Cloudflare D1 与 VPS SQLite 共用）
- `scripts/` 包含本地开发与运维辅助脚本
- `docs/` 包含架构、范围、页面规范与产品文档

## 文档索引

文档入口：

- [docs/README.md](./docs/README.md)
- [docs/development/local-d1.md](./docs/development/local-d1.md)
- [docs/development/vps.md](./docs/development/vps.md) — VPS（Node + SQLite）部署与运维

架构与范围：

- [docs/architecture/system.md](./docs/architecture/system.md)
- [docs/architecture/time-segment-model.md](./docs/architecture/time-segment-model.md)
- [docs/delivery/phase-1/scope.md](./docs/delivery/phase-1/scope.md)
- [docs/delivery/phase-1/plan.md](./docs/delivery/phase-1/plan.md)

账号与流程：

- [docs/product/feature-map.md](./docs/product/feature-map.md) — 已实现页面与功能现状（as-built）
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

## 本地开发

推荐本地数据库初始化流程如下：

```bash
npm run db:local:reset
npm run dev
```

补充说明：

- `npm run db:local:reset` 会重建本地 D1 并写入 smoke 用示例数据
- `npm run db:local:print-portals` 会输出本地门户样本账号的已签名 cookie
- 详细约定见 [docs/development/local-d1.md](./docs/development/local-d1.md)

## VPS 部署（Node + SQLite）

除 Cloudflare Workers 路线外，仓库现在也支持在自有 VPS 上以 Docker Compose +
Caddy 运行同一套 Hono 应用，数据库为启用 WAL 的 SQLite。业务路由、SQL 与
Cloudflare 配置均未改动。

```bash
cp .env.example .env      # 填写密钥后 chmod 600 .env
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
curl -fsS https://<your-domain>/api/health
```

运维脚本：

```bash
npm run build:vps                       # 打包 Node 入口到 dist-vps/node.mjs
npm run start:vps                       # 启动已打包的 Node 入口（需已设置环境变量）
npm run db:vps:migrate                  # 幂等地执行 SQLite 迁移
npm run db:vps:backup -- --keep 14      # SQLite 在线备份并轮换
npm run db:vps:restore -- <file> --force  # 校验后恢复（需先停止应用）
```

防火墙、DNS、TLS、卷权限、日志、备份轮换、恢复、回滚、`VPS_ADMIN_EMAILS`、
`TRUST_PROXY_HEADERS` 以及反向代理 peer/IP 细节见
[docs/development/vps.md](./docs/development/vps.md)。

### 自动部署（GitHub Actions + 阿里云 ACR）

`.github/workflows/deploy.yml` 在 push `main` 或手动 `workflow_dispatch` 时：
先执行 `npm ci`、`npm run check`、`npm test`、`npm run build`，再把 Dockerfile
的 `runtime` 与 `caddy`（已烤入 SPA）两个 target 以不可变 SHA tag 与 `latest`
推送到阿里云 ACR，最后通过 SSH 在 VPS 上执行 `bash deploy/deploy.sh <sha>`。
脚本会先备份 SQLite、记录当前镜像、`pull` 后 `up -d --no-build`，等待 app
healthy 与 `/api/health`，失败时切回此前记录的镜像并重新健康检查（不会自动
恢复数据库）。

生产 `.env` 只保存在 VPS（建议 `/opt/starward/.env`，权限 600）；GitHub 仅保存
`ACR_*`、`VPS_*` 等 Secrets/Variables，仓库内不写入真实值。前置条件、Secrets/
Variables 清单、首次配置、手动触发、回滚、SQLite 前向迁移与备份恢复、以及
阿里云北京 ACME/ICP 风险见
[docs/development/vps.md](./docs/development/vps.md) 第 18 节。

## Cloudflare 环境部署（Wrangler + D1）

仓库当前采用以下 Wrangler 环境划分：

- 默认顶层配置：本地开发与通用构建
- `env.staging`：`https://hifuu-staging.ayafeed.com`
- `env.production`：保留为正式环境模板，启用前需补真实域名、路由与生产 D1 绑定

推荐命令如下：

```bash
npm run build:staging
npm run deploy:staging
```

补充说明：

- 使用 `@cloudflare/vite-plugin` 时，环境通过 `CLOUDFLARE_ENV` 选择
- 本地 `.dev.vars` 中的 `BETTER_AUTH_URL` 继续用于本地开发
- `env.production` 当前仍是模板，需补齐正式域名、正式 D1 绑定与独立 rate limit namespace 后再启用生产脚本

## License

TBD
