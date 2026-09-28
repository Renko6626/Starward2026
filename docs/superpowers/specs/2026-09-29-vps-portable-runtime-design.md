# VPS 可部署运行时与 Cloudflare 可回迁设计

Date: 2026-09-29  
Status: Draft for review  
Branch: `renko-dev`

## 1. 目标

Starward2026 需要在开发者可独立控制的 VPS 和域名上运行，同时保留未来迁回 Cloudflare Workers + D1 的能力。目标是增加 VPS 运行适配层，复用现有 React、Hono、Better Auth、Resend、业务状态机和测试体系，不建立第二套业务实现。

第一阶段成功标准：

- 本地可使用 Node.js + SQLite 启动完整应用；
- VPS 可通过 Docker Compose 或 systemd 部署，并由 Caddy/Nginx 提供 HTTPS；
- 登录、报名、审核、参与者门户、时间段和作品草稿流程可运行；
- 业务层不依赖具体部署平台；
- 原有 Wrangler + Workers + D1 路线继续保留，至少不被 VPS 改造破坏；
- SQLite 数据可备份、恢复和迁移。

不在本阶段范围内：

- 多实例高可用；
- PostgreSQL 迁移；
- Cloudflare 账号接管或 DNS 自动迁移；
- 文件上传、公开作品归档和新业务功能；
- 重写现有前端或业务状态机。

## 2. 现状与约束

当前应用是 React SPA + Hono Worker + D1。Cloudflare 依赖主要集中在：

- `worker/index.ts` 的 Worker `fetch` 入口；
- `AppBindings` 中的 D1、Workers Rate Limiting 和 Access 配置；
- `worker/data/*` 直接使用 `D1Database`；
- `worker/lib/admin.ts` 校验 Cloudflare Access JWT；
- `wrangler.jsonc` 管理绑定、环境和部署；
- `@cloudflare/vite-plugin` 参与本地开发和构建。

必须保持的约束：

- 业务 SQL 尽量维持 SQLite/D1 兼容，不引入仅 PostgreSQL 支持的语法；
- 路由层只处理 HTTP、鉴权解析和输入校验；
- 数据访问仍集中在 `worker/data/*`；
- 前端只依赖 API 和 `src/shared/*`，不直接依赖 VPS 或 Cloudflare 细节；
- 生产密钥不提交到仓库。

## 3. 方案

### 3.1 运行时

保留 Hono 应用对象作为唯一 API 实现，增加 Node.js 入口。Worker 入口继续导出同一个 Hono 应用；Node 入口使用 Hono Node adapter 监听 HTTP。静态 SPA 由 Caddy/Nginx 托管或由 Node 入口提供，优先采用反向代理托管静态文件的方式。

建议目录：

```text
server/
  node.ts          # Node 启动入口
  env.ts           # VPS 环境变量解析
deploy/
  docker-compose.yml
  Caddyfile
```

具体目录可按现有项目约定调整，但不得复制 Hono 路由。

### 3.2 数据库

第一阶段使用 VPS SQLite，启用 WAL。增加一个数据库适配接口或最小包装层，使数据层能够接收统一的数据库上下文：

- Cloudflare 运行时：D1 adapter；
- VPS 运行时：SQLite adapter；
- 业务查询继续使用 SQLite 兼容 SQL；
- 迁移脚本继续以 SQL 文件为主，并提供 VPS 执行入口。

SQLite 数据文件放在 Docker volume 或固定数据目录，不进入 Git。部署文档必须包含停机备份、在线备份注意事项和恢复步骤。至少保留每日备份与最近若干份轮换。

不在第一阶段引入 ORM，避免生成 Cloudflare 不兼容的 SQL，也避免把当前成熟的 SQL 数据层整体重写。

### 3.3 配置

Cloudflare 绑定配置继续由 `wrangler.jsonc` 管理。VPS 使用 `.env` 或 Docker secrets，至少覆盖：

