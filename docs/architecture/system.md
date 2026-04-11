# Starward2026 Architecture

Last reviewed against official documentation: 2026-04-11

## 1. Scope

本文定义 Starward2026 的目标架构与核心技术边界。

术语说明：

- 对外中文术语使用 `时间段`
- 英文领域术语使用 `schedule segment`
- 相关迁移策略见 [time-segment-model.md](./time-segment-model.md)

目标能力如下：

1. 公共活动站点
2. 报名与审核流程
3. 参与者门户
4. 管理员后台
5. 后续公开归档页

## 2. Architecture Decision

目标技术栈如下：

- 前端：React + TypeScript + Vite
- API 运行时：Hono on Cloudflare Workers
- 数据库：Cloudflare D1
- 参与者认证：Better Auth + Email OTP + Cookie Session
- 反滥用：Cloudflare Turnstile + Workers Rate Limiting
- 管理后台保护：Cloudflare Access
- 文件存储：Cloudflare R2（仅在后续需要上传文件时启用）

## 3. High-Level System Design

系统采用单一 Cloudflare Worker 应用：

- React 提供公共页面、参与者页面与后台页面
- Hono 提供 `/api/*`
- Better Auth 提供 `/api/auth/*`
- D1 存储报名、参与者、时间段、资料与事件日志
- Turnstile 保护公开报名提交
- Cloudflare Access 保护 `/admin/*`

## 4. Request Flow

标准请求流如下：

1. 访客访问公共站点
2. 报名请求进入 `POST /api/applications`
3. 服务端执行校验、Turnstile 验证与限流
4. 审核通过后系统创建 `participant`
5. 参与者通过 `/portal/login` 建立会话
6. 门户通过 `/api/portal/*` 读取和修改数据
7. 管理员在 `/admin/*` 内执行审核与管理操作

## 5. Repository Layout

推荐结构如下：

```text
Starward2026/
├── docs/
├── migrations/
├── src/
│   ├── app/
│   ├── admin/
│   ├── portal/
│   ├── routes/
│   └── shared/
├── worker/
│   ├── app.ts
│   ├── index.ts
│   ├── data/
│   ├── lib/
│   └── routes/
├── package.json
├── vite.config.ts
└── wrangler.jsonc
```

## 6. Route Surfaces

### 6.1 Public

- `/`
- `/apply`
- `/apply/success`
- `/works`
- `/works/:slug`

### 6.2 Participant

- `/portal/login`
- `/portal`
- `/portal/schedule`
- `/portal/project`
- `/portal/history`

### 6.3 Admin

- `/admin`
- `/admin/applications`
- `/admin/participants`
- `/admin/schedule`
- `/admin/project-drafts`
- `/admin/settings/windows`

## 7. API Surfaces

### 7.1 Public API

- `GET /api/applications/intake`
- `POST /api/applications`
- `GET /api/works`
- `GET /api/works/:slug`

### 7.2 Auth API

- `GET /api/auth/*`
- `POST /api/auth/*`

### 7.3 Participant API

- `GET /api/portal/me`
- `GET /api/portal/dashboard`
- `GET /api/portal/segments/current`
- `GET /api/portal/segments/available`
- `POST /api/portal/segments/claim`
- `POST /api/portal/segments/change`
- `POST /api/portal/segments/release`
- `GET /api/portal/project`
- `PATCH /api/portal/project/preview`
- `POST /api/portal/project/preview/submit`
- `PATCH /api/portal/project/review`
- `POST /api/portal/project/review/submit`
- `GET /api/portal/history`

### 7.4 Admin API

- `GET /api/admin/applications`
- `GET /api/admin/applications/:id`
- `PATCH /api/admin/applications/:id`
- `GET /api/admin/participants`
- `GET /api/admin/participants/:id`
- `POST /api/admin/participants/:id/invite`
- `PATCH /api/admin/participants/:id`
- `GET /api/admin/segments`
- `POST /api/admin/segments/bootstrap`
- `PATCH /api/admin/segments/:id`
- `GET /api/admin/project-drafts`
- `GET /api/admin/project-drafts/:id`
- `PATCH /api/admin/project-drafts/:id`

## 8. Data Model

### 8.1 Auth Tables

由 Better Auth 管理：

- `user`
- `session`
- `account`
- `verification`

### 8.2 Domain Tables

由项目管理：

- `applications`
- `participants`
- `schedule_versions`
- `schedule_segments`
- `project_drafts`
- `event_windows`
- `participant_events`
- `works`
- `audit_log`（可选）

## 9. Identity Flow

身份流转如下：

1. 公开访客提交 `applications`
2. 管理员审核并创建 `participants`
3. 参与者通过受邀邮箱建立 Better Auth 会话
4. 门户业务数据统一挂载到 `participant`

## 10. Anti-Abuse Design

公开报名入口采用以下防护：

1. Turnstile
2. 服务端校验
3. 基础限流
4. 严格字段校验

参与者入口采用以下防护：

1. 受邀邮箱白名单
2. Email OTP
3. 必要时增加额外 OTP 发送保护

## 11. Schedule Atomicity

时间段认领、调整与释放操作必须在服务端完成，并遵守以下原则：

- 依赖 D1 事务与约束
- 返回明确的冲突状态
- 在必要时记录参与者事件

Durable Objects 不作为第一阶段默认依赖，仅作为后续并发升级选项。

## 12. Files and Uploads

第一阶段默认不在 D1 中存储文件内容。

如后续需要文件上传：

1. 使用 Worker 生成 R2 上传凭据
2. 浏览器直接上传到 R2
3. D1 仅存储元数据与对象键

## 13. Deployment Model

部署模型如下：

- 单一代码仓库
- 单一 Workers 应用
- Wrangler 管理 D1、Turnstile、Rate Limiting、R2 绑定

## 14. Future Extensions

以下能力保留为后续选项：

- 公共归档页预渲染或 SSR
- R2 文件上传
- 定时提醒邮件
- 签名编辑链接
- 更强的并发协调机制

## 15. Official References

- Cloudflare React + Vite guide
  - https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Cloudflare Vite plugin
  - https://developers.cloudflare.com/workers/vite-plugin/
- Hono on Cloudflare Workers
  - https://hono.dev/docs/getting-started/cloudflare-workers
- Better Auth installation
  - https://better-auth.com/docs/installation
- Better Auth Hono integration
  - https://better-auth.com/docs/integrations/hono
- Better Auth Email OTP
  - https://better-auth.com/docs/plugins/email-otp
- Cloudflare D1 Worker API
  - https://developers.cloudflare.com/d1/worker-api/d1-database/
- Cloudflare D1 migrations
  - https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare Turnstile server-side validation
  - https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare Workers Rate Limiting binding
  - https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Cloudflare Access application paths
  - https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
