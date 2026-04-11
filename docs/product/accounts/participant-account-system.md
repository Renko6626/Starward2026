# Starward2026 Participant Account System PRD

Last updated: 2026-04-11

## 1. Purpose

本文定义 Starward2026 面向外部用户的账号系统。

本文中的“账号系统”指报名、审核、参与者入口与会话管理的整体设计，不等同于开放注册平台。

相关文档：

- [scope.md](../../delivery/phase-1/scope.md)
- [skeleton.md](../portal/skeleton.md)
- [data-api.md](../portal/data-api.md)

## 2. Product Decision

账号系统采用以下原则：

- 公开报名不要求登录
- 审核通过后建立参与者身份
- 参与者通过受控入口登录
- 管理员身份与参与者身份分离
- 认证层与业务身份层分离

一句话定义：

`公开报名，审核转入，受邀登录。`

## 3. User Journey

### 3.1 Visitor

访客阶段的任务如下：

- 浏览活动说明
- 查看当前阶段
- 判断是否报名

对应入口：

- `/`
- `/apply`

### 3.2 Applicant

报名者阶段的任务如下：

- 提交报名表单
- 获得提交结果反馈
- 等待审核结果

对应入口：

- `/apply`
- `/apply/success`

### 3.3 Approved Participant

审核通过后的任务如下：

- 接收参与者入口邮件
- 使用受邀邮箱建立首次会话

对应入口：

- `/portal/login`

### 3.4 Active Participant

参与者阶段的任务如下：

- 确认身份与当前状态
- 进入后续时间段与资料工作台

对应入口：

- `/portal`
- `/portal/schedule`
- `/portal/project`
- `/portal/history`

## 4. Identity Model

### 4.1 Identity Layers

账号系统分为四层：

1. `application`
2. `participant`
3. `auth user`
4. `admin`

### 4.2 Responsibilities

各层职责如下：

- `application`
  - 报名记录
  - 审核前数据来源

- `participant`
  - 活动中的稳定业务身份
  - 时间段、资料、事件日志的关联主体

- `auth user`
  - Better Auth 用户与会话
  - OTP 校验与 cookie 管理

- `admin`
  - 后台访问与运营操作

### 4.3 Canonical Business Identity

业务上的核心身份为 `participant`，不是认证层 `user`。

## 5. Authentication Strategy

### 5.1 Selected Model

第一阶段采用以下认证模型：

- Better Auth
- Email OTP
- Cookie Session
- Resend

### 5.2 Explicit Non-Goals

第一阶段不包含：

- 自由注册
- 用户名与密码体系
- 社交登录
- 多因素认证

### 5.3 Entry Boundary

入口边界定义如下：

- 公共入口：`/apply`
- 参与者入口：`/portal/login`
- 管理后台：`/admin/*`

### 5.4 Session Policy

会话策略采用以下原则：

- 支持长期会话
- 提供明确的退出入口
- 不要求单设备限制

## 6. Product Copy Requirements

### 6.1 Preferred Terms

界面优先使用以下术语：

- `参与者入口`
- `受邀邮箱`
- `我的接力`
- `时间段`
- `资料补录`

### 6.2 Terms to Avoid

界面避免以下术语：

- `注册`
- `账号中心`
- `平台账户`
- `用户控制台`

### 6.3 Message Style

消息文案应满足以下要求：

- 使用说明性表达
- 避免企业后台语气
- 明确下一步操作

## 7. Route Model

### 7.1 Public Surface

- `/`
- `/apply`
- `/apply/success`

### 7.2 Participant Surface

- `/portal/login`
- `/portal`
- `/portal/schedule`
- `/portal/project`
- `/portal/history`

### 7.3 Admin Surface

- `/admin/*`

## 8. Anti-Abuse Requirements

### 8.1 Application Form

报名入口采用以下防护：

- Cloudflare Turnstile
- 服务端 token 校验
- 基础限流

### 8.2 Portal Login

参与者登录采用以下防护：

- 受邀邮箱白名单
- Email OTP
- 在必要时对发送 OTP 的动作增加额外校验

### 8.3 State-Changing Actions

以下动作必须由服务端统一校验：

- 认领时间段
- 变更时间段
- 释放时间段
- 提交预告资料
- 提交审查资料

## 9. Operational Flow

标准流转如下：

1. 访客提交报名
2. 管理员审核报名
3. 系统创建 `participant`
4. 系统发送参与者入口邮件
5. 参与者通过 `/portal/login` 建立会话
6. 系统将 `auth user` 绑定到 `participant`

## 10. Phase-1 Scope

### 10.1 Required Now

第一阶段必须具备：

- `participant` 身份模型
- 受邀邮箱登录
- `/portal/login`
- `/portal`
- 后台触发参与者入口邮件

### 10.2 Follow-Up

以下能力可在第一阶段后续迭代中补齐：

- 时间段工作台
- 资料补录工作台
- 历史记录页

## 11. Acceptance Criteria

账号系统完成后，至少满足以下条件：

- 访客可直接报名
- 审核通过后可转入参与者身份
- 仅受邀邮箱可登录参与者入口
- 首次登录后可建立稳定会话
- 管理员系统与参与者系统边界清楚

## 12. Out of Scope

以下能力不在当前范围内：

- 公开自由注册
- 社区功能
- 即时通信
- 用户关系系统
- 长期平台化账户体系

## 13. References

- [skeleton.md](../portal/skeleton.md)
- [data-api.md](../portal/data-api.md)
- [scope.md](../../delivery/phase-1/scope.md)
- Better Auth Email OTP
  - https://better-auth.com/docs/plugins/email-otp
- Better Auth Session Management
  - https://better-auth.com/docs/concepts/session-management
- Cloudflare Turnstile
  - https://developers.cloudflare.com/turnstile/concepts/widget/
- Cloudflare Access Application Paths
  - https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
