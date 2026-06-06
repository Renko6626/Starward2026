# Starward2026 功能与页面地图（as-built）

Last updated: 2026-06-07

## 1. Purpose

本文记录**当前已实现**的页面与功能现状，作为 `docs/product/*/skeleton.md`（产品设计意图）与代码之间的对照视图。skeleton 描述"应该是什么"，本文描述"现在是什么"，含已知缺口。

术语沿用项目约定：对外用 `时间段`，领域术语用 `schedule segment`。

## 2. 三大界面总览

应用是单一 Cloudflare Worker，前端为 React + TanStack Router，分三个界面域：

| 界面域 | 路由前缀 | 鉴权方式 | 受众 |
|--------|----------|----------|------|
| 公开站点 | `/`, `/apply*` | 无 | 所有访客 |
| 参与者门户 | `/portal*` | Better Auth 邮箱 OTP 会话（cookie） | 已登录创作者/参与者 |
| 管理后台 | `/admin*` | Cloudflare Access（Worker 复验 JWT） | 主催/管理员 |

公共导航壳为 `src/app/layouts/PrototypeShell.tsx`：顶栏含「首页 / 报名须知 / 创作者入口」，「管理后台」入口仅在 `/admin*` 路径下出现。`/portal` 与 `/admin` 目前都只是 `<Outlet/>`，没有共享侧边栏，页面间靠各页 `<Link>` 与重定向串联。

## 3. 访问权限层级（关键横切逻辑）

服务端（`worker/routes/portal.ts`）把门户访问分成三档，前端页面只做兜底重定向，真正裁决在服务端：

| 层级 | 解析器 | 要求 | 覆盖的接口 |
|------|--------|------|------------|
| 会话级 | `getPortalSessionAccess` | 任意已登录会话 | me / dashboard / profile / application |
| 参与者动作级 | `getParticipantActionAccess` → `resolveParticipantActionEligibility` | participant 必须 `approved` | segments / history |
| 作品工作区级 | `getProjectWorkspaceAccess` → `resolveProjectWorkspaceEligibility` | participant 必须 `approved` | project（预告/审查） |

未达标时的服务端响应：`pending` → 403 `portal_pending_review`；`withdrawn` → 403 `portal_participant_withdrawn`；participant 缺失 → 403 `portal_creator_missing`。

此外**事件窗口**（见 §7）叠加在动作之上：即使是已批准参与者，相应窗口未开时对应的提交/认领/变更动作也会被服务端拒绝、前端按钮置灰。

## 4. 公开站点页面

| 路由 | 组件 | 功能 |
|------|------|------|
| `/` | `HomePage.tsx` | 活动落地页，介绍接力创作活动，CTA 导向报名须知 / 创作者入口 |
| `/apply` | `ApplyPage.tsx` | 报名规则说明 + 报名窗口状态 |
| `/apply/success` | `ApplySuccessPage.tsx` | 报名提交成功的说明页 |

- **`/`** — 纯静态，无 API 调用。两个 CTA：「报名须知」→ `/apply`、「创作者入口」→ `/portal/login`。文案提及作品公开展示"将在发布阶段开放"（该功能尚未实现）。
- **`/apply`** — 拉 `GET /api/applications/intake` 仅用于显示 `application_open` 窗口的开/关状态。**已不承担提交职责**：正式报名统一收口到门户内。CTA 按登录态分流（已登录 → `/portal/application`，未登录 → `/portal/login`）。注意：intake 返回的 `turnstileEnabled` 在此页未使用，此页不渲染 Turnstile。
- **`/apply/success`** — 纯静态确认页。由于公开提交已下线，正常流程不会自动跳到这里，目前仅可直达 URL 抵达（见 §9）。

后端公开接口（`worker/routes/public.ts`）：`GET /api/health`、`GET /api/applications/intake`、`POST /api/applications`（**固定返回 410** `formal_application_moved`，阻断旧的公开报名入口）。

## 5. 参与者门户页面

| 路由 | 组件 | 功能 | 最低权限 |
|------|------|------|----------|
| `/portal/login` | `PortalLoginPage.tsx` | 邮箱 OTP 登录（无密码） | 公开 |
| `/portal` | `PortalOverviewPage.tsx` | 工作台总览：状态、待办、近期事件 | 会话 |
| `/portal/profile` | `PortalProfilePage.tsx` | 联系资料 + 公开署名设置 | 会话 |
| `/portal/application` | `PortalApplicationPage.tsx` | 创建/修改正式报名 | 会话 |
| `/portal/schedule` | `PortalSchedulePage.tsx` | 认领/变更/释放时间段 | **approved** |
| `/portal/project` | `PortalProjectPage.tsx` | 预告（公开）+ 审查（主催可见）双轨提交 | **approved** |
| `/portal/history` | `PortalHistoryPage.tsx` | 只读个人操作历史 | **approved** |

