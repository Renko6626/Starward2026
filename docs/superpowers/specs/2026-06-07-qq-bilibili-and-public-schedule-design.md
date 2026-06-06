# 设计:QQ/B站资料 + 进群核验 + 公开只读时间表

Date: 2026-06-07
Status: Approved (brainstorming) — 待写实现计划
Branch: dev

## 1. 背景与目标

Starward2026 是东方同人接力创作活动站(报名管理 / 时间表 / 展示)。本次新增两件相互独立但同期交付的能力:

- **特性 A — 参与者社交资料与进群核验**:活动协调发生在 QQ 群,作品以创作者名义公开发布,因此需要收集 QQ(进群协调 + 硬门槛)与 B站(防冒名核验),并把"进群 + 身份核验"并入现有的报名审核。
- **特性 B — 公开只读时间表**:访客与未激活用户可随时查看时间表(谁在哪个时段),但不能认领。同时服务"展示"目标。

不改变现有技术路线(React + Hono/Cloudflare Workers + D1 + Better Auth 邮箱 OTP)。沿用现有"登录→分步补资料→审核→approved 才能认领时段"的流程,只在其中增补。

QQ 群 LLM 机器人是**独立子系统**,不在本 spec 范围(见 §7)。

## 2. 关键决策(已确认)

| 决策 | 结论 |
|------|------|
| 登录方式 | 邮箱 OTP 不变 |
| 新字段位置 | `portal_profiles`(资料层,报名前置) |
| QQ | **必填**(纯数字) |
| B站 | **选填**(主页链接) |
| B站核验 | 纯人工目视(管理员审核时点开看),系统不做校验码/OAuth |
| 进群门槛 | **并入审核**:`approved` = 已核身份 + 已进群;不另建"已进群"状态机 |
| 新信息可见位置 | 报名详情页 + 参与者详情页;名册列表加 QQ 列 |
| 群号等 | 管理员可配置(不硬编码) |
| 公开时间表占用展示 | 方案 C:署名 + 作品形式 + (仅已审核的)预告信息 |
| 公开时间表隐私 | 永不输出 QQ/邮箱/联系方式;匿名者显示"匿名";未审核预告不公开 |

## 3. 特性 A — QQ/B站资料与进群核验

### 3.1 数据模型
新增一条 D1 迁移(`migrations/00NN_profile_social_fields.sql`),`portal_profiles` 增列:
- `qq_number TEXT NOT NULL`(应用层校验:纯数字,合理长度 5–11)
- `bilibili_url TEXT`(可空;应用层校验:`space.bilibili.com/...`、`b23.tv/...`、`bilibili.com/...` 之一)

新增"事件设置"存储(用于群号等可配置项),最小化方案:键值表
`event_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`,初始键:
- `qq_group_number`、`qq_group_join_answer_hint`、(可选)`qq_group_qr_url`

> 迁移规范见 `migrations/README.md`;本地用 `npm run db:local:reset` 重建。

### 3.2 共享 schema 与前端表单
- `src/shared`(profile schema)增加 `qqNumber`(必填)、`bilibiliUrl`(选填)及校验。
- `/portal/profile` 表单增两项;"资料完整"判定纳入 `qqNumber` 必填(`bilibiliUrl` 不计入必填)。资料完整仍是报名(application)的前置(不变)。

### 3.3 待审引导(门户)
- 在 `/portal` 待审状态区新增引导卡:展示 `qq_group_number`(+ 可选二维码)与 `qq_group_join_answer_hint`(提示进群时填报名邮箱/笔名,便于群内比对),并说明"进群并经主催确认身份后开放时段认领"。
- 数据来源:在现有 `GET /api/portal/dashboard` 响应中带上这几项事件设置(读 `event_settings`),前端只渲染。

### 3.4 后台
- `/admin/applications/:id` 审核区与 `/admin/participants/:id` 详情页:显著展示 QQ 号、B站链接(可点开);审核区加清单提示"已确认进群?B站为本人?"。
- `/admin/participants`(名册)增加 QQ 列。
- 管理员设置:新增可编辑的事件设置入口(QQ 群号 / 进群答案提示 / 二维码 URL)。落点二选一(实现时定):并入现有 `/admin/settings/*` 区,或新增 `/admin/settings/general`。配套 `GET/PATCH /api/admin/settings`(读写 `event_settings`)。
- **审核语义不变**:管理员据上述信息决定通过;`approved` 即代表已核身份 + 已进群。无新增状态/门槛逻辑——复用现有"approved 才能认领时段"的闸。