- `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`BETTER_AUTH_TRUSTED_ORIGINS`；
- Resend API key、发件地址和名称；
- SQLite 文件路径；
- 管理员认证配置；
- Turnstile（如果 VPS 部署仍启用）；
- 限流配置。

环境解析应在启动时失败并给出明确错误，避免服务启动后才返回大量 503。

### 3.4 管理员认证

新增平台无关的管理员身份解析边界。业务路由继续使用 `requireAdminAccess` 或等价接口，但它内部根据运行时选择：

- Cloudflare：验证 Access JWT；
- VPS：验证 Better Auth 管理员角色或专用管理员会话。

VPS 不允许通过任意请求头直接伪造管理员身份。现有 `ALLOW_LOCAL_ADMIN_BYPASS` 只保留为 loopback 本地开发开关，不得作为 VPS 生产认证方案。

### 3.5 限流与反滥用

保留现有应用层限流接口。Cloudflare 环境继续使用 Workers Rate Limiting；VPS 环境第一阶段使用数据库/内存限流，单实例部署即可。若未来扩展多实例，再引入 Redis，不提前增加依赖。

Better Auth、邮箱 OTP、Resend、Turnstile 的业务流程保持不变。

## 4. 数据流

```text
Browser
  -> Caddy/Nginx (TLS, static assets, reverse proxy)
  -> Node Hono server
  -> platform adapters
       - SQLite + local rate limit + VPS admin auth
       - or D1 + Workers rate limit + Cloudflare Access
  -> shared data/domain logic
```

同一套 API 响应、状态码、业务权限和事件窗口规则必须在两种运行时一致。平台差异只能出现在入口、绑定解析、数据库连接、限流和管理员身份解析处。

## 5. 实施阶段与估算

以下是按当前代码规模、单人熟悉项目后的粗略估算，实际以基线测试和部署验证为准：

| 阶段 | 内容 | 估算 |
|---|---|---:|
| A | 运行时/配置边界整理，抽出平台依赖 | 0.5–1 天 |
| B | Node 入口与 SQLite adapter，迁移脚本接入 | 1–2 天 |
| C | VPS 管理员认证、限流和环境变量 | 1–2 天 |
| D | Docker Compose、Caddy、健康检查和日志 | 0.5–1 天 |
| E | 本地完整流程回归与 VPS staging 部署 | 1–2 天 |
| F | 备份恢复、部署文档和 Cloudflare 回归检查 | 0.5–1 天 |

合计约 **4.5–9 个工作日**。如果现有 D1 数据层能通过小包装直接复用，偏向下限；如果 Better Auth 的 SQLite 适配或现有 Cloudflare 插件耦合较深，可能接近上限。上述估算不包含购买/迁移域名、等待 DNS 生效和外部服务账号审核时间。

## 6. 验证要求

- `npm run check`、`npm test`、`npm run build` 在改造前后均通过；
- 新增 Node 入口测试：健康检查、静态错误处理、配置缺失时启动失败；
- 新增 SQLite adapter 测试，覆盖现有关键数据访问路径；
- 使用本地 seeded 数据验证登录、报名、审核、时间段、项目草稿和历史记录；
- VPS staging 做一次真实 HTTPS、邮件 OTP、管理员认证和数据库恢复演练；
- Wrangler 构建/部署配置做静态回归，确保未被 VPS 配置覆盖或删除。

## 7. 风险与取舍

- SQLite 单实例简单且最接近 D1，但需要认真做备份和恢复；
- VPS 不再天然获得 Cloudflare Access、DDoS 防护和边缘限流，需要由 Caddy、应用层和服务器防火墙补足；
- Better Auth 的数据库适配是最可能出现隐藏差异的部分，应先做最小登录 smoke test；
- 不应为了“未来可能扩容”提前引入 PostgreSQL、Redis 或复杂编排，这会扩大与 D1 的差异；
- Cloudflare 回迁的关键不是保留部署文件，而是保持业务层、SQL 和认证边界的平台无关。

## 8. 完成定义

当以下条件全部满足时，`renko-dev` 的第一阶段完成：

1. 开发者可以只凭仓库、环境变量和 VPS 凭据部署应用；
2. VPS 上的关键用户流程与当前 Cloudflare 设计一致；
3. 数据库有可验证的备份和恢复流程；
4. Cloudflare 的 Worker/D1 配置仍可单独构建，且没有被 VPS 代码路径取代；
5. 文档明确记录 VPS 部署、回滚、迁移和回到 Cloudflare 的步骤。