通用模式：每页 `authClient.useSession()`，无会话 → 跳 `/portal/login`；API 经 `requestJson`（`src/app/lib/api.ts`），遇 401 跳登录。`/portal/login` 故意放在 `portal_/` 段，位于 `/portal` outlet 之外，便于将来给 `/portal` 加守卫而不误伤登录页。

- **`/portal/login`** — 两步：输入邮箱「获取访问码」（`authClient.emailOtp.sendVerificationOtp`）→ 输入 6 位码「验证并进入」（`authClient.signIn.emailOtp`）。带重发冷却计时；已有会话则读 `GET /api/portal/me` 并按 `resolvePortalEntryDestination` 自动分流（无 profile→profile；有 profile 无 application→application；participant `pending`→project；否则→`/portal`）。
- **`/portal`** — `GET /api/portal/dashboard`。按 `isApprovedParticipant` 切换待办：已批准看「确认接力时段 / 提交接力稿件」；未批准看「完善报名信息 / 填写正式报名 / 提前整理作品资料」。用 `buildWindowFlagMap` 标记"紧急"待办。链接到 profile/application/schedule/project（**不**链接 history）。
- **`/portal/profile`** — `GET` + `PATCH /api/portal/profile`。字段：笔名、联系邮箱、主联系渠道/账号、备用联系、公开署名模式（实名/笔名/匿名）。是报名的前置步骤。
- **`/portal/application`** — `GET /api/applications/intake`（取 `turnstileEnabled`）+ `GET /api/portal/application`。按 `editState` 决定 `POST`（create）或 `PATCH`（update）。提交需 `editable`（服务端窗口/状态）且 `profileReady`（须先填资料，否则服务端 409 `portal_profile_required`）。create 成功后跳 `/apply/success`。**Turnstile**：仅当 `turnstileEnabled && siteKey` 时渲染，token 必填且单次使用，服务端经 `enforceApplicationSubmissionGuards` 复验。已批准的报名在门户内只读。
- **`/portal/schedule`** — 并行 `GET segments/current` + `GET segments/available`。动作：`POST segments/claim`（无当前段时）/ `segments/change`（已持有时）/ `segments/release`。按钮按服务端 `actions` 标志 + 窗口标志（`segmentClaimOpen`/`segmentChangeOpen`）启停。需 approved，pending 用户进来会得到错误态。
- **`/portal/project`** — `GET /api/portal/project`（无草稿返回 404 `project_draft_missing`，草稿在报名批准时自动创建）。双轨：预告 `PATCH preview` / `POST preview/submit`；审查 `PATCH review` / `POST review/submit`。保存草稿始终允许；提交受 `previewSubmitOpen`/`reviewSubmitOpen` 窗口限制。显示管理员反馈 `adminFeedback`。需 approved。
- **`/portal/history`** — `GET /api/portal/history`，只读时间线。需 approved。

## 6. 管理后台页面

管理页本身无客户端鉴权门，全部由服务端 `adminApi.use("*", requireAdminAccess)` 拦截：验证 Cloudflare Access 的 `cf-access-jwt-assertion` JWT，提取管理员邮箱写入 `adminIdentity`（用于标记每次操作的执行者）。本地有 `x-admin-email` 旁路，仅当 `ALLOW_LOCAL_ADMIN_BYPASS=true` 且 loopback 主机时生效。

| 路由 | 组件 | 功能 |
|------|------|------|
| `/admin` | `AdminOverviewPage.tsx` | 总览：统计卡 + 快捷入口 + 近期动态 |
| `/admin/applications` | `AdminApplicationsPage.tsx` | 报名审核队列（过滤/搜索） |
| `/admin/applications/:applicationId` | `AdminApplicationDetailPage.tsx` | 报名详情 + 审核决定 + 通过邮件 |
| `/admin/participants` | `AdminParticipantsPage.tsx` | 参与者名册 |
| `/admin/participants/:participantId` | `AdminParticipantDetailPage.tsx` | 编辑参与者资料/状态 + 补发邮件 |
| `/admin/schedule` | `AdminSchedulePage.tsx` | 时间段初始化与逐段修正/指派 |
| `/admin/project-drafts` | `AdminProjectDraftsPage.tsx` | 作品草稿总览 |
| `/admin/project-drafts/:draftId` | `AdminProjectDraftDetailPage.tsx` | 单篇草稿审核（预告/审查状态 + 反馈） |
| `/admin/settings/windows` | `AdminEventWindowsPage.tsx` | 事件窗口开关与时间设置 |