## 4. 特性 B — 公开只读时间表

### 4.1 公开页
- 新增公开路由 `/schedule`(公共站点壳 `PrototypeShell`,首页/导航入口),访客与任意登录态可见。
- **纯只读**:无认领/变更/释放按钮。访客显示"创作者入口"CTA;已登录但未 approved 显示"通过审核后可在门户认领"。
- 不做实时刷新、不做筛选/搜索(YAGNI)。

### 4.2 公开接口 `GET /api/schedule`
返回当前生效排期的时段列表,每段:
- 始终:编号、名称、时段时间、占用状态(可认领/已认领/锁定/完成)。
- 仅当**已认领**时附:
  - 公开署名:依持有者 `public_credit_mode`——实名/笔名如实显示;`anonymous` 显示"匿名"。
  - 作品形式(format)。
  - 预告标题 / 标签 / 公开作者名:**仅当该草稿 `preview_status === 'approved'`** 时输出;否则不含这些字段。

### 4.3 隐私红线(实现必须遵守 + 测试覆盖)
- 永不输出:`qq_number`、`bilibili_url`、`contact_email`、联系账号、备用联系、`invite_email`、`user_id`。
- 匿名者仅"匿名";未审核(非 approved)的预告内容一律不进入公开响应。
- 公开接口无鉴权,但其 SQL/映射必须**只选取**白名单字段(在 `worker/data` 层用专门的 public 查询,不复用含隐私列的查询)。

### 4.4 现状保留
- `/portal/schedule`(approved 才能操作)原样保留,作为可操作版。

## 5. 分层落点(遵循现有架构)

- 迁移:`migrations/`
- 数据访问:`worker/data/`(新增 `event_settings` 读写;公开时间表的 public 专用查询;profile 增列读写)
- 路由:`worker/routes/public.ts`(`GET /api/schedule`)、`worker/routes/admin.ts`(`GET/PATCH /api/admin/settings`)、`worker/routes/portal.ts`(dashboard 带群信息)
- 共享:`src/shared`(profile schema 增字段;public schedule 响应类型)
- 前端:`src/app/pages`(新 `SchedulePage` 公开页)、`src/portal/pages`(profile 表单、overview 引导卡)、`src/admin/pages`(应用/参与者详情、名册列、设置入口)
- 路由生成:在 `src/routes` 加 `/schedule` 文件路由(TanStack 自动生成,勿手改 `routeTree.gen.ts`)

## 6. 测试(TDD,node:sqlite 假 D1 harness)

- `portal_profiles` 增列读写 + profile 校验(qq 必填、bilibili 选填且格式)。
- `event_settings` 读写;dashboard 带出群信息。
- **公开时间表隐私测试(重点)**:构造含联系/隐私列的数据,断言 `GET /api/schedule` 的映射结果**不含**任何隐私字段;匿名持有者显示"匿名";`preview_status !== 'approved'` 时不含预告内容;已审核时包含。
- 审核流不回归(approved 仍是认领时段的唯一闸)。

## 7. 非目标 / YAGNI

- 不改登录方式;不做 B站校验码/OAuth;不引入"已进群"独立状态机。
- 公开页不做实时/筛选/搜索。
- **QQ 群 LLM 机器人不在本 spec**。它是独立子系统(独立 Python/NoneBot 服务 + 独立鉴权 + 独立部署),将单独出 spec。届时核心是:一条**窄权限只读 Bot API**(用提问者 QQ 反查**本人**状态,不可改、不可查他人隐私),**不得给机器人完整管理员权限**(LLM 读群消息=不可信输入,过权 + 提示注入风险)。本次新增的 `qq_number` 字段正是机器人映射 QQ→参与者的基础。

## 8. 关联

- 现状盘点:[../../product/feature-map.md](../../product/feature-map.md)
- 架构:[../../architecture/system.md](../../architecture/system.md)
- 时间段模型:[../../architecture/time-segment-model.md](../../architecture/time-segment-model.md)
- 账号体系:[../../product/accounts/participant-account-system.md](../../product/accounts/participant-account-system.md)
