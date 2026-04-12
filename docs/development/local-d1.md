# Local D1 Development

## 1. Purpose

本文定义 Starward2026 的本地 D1 重建与示例数据流程。

目标如下：

- 让本地 `vite` 开发环境始终拥有完整 schema
- 为后台审核页提供稳定的示例数据
- 为参与者门户提供可直接复用的本地会话样本
- 避免继续依赖手工 SQL 插入做 smoke

## 2. Commands

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

## 3. Seed Coverage

本地 seed 默认覆盖以下样本：

- 一个已建立入口账号、已补联系资料、但仍处于待审核状态的门户样本
- 一个已审核通过、已激活、已持有时间段、已存在资料补录草稿的参与者样本
- 一组开放窗口状态
- 一组本地样本时间段
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

本地管理员接口仍沿用现有 localhost bypass 规则：

- `/api/admin/*` 在 localhost 环境下接受 `x-admin-email`

因此：

- 数据问题由本地 seed 解决
- 身份问题仍由本地 admin bypass 解决

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
