# Local D1 Development

## 1. Purpose

本文定义 Starward2026 的本地 D1 重建与示例数据流程。

目标如下：

- 让本地 `vite` 开发环境始终拥有完整 schema
- 为后台审核页提供稳定的示例数据
- 为参与者门户提供可直接复用的本地会话样本
- 避免继续依赖手工 SQL 插入做 smoke

## 2. Commands

### 2.1 一键本地体验（推荐给合作者）

在仓库根目录执行：

```bash
npm run test:env -- local
```

这个入口会依次完成：

1. 如果没有 `.dev.vars`，生成一个只用于本机、且被 Git 忽略的 Better Auth 密钥，并打开
   loopback 管理员 bypass 与本地 origin trust；已有 `.dev.vars` 不会覆盖。
2. 删除并重建本地 D1，应用全部迁移并写入 seeded 门户、参与者、时间段和 session。
3. 打印外部服务状态，然后启动 Vite + Cloudflare Worker 开发服务器。

浏览器打开 `http://localhost:20262`。启动报告中的 `[ready]` / `[offline]` 是有意设计的：

| 服务 | 未配置时的表现 | 本地是否仍可继续跑页面 |
| --- | --- | --- |
| Wrangler D1 local | 无 | 可以，核心 API 使用本地数据库 |
| 本地管理员入口 | 需要 `.dev.vars` 中的 bypass | 可以；入口脚本会为新环境打开它 |
| Resend 登录邮件 OTP | 登录发送验证码接口返回不可用 | 可以浏览 seeded 页面；用打印出的本地 session 做 smoke |
| Turnstile | 验证码校验关闭 | 可以；提交流程不要求外部验证码 |

本地入口不会打印密钥值，也不会触发 Cloudflare、ACR 或 VPS 部署。停止服务器按 `Ctrl-C`；
再次启动会重新 reset seeded 数据。

### 2.2 手动本地 D1 命令

`npm run dev` 使用本地 Worker 和 `.wrangler/state` 中的 D1；Vite 配置已设置
`remoteBindings: false`。终端出现 `Proxy environment variables detected` 仅表示检测到代理变量，
启动失败需查看具体错误。本地 `.dev.vars` 中的 `BETTER_AUTH_URL` 使用
`http://localhost:20262`。

