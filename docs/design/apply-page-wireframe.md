# Starward2026 Apply Page Wireframe

Last updated: 2026-04-12

## 1. Purpose

本文定义 `/apply` 的线框与信息结构。

当前版本中，`/apply` 不承载正式报名表单，只负责说明报名规则、解释账号边界，并引导访客进入参与者入口。

## 2. Page Objectives

`/apply` 需要同时完成以下任务：

- 说明报名是否开放
- 解释“先建账号，再补资料，再提交正式报名”的顺序
- 明确匿名只影响公开署名，不影响主催识别
- 将访客导向 `/portal/login` 或 `/portal/application`

## 3. UX Principles

### 3.1 Read Before Action

页面优先说明规则，再给出进入按钮。

### 3.2 Single Next Step

访客只需要理解一个下一步：

- 未登录则进入 `/portal/login`
- 已登录则进入 `/portal/application`

### 3.3 Identity Boundary First

页面必须明确：

- 正式报名必须绑定参与者入口账号
- 联系邮箱、主联系渠道、主联系标识是审核依据
- 笔名与公开署名属于展示层设置

### 3.4 Low-Friction Copy

说明语气保持平实，不制造企业表单式压迫感。

## 4. Desktop Wireframe

### 4.1 Header

页头应包含：

- 返回首页
- 页面标题
- 当前报名状态标签

### 4.2 Status Block

状态区应包含：

- 当前 `application_open` 窗口状态
- 简短说明
- 对未开放状态的明确提示

### 4.3 Rule Block

规则区应包含：

- 正式报名仅在门户内提交
- 匿名仅代表不公开笔名或改用单独署名
- 主催后台仍需要稳定联系方式

### 4.4 Action Block

动作区应包含：

- 主按钮：前往 `/portal/login` 或 `/portal/application`
- 次按钮：返回首页
- 可选说明：同一邮箱用于后续继续登录与查看审核状态

## 5. Mobile Wireframe

移动端顺序建议如下：

1. 页面标题与状态
2. 当前报名状态
3. 规则说明
4. 下一步动作

## 6. State Rules

### 6.1 Not Logged In

- 主按钮显示“先进入参与者入口”
- 跳转到 `/portal/login`

### 6.2 Logged In

- 主按钮显示“前往当前账号的报名资料页”
- 跳转到 `/portal/application`

### 6.3 Window Closed

- 仍允许进入登录页
- 明确告知当前不能提交正式报名

## 7. Copy Rules

页面文案应满足以下要求：

- 使用“报名说明”“参与者入口”“正式报名”等术语
- 避免将 `/apply` 写成公开表单
- 避免把匿名解释成匿名账户
- 明确区分“已登录”与“已审核通过”

## 8. Recommended Components

- `ApplyPageHeader`
- `ApplyWindowStatus`
- `ApplyBoundaryRules`
- `ApplyNextStep`

## 9. References

- [skeleton.md](../product/site/skeleton.md)
- [homepage-wireframe.md](./homepage-wireframe.md)
- [participant-account-system.md](../product/accounts/participant-account-system.md)
- Better Auth Email OTP
  - https://better-auth.com/docs/plugins/email-otp
