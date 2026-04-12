# Starward2026 Phase-1 Scope

Last updated: 2026-04-11

## 1. Purpose

本文定义 Starward2026 第一阶段的产品范围。

术语说明：

- 对外中文术语使用 `时间段`
- 英文领域术语使用 `schedule segment`
- 相关迁移策略见 [time-segment-model.md](../../architecture/time-segment-model.md)

本文关注以下问题：

1. 第一阶段的最小可上线范围
2. 公共页面、参与者入口与后台系统的优先级
3. 明确延期的功能边界

## 2. Scope Decision

第一阶段定义为 `运营启动版`。该阶段用于验证活动能否通过系统稳定运行，不以完整公开归档为目标。

第一阶段包含：

- 具有阶段信息的公共开始页
- 可用的报名说明页、入口引导与提交结果页
- 可用的管理员后台
- 参与者入口的基础能力

第一阶段不包含：

- 完整作品归档
- 单件作品详情页
- 社区化功能
- 重型内容管理系统

## 3. Rationale

### 3.1 Workflow Is the Primary Risk

当前阶段的关键风险集中在以下流程：

- 报名审核
- 参与者身份建立
- 时间段认领与调整
- 资料补录

这些问题属于运营流程与状态流问题，优先级高于公开展示页。

### 3.2 Official Guidance Supports a Lightweight Build

当前技术与产品边界符合以下条件：

- Better Auth 支持挂载在 Hono 的 `/api/auth/*`
- Email OTP 可用于开放注册、审核放行的参与者入口
- Cloudflare Access 可按路径保护 `/admin/*`
- D1 可满足当前规模下的事务写入与约束校验

### 3.3 Scope Must Remain Operational

第一阶段的成功标准是：

- 管理员能够推进活动流程
- 参与者能够进入系统并完成基础操作
- 公共访客能够理解活动状态与入口

## 4. Public Surface

### 4.1 Required Public Routes

| 路由 | 状态 | 说明 |
|------|------|------|
| `/` | 必做 | 活动开始页、阶段说明、入口汇总 |
| `/apply` | 必做 | 报名规则说明与参与者入口引导 |
| `/apply/success` | 必做 | 账号内提交正式报名后的结果说明与后续提示 |

### 4.2 Public Page Responsibilities

首页必须提供以下信息：

- 活动名称与说明
- 当前阶段
- 当前开放入口
- 联系方式或联系指引

`/apply` 必须提供以下信息：

- 报名规则
- 正式报名仅在参与者入口内提交的边界
- 登录与补资料顺序
- 提交后的审核预期

### 4.3 Deferred Public Routes

以下公开页面延期到后续阶段：

| 路由 | 状态 | 说明 |
|------|------|------|
| `/works` | 延期 | 作品归档列表 |
| `/works/:slug` | 延期 | 单件作品详情页 |
| `/about` | 可选 | 在当前阶段可并入首页 |

## 5. Admin Surface

### 5.1 Required Admin Routes

| 路由 | 状态 | 说明 |
|------|------|------|
| `/admin` | 必做 | 后台总览 |
| `/admin/applications` | 必做 | 报名列表 |
| `/admin/applications/:id` | 必做 | 报名详情与审核 |
| `/admin/participants` | 必做 | 参与者列表 |
| `/admin/schedule` | 必做 | 时间段管理 |
| `/admin/project-drafts` | 可选 | 资料审核 |
| `/admin/settings/windows` | 可选 | 开放窗口配置 |

### 5.2 Required Admin Capabilities

后台至少需要覆盖以下能力：

- 审核报名
- 将报名转入参与者记录
- 发送或重发参与者入口邮件
- 查看和调整时间段状态
- 管理开放窗口

### 5.3 Admin Authentication

管理员后台继续采用 Cloudflare Access 保护，不引入单独的后台账号体系。

## 6. Participant Surface

### 6.1 Phase-1 Position

参与者入口属于第一阶段范围。原因如下：

- 参与者需要多次返回系统
- 时间段与资料补录需要稳定身份
- 管理员后台需要与参与者状态模型共享同一套数据边界

### 6.2 Required Participant Routes

| 路由 | 状态 | 说明 |
|------|------|------|
| `/portal/login` | 必做 | 邮箱验证码入口 |
| `/portal` | 必做 | 已登录总览与状态页 |
| `/portal/profile` | 必做 | 联系资料与公开署名设置 |
| `/portal/application` | 必做 | 报名资料与审核状态页 |

### 6.3 Follow-Up Participant Routes

以下页面可在基础入口稳定后继续完善：

| 路由 | 状态 | 说明 |
|------|------|------|
| `/portal/schedule` | 后续 | 时间段认领与调整 |
| `/portal/project` | 后续 | 资料补录 |
| `/portal/history` | 后续 | 历史记录 |

### 6.4 Required Participant Capabilities

第一阶段的最低要求如下：

- 访客能够通过邮箱验证码建立会话
- 已登录用户能够补充笔名、SNS 与联系资料
- 已登录用户能够查看并维护报名资料
- 已批准和未批准状态具有明确的服务端权限边界
- 系统能够作为后续时间段与资料页的稳定入口

## 7. Data and Control Boundaries

第一阶段继续采用以下数据边界：

- `applications` 记录报名
- `participants` 记录参与者业务身份
- Better Auth `user/session/account/verification` 记录认证状态
- `event_windows` 控制动作开放窗口

控制原则如下：

- 是否允许提交由服务端判定
- 时间段冲突由服务端处理
- 前端不推导最终业务状态

## 8. Explicit Deferrals

以下功能明确不属于第一阶段：

- 公开作品列表
- 单件作品详情页
- 复杂筛选与搜索
- 社交化能力
- 上传系统
- 多角色协作平台能力

## 9. Delivery Order

推荐交付顺序如下：

1. 项目骨架与基础路由
2. 管理员后台入口与审核流
3. 参与者登录入口与基础门户
4. 公共开始页
5. 报名说明页与成功页
6. 时间段与资料补录工作台

## 10. References

- [system.md](../../architecture/system.md)
- [plan.md](./plan.md)
- [participant-account-system.md](../../product/accounts/participant-account-system.md)
- [skeleton.md](../../product/portal/skeleton.md)
- [data-api.md](../../product/portal/data-api.md)