若密码错误时出现 Vite 的 `fetch failed` 报错层，旧版 Miniflare 的 Undici
会把带请求体的 `401` 响应误判为网络错误，见 [上游问题](https://github.com/cloudflare/workers-sdk/issues/13578)。
项目通过 `overrides.miniflare.undici` 固定为 `7.24.8`，使无效凭据正常返回 `401`。
拉取修复后执行 `npm install` 并重启 `npm run dev`；不需要重置数据库或关闭报错层。

`npm run dev` 不会自动应用数据库迁移。更新代码后，如果接口报
`no such column` 或 `no such table`，先检查本地迁移状态：

```bash
npx wrangler d1 migrations list starward2026 --local
curl --noproxy '*' http://localhost:20262/api/health
curl --noproxy '*' http://localhost:20262/api/works
```

健康接口只验证 Worker 可访问；作品接口还会验证当前数据库字段可查询。
`0012_unified_credit.sql` 会重建个人档案表，已有资料的库应先备份并转换资料，
再升级；需要保留数据时不要直接使用 reset。2026-10-07 的本地修复已保留
账号、会话、报名、排期、作品与联系资料，升级前完整备份位于 `.wrangler/backups/`。

推荐命令如下：

```bash
npm run db:local:reset
npm run dev
```

说明：

- `npm run db:local:reset`
  - 删除本地 `.wrangler/state/v3/d1`
  - 重新执行全部 D1 migrations
  - 写入本地开发示例数据
  - 输出门户样本账号的已签名 cookie

- `npm run db:local:seed`
  - 保留现有本地 D1 文件
  - 在当前本地库中补写示例数据
  - 适用于 migrations 已存在且只想恢复样本数据的场景

- `npm run db:local:print-portals`
  - 不修改数据库
  - 仅打印门户样本账号的已签名 cookie

### 2.3 本机 Docker 运行时

想体验 Node + SQLite + Caddy，而不是 Worker 本地模拟时：

```bash
cp .env.example .env
# 填入本机测试用的 BETTER_AUTH_SECRET、BETTER_AUTH_URL、Resend 等变量
npm run test:env -- docker
```

该路径需要 Docker Engine 和 Compose v2，默认通过 `http://localhost` 访问。它使用独立的
Docker named volumes，不会复用本地 D1；停止可执行：

```bash
docker compose --env-file .env -f deploy/docker-compose.yml down
```

### 2.4 Cloudflare staging

没有 VPS 也可以把 Worker 部署到 Cloudflare staging，但需要 Cloudflare 账号、D1 binding、
域名和 secrets：

```bash
npm run test:env -- staging
npm run build:staging
npm run deploy:staging
```

`test:env -- staging` 只展示检查和部署命令，不会替合作者执行远程部署。Staging 与本地 D1
和 Docker SQLite 是三套独立数据，不要把测试账号或备份混用。

## 3. Seed Coverage

本地 seed 默认覆盖以下样本：

- 一个已建立入口账号、已补联系资料、但仍处于待审核状态的门户样本
- 一个已审核通过、门户已激活、已持有时间段、已存在资料补录草稿的参与者样本
- 一组开放窗口状态：报名、时间段认领/变更、预告及审查资料提交默认启用且不设时间限制，公开发布保持未启用；过期与预约状态由窗口测试验证
- 一组本地样本时间段
- 使用硬切后的 `credit_name` 与 `is_anonymous` 档案字段
- 参与者事件历史
- Better Auth 本地 session

## 4. Portal Personas

### 4.1 Pending Review

用途：

- 验证 `/portal`
- 验证 `/portal/profile`
- 验证 `/portal/application`
- 验证“已登录但尚未获得参与资格”的状态页
- 验证“笔名可留空、匿名仅影响公开署名”的资料组合

固定邮箱：

- `portal-pending@seed.starward.local`

### 4.2 Approved Participant

用途：

- 验证 `/portal`
- 验证 `/portal/schedule`
- 验证 `/portal/project`
- 验证 `/portal/history`

固定邮箱：

- `portal-approved@seed.starward.local`

## 5. Cookie Usage

`npm run db:local:reset` 与 `npm run db:local:print-portals` 会输出每个门户样本的：

- `better-auth.session_token=...`
- 可直接复制到浏览器控制台的 `document.cookie = ...` 片段

注意：

- 该 cookie 值依赖本地 `BETTER_AUTH_SECRET`
- 脚本优先读取当前 shell 环境变量，其次读取仓库根目录 `.dev.vars`
- 该 cookie 仅用于本地开发，不作为生产环境能力

## 6. Admin Smoke Note

本地管理页面与生产环境一样使用网站登录会话及 `admin_roles` 表。

- 先应用迁移，再为已验证的测试账号添加 `admin` 或 `owner` 角色。
- `/portal/admin` 及所有子页面在身份验证通过后才提供页面内容；API 另行检查每次请求。
- `ALLOW_LOCAL_ADMIN_BYPASS`、`x-admin-email` 和 Cloudflare Access 身份头均不再授予管理权限。
- 只有 `owner` 可以授予或撤销其他账号的 `admin` 权限；系统只允许一个 owner。
- 自动化权限测试使用真实 SQLite 迁移和签名会话，不依赖开发绕过开关。

## 7. Operational Notes

- 推荐在运行 `npm run dev` 前先执行 `npm run db:local:reset`
- 如本地 D1 状态与迁移不同步，优先重新执行 `npm run db:local:reset`
- 远程环境仍应继续使用 `wrangler d1 migrations apply --remote`

## 8. References

- [../../migrations/README.md](../../migrations/README.md)
- [../product/accounts/participant-account-system.md](../product/accounts/participant-account-system.md)
- Cloudflare D1 local development
  - https://developers.cloudflare.com/d1/
- Cloudflare Wrangler D1 migrations
  - https://developers.cloudflare.com/d1/wrangler-commands/
- Better Auth Email OTP
  - https://better-auth.com/docs/plugins/email-otp

## QQ OAuth 与可空联系邮箱

QQ 默认关闭；配置与验证范围见 [QQ OAuth 接入说明](qq-oauth.md)。新增迁移 0020 允许联系邮箱为空并保留历史数据。现有库升级需要先备份再应用迁移，不用 reset 代替升级；本轮验证使用独立 persist-to 路径，未改动日常开发数据。


### 邮箱验证注册（2026-10-11）

入口现为邮箱、验证码、密码三步。发码需要 Resend；无法投递时可继续使用本地 seed 会话浏览页面，但不能用无邮件验证的密码注册代替。历史未验证邮箱的会话不能访问作者业务接口，seed 会话应保持邮箱已验证。Wrangler 本地配置提供独立的认证 IP/邮箱限流绑定，注册、登录与密码重置共用每邮箱 60 秒一次的发码限制。

### 管理端快速排期

管理端“接力排期”页面的“快速排期”支持输入北京时间起点与分钟间隔，先预览再一次保存。例如 24 个标准格以 60 分钟间隔安排，只需填写一次起始时间。已有发布时间保持不变且仍占标准格序号，追加坑位不参与；有未保存的单格修改时需先保存。

客户端使用 `PATCH /api/admin/segments/:id` 的 `{ mode: "fill-empty-time", scheduledAt }` 模式。服务端只更新空白标准格的时间，不写说明、状态、认领人或认领／释放记录；原子检查空白时间与当前生效排期。出现并发填时间或保存失败时停止，已成功保存的结果保留，页面提示数量；重新生成预览即可继续。此功能随应用部署生效，不需要数据库迁移，也不会自动向 staging 写入数据。

邮件密码重置入口为 `/portal/login?reset=password`。本地也需要 Resend 配置；真实投递尚需人工验证。重置成功会撤销该账号所有会话，之后用新密码登录，不会删除报名或作品。
