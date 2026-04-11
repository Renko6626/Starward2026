# Starward2026 Apply Page Wireframe

Last updated: 2026-04-11

## 1. Purpose

本文定义报名页的线框、字段优先级、反馈状态与反滥用要求。

## 2. Page Objectives

报名页需要同时完成以下任务：

- 说明报名规则
- 提供必要字段
- 控制提交摩擦
- 建立明确的后续预期

## 3. UX Principles

### 3.1 Minimal Required Fields

报名页仅收集当前审核阶段必需的数据。

### 3.2 Single-Column Layout

单列布局为默认方案，便于在同一阅读节奏中呈现说明、字段与提交动作。

### 3.3 Grouped Questions

字段按主题分组呈现，不采用多步骤流程。

### 3.4 Calm Validation

错误反馈应逐项说明，避免高压式交互。

### 3.5 Visible Contact Path

页面保留主催联系方式或联系说明。

## 4. Technical Constraints

### 4.1 Turnstile

报名接口使用 Cloudflare Turnstile，并在服务端执行 token 校验。

### 4.2 Rate Limiting

报名接口使用基础限流控制短时滥用，但不依赖限流系统承担业务状态判断。

## 5. Desktop Wireframe

### 5.1 Header

页头应包含：

- 返回首页
- 页面标题
- 当前阶段标签
- 截止信息

### 5.2 Opening Block

开场说明应包含：

- 报名简介
- 审核说明
- 后续联系说明

### 5.3 Before You Apply

报名前说明应包含：

- 参与条件
- 提交前准备
- 基本规则

### 5.4 Form Section A: Basic Identity

字段建议：

- `displayName`
- `publicName`（如需）

### 5.5 Form Section B: Contact

字段建议：

- `contactEmail`
- `contactHandle`

### 5.6 Form Section C: Participation Intent

字段建议：

- `interestFormat`
- `introText`

### 5.7 Form Section D: Past Work or Reference

字段建议：

- `portfolioUrl`

### 5.8 Form Section E: Message to Hosts

字段建议：

- `messageToHosts`

### 5.9 Form Section F: Consent

字段建议：

- 规则确认
- 联系确认

### 5.10 Submit Block

提交区应包含：

- Turnstile 组件
- 提交按钮
- 结果提示区

## 6. Mobile Wireframe

移动端顺序建议如下：

1. 页面说明
2. 报名前说明
3. 基础身份
4. 联系方式
5. 参与意向
6. 参考资料
7. 附加说明
8. 同意项
9. 提交区

## 7. Field Strategy

### 7.1 Required

- 昵称或显示名
- 联系邮箱
- 主要联系方式
- 参与形式
- 规则确认

### 7.2 Optional

- 参考链接
- 补充说明

### 7.3 Excluded for Phase 1

- 复杂履历字段
- 多附件上传
- 长篇项目提案

## 8. Error and Success States

### 8.1 Validation Error

字段错误应显示在字段附近，并保留表单内容。

### 8.2 Rate Limit Error

应返回明确的稍后重试提示。

### 8.3 Turnstile Error

应提示重新验证，不重置已填写字段。

### 8.4 Success State

提交成功后跳转到 `/apply/success`。

## 9. Copy Rules

报名页文案应满足以下要求：

- 语气明确
- 规则完整
- 避免企业表单术语
- 明确审核与联系预期

## 10. Recommended Components

- `ApplyPageHeader`
- `ApplyIntro`
- `ApplyRules`
- `ApplyForm`
- `ApplyConsent`
- `ApplySubmitBlock`

## 11. References

- [skeleton.md](../product/site/skeleton.md)
- [homepage-wireframe.md](./homepage-wireframe.md)
- [participant-account-system.md](../product/accounts/participant-account-system.md)
- Cloudflare Turnstile
  - https://developers.cloudflare.com/turnstile/concepts/widget/
