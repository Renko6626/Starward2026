# Starward2026 Participant Account System PRD

Last updated: 2026-04-12

## 1. Purpose

本文定义 Starward2026 面向外部用户的账号系统。

本文中的“账号系统”指参与者入口、资料补充、报名审核、参与资格放行与会话管理的整体设计，不等同于开放社区平台。

相关文档：

- [scope.md](../../delivery/phase-1/scope.md)
- [plan.md](../../delivery/phase-1/plan.md)
- [skeleton.md](../portal/skeleton.md)
- [data-api.md](../portal/data-api.md)

## 2. Product Decision

账号系统采用以下原则：

- 任何访客都可以通过邮箱验证码建立入口账号
- 登录成功不等于获得参与资格
- 正式报名只能在已登录账号内提交
- 参与资格由后台审核和状态控制决定
- 认证层、资料层、报名层与参与者业务层分离
- 匿名仅影响公开展示，不影响主催识别和联系
- 第一阶段不引入用户名与密码体系

一句话定义：

`先进入工作台，再补资料与作品，最后由后台开放参与资格。`

## 3. User Journey

### 3.1 Visitor

访客阶段的任务如下：

- 浏览活动说明
- 判断是否进入报名流程
- 使用邮箱验证码建立入口会话

对应入口：

- `/`
- `/apply`
- `/portal/login`

### 3.2 Authenticated Applicant

已建立会话但尚未通过审核的用户任务如下：

- 补充笔名、SNS 与联系资料
- 填写或完善报名资料
- 提前整理作品资料
- 查看审核状态

该阶段采用以下入口规则：

- 首次登录后，如未填写联系资料，系统优先引导至 `/portal/profile`
- 联系资料完成后，如尚未建立报名记录，系统优先引导至 `/portal/application`
- 已存在联系资料与报名记录但仍待审核的账号优先进入 `/portal/project`
- 已获得参与资格的账号进入 `/portal` 查看当前状态

对应入口：

- `/portal`
- `/portal/profile`
- `/portal/application`
- `/portal/project`

### 3.3 Approved Participant

审核通过后的任务如下：

- 确认已开放的参与者资格
- 进入时间段与资料工作台
- 后续多次返回系统完成协作

对应入口：

- `/portal`
- `/portal/schedule`
- `/portal/project`
- `/portal/history`

### 3.4 Withdrawn or Completed Participant

状态变为 `withdrawn` 或 `completed` 后的任务如下：

- 查看当前状态
- 保留必要的历史记录可见性
- 不再执行新的参与者动作

## 4. Identity Model

### 4.1 Identity Layers

账号系统分为五层：

1. `auth user`
2. `portal_profile`
3. `application`
4. `participant`
5. `admin`

### 4.2 Responsibilities

各层职责如下：

- `auth user`
  - Better Auth 用户与会话
  - Email OTP 校验
  - 登录态与 cookie 生命周期

- `portal_profile`
  - 参与者自填的联系方式与公开署名偏好
  - 后台审核时的识别依据

- `application`
  - 报名内容
  - 审核状态
  - 与活动意向相关的静态资料快照

- `participant`
  - 审核通过后的稳定业务身份
  - 时间段、资料、事件日志的关联主体

- `admin`
  - 后台访问与运营操作

### 4.3 Canonical Business Identity

通过审核前，稳定的登录主体是 `auth user`。

通过审核后，活动内的核心业务身份为 `participant`，不是认证层 `user`。

## 5. Authentication Strategy

### 5.1 Selected Model

第一阶段采用以下认证模型：

- Better Auth
- Email OTP
- Cookie Session
- Resend

### 5.2 Explicit Non-Goals

第一阶段不包含：

- 用户名与密码体系
- 社交登录
- 多因素认证
- 对主催完全匿名的参与模式
- 绕过审核直接进入参与流程

### 5.3 Entry Boundary

入口边界定义如下：

- 公共说明入口：`/`、`/apply`
- 认证入口：`/portal/login`
- 已登录待审核入口：`/portal`、`/portal/profile`、`/portal/application`、`/portal/project`
- 已批准参与者入口：`/portal/schedule`、`/portal/history`
- 管理后台：`/admin/*`

### 5.4 Session Policy

会话策略采用以下原则：

- 支持长期会话，减少重复输入验证码
- 认证层显式配置 `expiresIn = 30 days`
- 认证层显式配置 `updateAge = 1 day`
- 持续使用中的会话按日续期；连续 30 天无访问后需要重新使用邮箱验证码登录
- 提供明确的退出入口
- 不要求单设备限制
- 使用同一邮箱继续登录，不额外引入密码记忆负担

## 6. Profile and Contact Requirements

### 6.1 Required Fields

已登录用户至少需要补充以下资料：

- 当前联系邮箱
- 主联系渠道类型
- 主联系渠道标识
- 公开署名模式

### 6.2 Recommended Fields

