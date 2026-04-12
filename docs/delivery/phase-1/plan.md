# Starward2026 Phase-1 Delivery Plan

Last updated: 2026-04-12

## 1. Purpose

本文将 [scope.md](./scope.md) 转换为可执行的交付计划。

术语说明：

- 对外中文术语使用 `时间段`
- 英文领域术语使用 `schedule segment`
- 迁移方案见 [time-segment-model.md](../../architecture/time-segment-model.md)

## 2. Delivery Position

第一阶段的交付目标是建立可运行的活动运营链路，而不是完成最终公开归档。

交付目标：

- 公共访客能够理解活动状态与入口
- 管理员能够审核报名并维护参与者状态
- 访客能够通过邮箱验证码建立入口会话
- 已登录用户能够补充资料并等待审核

## 3. Planning Constraints

交付计划基于以下约束：

- 前端与 API 统一使用 TypeScript
- Cloudflare Workers 是唯一后端运行时
- D1 是唯一关系型数据存储
- 管理员身份继续由 Cloudflare Access 保护
- 参与者认证继续采用 Better Auth Email OTP

## 4. Route Matrix

### 4.1 Public Routes

| 路由 | 交付级别 | 说明 |
|------|----------|------|
| `/` | 必做 | 开始页、阶段说明、入口汇总 |
| `/apply` | 必做 | 报名规则说明与入口引导页 |
| `/apply/success` | 必做 | 正式报名提交成功说明页 |
| `/works` | 延期 | 公开归档阶段实现 |
| `/works/:slug` | 延期 | 公开归档阶段实现 |

### 4.2 Participant Routes

| 路由 | 交付级别 | 说明 |
|------|----------|------|
| `/portal/login` | 必做 | 邮箱验证码入口 |
| `/portal` | 必做 | 已登录总览与状态页 |
| `/portal/profile` | 必做 | 联系资料与公开署名设置 |
| `/portal/application` | 必做 | 报名资料与审核状态页 |
| `/portal/schedule` | 后续 | 已批准参与者的时间段操作页 |
| `/portal/project` | 后续 | 已批准参与者的资料补录页 |
| `/portal/history` | 后续 | 历史记录页 |

### 4.3 Admin Routes

| 路由 | 交付级别 | 说明 |
|------|----------|------|
| `/admin` | 必做 | 后台总览 |
| `/admin/applications` | 必做 | 报名列表 |
| `/admin/applications/:id` | 必做 | 报名详情与审核 |
| `/admin/participants` | 必做 | 参与者列表 |
| `/admin/schedule` | 必做 | 时间段管理 |
| `/admin/settings/windows` | 可选 | 开放窗口配置 |
| `/admin/project-drafts` | 可选 | 资料审核 |

## 5. API Cut

### 5.1 Public APIs

- `GET /api/applications/intake`
- `POST /api/applications`（返回 `410`，用于阻断旧的公开正式报名入口）

### 5.2 Auth APIs

- `GET /api/auth/*`
- `POST /api/auth/*`

### 5.3 Participant APIs

- `GET /api/portal/dashboard`
- `GET /api/portal/me`
- `GET /api/portal/profile`
- `PATCH /api/portal/profile`
- `GET /api/portal/application`
- `POST /api/portal/application`
- `PATCH /api/portal/application`
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

### 5.4 Admin APIs

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
- `GET /api/admin/settings/windows`
- `PATCH /api/admin/settings/windows/:key`

## 6. Migration Order

### 6.1 Required Migrations

第一阶段所需迁移顺序如下：

1. `0001_auth_base.sql`
2. `0002_applications.sql`
3. `0003_participants.sql`
4. `0004_schedule_model.sql`
5. `0005_event_windows.sql`
6. `0006_project_drafts.sql`
7. `0007_participant_events.sql`
8. `0008_indexes_and_constraints.sql`

### 6.2 Constraint Priorities

约束优先级如下：

- 认证层基础表优先
- 报名与参与者身份优先
- 时间段唯一性与持有约束优先
- 事件日志与资料补录可随后补齐

## 7. Milestones

### Milestone 0: Project Skeleton

目标：

- 清理旧脚手架残留
- 稳定 React + Hono + D1 基础结构
- 确认路由生成与构建流程

### Milestone 1: Admin Gate and Shell

目标：

- 接入 Cloudflare Access 保护 `/admin/*`
- 对 `/api/admin/*` 执行 Cloudflare Access JWT fail-closed 校验
- 完成后台导航与基础页面外壳

### Milestone 2: Application Review Flow

目标：

- 完成后台报名列表与详情页
- 支持审核状态更新
- 建立“正式报名必须绑定参与者入口账号”的审核边界

### Milestone 3: Participant Auth Bootstrap

目标：

- 建立邮箱验证码入口与长期会话
- 完成 `/portal/login` 与 `/portal`
- 支持未审核账号进入待审核状态页

### Milestone 4: Profile and Application Flow

目标：

- 建立联系资料与公开署名模型
- 完成 `/portal/profile` 与 `/portal/application`
- 支持账号内正式报名与后台审核联动

### Milestone 5: Schedule Workflow

目标：

- 完成时间段列表与认领逻辑
- 完成窗口控制与冲突处理

### Milestone 6: Project Draft Workflow

目标：

- 建立资料补录接口
- 支持预告与审查状态更新

### Milestone 7: Public Start Page

目标：

- 完成首页内容模块
- 展示阶段信息与入口

### Milestone 8: Apply Guidance Polishing

目标：

- 完成报名说明页与成功页的交互完善
- 明确公共说明页与参与者入口之间的引导关系

## 8. Verification

### 8.1 Functional Verification

第一阶段结束前需要完成以下验证：

- 账号内报名提交流程可用
- 审核流可用
- 入口建号与继续登录流可用
- 待审核与已批准权限边界可用
- 时间段冲突处理可用
- 开放窗口控制可用

### 8.2 Anti-Abuse Verification

需要验证以下边界：

- OTP 发送限流生效
- 报名接口的资料完整度与字段校验生效
- OTP 接口在必要时可增加额外保护

### 8.3 Build Verification

交付前至少执行：

- `npm run check`
- `npm test`
- `npm run build`

## 9. Repository Notes

### 9.1 Public and Operational Concerns Stay Separate

公开站点、参与者入口和后台系统可以共享同一仓库，但需要保持以下边界：

- 页面路由分离
- API 路由分离
- 认证边界分离
- 文档范围分离

### 9.2 Do Not Reintroduce the Old Scaffold

旧的 Vue + FastAPI 模板不再作为扩展基础。后续实现统一围绕当前 React + Hono 结构推进。

## 10. References

- [scope.md](./scope.md)
- [system.md](../../architecture/system.md)
- [participant-account-system.md](../../product/accounts/participant-account-system.md)
- [data-api.md](../../product/portal/data-api.md)
- [time-segment-model.md](../../architecture/time-segment-model.md)
