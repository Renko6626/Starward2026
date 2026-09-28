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
| 参与者认证 | Better Auth + 邮箱密码 / Email OTP + Cookie Session |
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
- `scripts/` 包含本地开发与运维辅助脚本
- `docs/` 包含架构、范围、页面规范与产品文档

## 文档索引

文档入口：

- [docs/README.md](./docs/README.md)
- [docs/development/local-d1.md](./docs/development/local-d1.md)

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

## 参与者认证

- `/portal/login` 默认支持邮箱与密码登录，新用户可直接注册，无需验证邮件。
- 密码由 Better Auth 哈希后存入现有 `account` 表，不需要额外数据库迁移。
- `/portal/profile` 支持修改密码；原验证码账号可先登录，再设置密码，沿用原账号与参与者资料。
- 密码注册、登录和会话读取只依赖 D1、`BETTER_AUTH_SECRET` 与站点 URL，不依赖 Resend。
- 保留邮箱验证码登录和审核通知，只有这些邮件功能需要 Resend；此次不提供邮件找回密码。
- 原验证码账号若已退出且邮件不可用，需要先恢复身份验证渠道才能设置密码；重新注册不会覆盖原账号。已有未关联账号的邀请也需先验证邮箱后领取。

## 环境部署

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