如有需要，可继续补充：

- 常用笔名
- 备用联系方式
- 常用公开署名
- 主催备注
- 时区

### 6.3 Operational Rules

资料收集遵守以下规则：

- 系统不收集真实姓名作为必填项
- 主催必须始终能够识别并联系到具体参与者
- 公开展示名可以与主联系身份不同
- 匿名参与者仍需向主催提供稳定联系方式
- 未完成联系资料的账号不得提交或更新门户内报名资料

## 7. Anonymous Participation Model

匿名参与采用以下公开署名模式：

- `named`
  - 公开使用常用笔名

- `pseudonymous`
  - 公开使用单独设置的署名

- `anonymous`
  - 公开页不展示常用笔名，改为匿名标识

匿名模式的产品要求如下：

- 主催后台始终可见常用笔名和联系方式
- 公开页仅根据署名模式展示公开名称
- 审核、联系、时间段与资料流程始终绑定真实业务主体

## 8. Product Copy Requirements

### 8.1 Preferred Terms

界面优先使用以下术语：

- `参与者入口`
- `首次进入`
- `继续登录`
- `公开署名`
- `匿名参与`
- `时间段`

### 8.2 Terms to Avoid

界面避免以下术语：

- `受邀邮箱`
- `账号中心`
- `平台账户`
- `用户控制台`
- `自由注册平台`

### 8.3 Message Style

消息文案应满足以下要求：

- 使用说明性表达
- 避免企业后台语气
- 明确下一步操作
- 将“已登录”与“已获准参与”明确区分

## 9. Route Model

### 9.1 Public Surface

- `/`
- `/apply`
- `/apply/success`

### 9.2 Authenticated Applicant Surface

- `/portal/login`
- `/portal`
- `/portal/profile`
- `/portal/application`

### 9.3 Approved Participant Surface

- `/portal/schedule`
- `/portal/project`
- `/portal/history`

### 9.4 Admin Surface

- `/admin/*`

## 10. Anti-Abuse Requirements

### 10.1 Public Intake

第一阶段的公共入口仅承担说明与引导职责，不承载正式报名提交。

因此：

- `/apply` 不接收正式报名数据
- 正式报名统一在 `/portal/application` 内提交
- 旧的 `POST /api/applications` 仅保留为兼容阻断接口

### 10.2 Portal Entry

参与者入口采用以下防护：

- Email OTP
- 邮箱规范化与统一比对
- 对 OTP 发送动作按 IP 与邮箱限流
- 使用通用反馈文案，避免暴露邮箱状态
- 在必要时为首次进入或异常流量增加额外校验

### 10.3 State-Changing Actions

以下动作必须由服务端统一校验：

- 提交或更新报名资料
- 认领时间段
- 变更时间段
- 释放时间段
- 提交预告资料
- 提交审查资料

## 11. Operational Flow

标准流转如下：

1. 访客访问公共页面并了解活动
2. 访客在 `/portal/login` 使用邮箱验证码建立或恢复会话
3. 系统在首次成功登录后创建或恢复 `participant` 工作台主体
4. 已登录用户补充资料、完成报名，并可提前整理作品资料
5. 管理员结合资料与报名内容进行审核
6. 审核通过后系统将 `participant.status` 从 `pending` 更新为 `approved`
7. 已批准用户解锁时间段等正式动作
8. 后续使用同一邮箱继续登录并维持长期会话

## 12. Phase-1 Scope

### 12.1 Required Now

第一阶段必须具备：

- 允许邮箱验证码建立入口会话
- `/portal/login`
- `/portal`
- `/portal/profile`
- `/portal/application`
- 后台可审核并决定是否放行为参与者
- 已批准和未批准状态的服务端权限边界
- 匿名公开模式的资料结构

### 12.2 Follow-Up

以下能力可在第一阶段后续迭代中补齐：

- 时间段工作台的完整体验
- 资料补录工作台的完整体验
- 历史记录页的细化展示

## 13. Acceptance Criteria

账号系统完成后，至少满足以下条件：

- 任意访客都可通过邮箱验证码建立会话
- 未获准参与的账号不能执行参与者专属动作
- 后台可以根据资料与报名内容放行或撤回参与资格
- 主催始终可以看到稳定的联系资料
- 匿名模式只影响公开展示，不影响后台识别
- 用户后续可通过同一邮箱继续登录

## 14. Out of Scope

以下能力不在当前范围内：

- 长期平台化账户体系
- 社区关系与即时通信
- 用户名与密码重置系统
- 对主催不可识别的匿名模式
- 大规模开放社区治理能力

## 15. Official References

- Better Auth Email OTP
  - https://better-auth.com/docs/plugins/email-otp
- Better Auth options
  - https://better-auth.com/docs/reference/options
- OWASP Authentication Cheat Sheet
  - https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Email Validation and Verification Cheat Sheet
  - https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html