- **`/admin`** — 并行拉 applications/participants/project-drafts/segments，派生三张统计卡（已确认创作者数、排班完成度、提交进度）+ 待审报名数 + 活动动态。只读。（三条状态横幅与"更新时间"为装饰性/渲染时刻，非真实数据。）
- **`/admin/applications`** — `GET /api/admin/applications`，客户端过滤标签（all/pending/needs-entry/needs-profile/converted，默认 pending）+ 搜索（`src/admin/lib/application-list.ts`）。
- **`/admin/applications/:id`** — `GET` 详情。`PATCH /api/admin/applications/:id`（approve/reject/withdraw，可选 adminNote；可用转换排除当前状态，见 `application-review.ts`），响应可含审批邮件发送结果。另有 `POST /api/admin/participants/:participantId/invite` 补发通过邮件（仅在已关联 participant 且状态合格时）。备注模板见 `review-note.ts`（仅填充文本框，不自动提交）。
- **`/admin/participants`** — `GET /api/admin/participants`，搜索 + 三张指标卡。
- **`/admin/participants/:id`** — `GET` 详情；`PATCH /api/admin/participants/:id`（displayName/contactHandle/status）；`POST .../invite` 发通过邮件（须 approved/completed）。资格状态与门户激活解耦。
- **`/admin/schedule`** — 并行 `GET segments` + `GET participants`。`POST segments/bootstrap`（仅零段时出现，count 1–120）；`PATCH segments/:id`（description/status/currentParticipantId，仅 `held` 时可选参与者）。重新指派会自动释放该参与者原持段并同步 `project_drafts.segment_id`。
- **`/admin/project-drafts`** + **`/:draftId`** — 列表 `GET project-drafts`；详情 `GET /:id` + `PATCH /:id`（previewStatus/reviewStatus/adminFeedback），反馈回写供门户读取。
- **`/admin/settings/windows`** — `GET /api/admin/event-windows`；`PATCH /api/admin/event-windows/:key`（isEnabled/opensAt/closesAt，浏览器本地时间转 ISO）。

## 7. 事件窗口（event windows）

服务端用六个窗口键（`src/shared/windows.ts`）控制各动作的开放时段，由 `/admin/settings/windows` 维护：

| 键 | 作用 |
|----|------|
| `application_open` | 正式报名创建/修改是否开放 |
| `segment_claim_open` | 时间段认领是否开放 |
| `segment_change_open` | 时间段变更/释放是否开放 |
| `preview_submit_open` | 作品预告提交是否开放 |
| `review_submit_open` | 作品审查提交是否开放 |
| `public_release_open` | 公开发布阶段（归档页，尚未实现） |

服务端为"开/关"的权威判定方；前端仅据此置灰按钮与提示文案。

## 8. 接口 ↔ 页面映射（速查）

公开：`GET /api/applications/intake` → `/apply`、`/portal/application`。
门户（`/api/portal/*`）：`me`→登录分流；`dashboard`→`/portal`；`profile`(GET/PATCH)→profile；`application`(GET/POST/PATCH)→application；`segments/current|available|claim|change|release`→schedule；`project`+`project/preview|review[/submit]`→project；`history`→history。
管理（`/api/admin/*`）：`applications[/:id]`→总览/队列/详情；`participants[/:id][/invite]`→名册/详情/详情；`segments[/bootstrap][/:id]`→总览/排班；`project-drafts[/:id]`→总览/库/详情；`event-windows[/:key]`→窗口设置。

每个 admin GET/POST/PATCH 都有对应页面消费，无悬空接口。

## 9. 已知缺口与观察

实现盘点中发现的、值得后续处理的点：

1. **作品公开归档未实现** — `/works`、`/works/:slug` 在架构文档里列为目标，但**无路由、无页面**；首页文案提及"发布阶段开放"。属 phase-1 之后范围。
2. **`/portal/history` 无入口** — 没有任何页面链接到历史页，目前只能直达 URL。建议在总览或作品页加入口。
3. **pending 用户的待办指向会 403** — `/portal` 给未批准用户的"提前整理作品资料"待办指向 `/portal/project`，但该页要求 approved，pending 点进去会得到 403 错误态。需调整待办或放宽该页对 pending 的只读访问。
4. **`/apply/success` 形同孤儿** — 公开提交下线后，正常流程不再自动跳转至此（门户内 create 成功仍会跳）；公开侧仅可直达。
5. **总览页装饰元素** — `/admin` 的三条状态横幅与"更新时间"是硬编码/渲染时刻，非真实数据。

## 10. 关联文档

- 架构：[../architecture/system.md](../architecture/system.md)
- 交付范围与计划：[../delivery/phase-1/scope.md](../delivery/phase-1/scope.md)、[../delivery/phase-1/plan.md](../delivery/phase-1/plan.md)
- 产品骨架（设计意图）：[portal/skeleton.md](./portal/skeleton.md)、[site/skeleton.md](./site/skeleton.md)、[accounts/participant-account-system.md](./accounts/participant-account-system.md)
- 门户数据接口：[portal/data-api.md](./portal/data-api.md)
- 设计稿：[../design/](../design/)
