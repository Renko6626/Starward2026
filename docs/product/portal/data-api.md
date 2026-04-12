# Starward2026 Participant Portal Data and API Draft

Last updated: 2026-04-12

## 1. Purpose

本文定义参与者门户的数据模型与 API 草案。

术语说明：

- 对外中文术语使用 `时间段`
- 英文领域术语使用 `schedule segment`
- 相关迁移策略见 [time-segment-model.md](../../architecture/time-segment-model.md)

## 2. Scope

本文覆盖以下内容：

- 认证边界
- 数据表设计
- 索引与约束
- 参与者门户 API
- 与管理员后台的接口边界

本文不覆盖：

- 最终迁移文件实现
- 前端组件实现
- 完整部署说明

## 3. Auth Model

### 3.1 Selected Approach

参与者认证采用以下模型：

- Better Auth
- Email OTP
- Cookie Session
- Resend

### 3.2 Auth Boundary

认证层负责：

- `user`
- `session`
- `account`
- `verification`

业务层负责：

- `portal_profiles`
- `applications`
- `participants`
- `schedule_versions`
- `schedule_segments`
- `project_drafts`
- `event_windows`
- `participant_events`

### 3.3 Entry Flow

标准流转如下：

1. 访客通过 Email OTP 建立或恢复 `user`
2. 已登录用户补充 `portal_profiles`
3. 已登录用户提交 `applications`
4. 管理员审核后创建或激活 `participant`
5. 已批准账号以 `participant` 作为业务主体进入门户

## 4. Table Overview

### 4.1 `portal_profiles`

用途：

- 记录已登录用户补充的联系方式与公开署名偏好
- 作为后台审核与后续联系的稳定资料来源

建议字段：

- `user_id`
- `pen_name`
- `contact_email`
- `primary_contact_channel`
- `primary_contact_handle`
- `backup_contact`
- `public_credit_mode`
- `public_credit_name`
- `admin_note`
- `created_at`
- `updated_at`

### 4.2 `applications`

用途：

- 记录报名内容
- 与已登录账号关联
- 作为审核前的业务资料快照

建议字段：

- `id`
- `user_id`
- `display_name`
- `contact_email`
- `contact_handle`
- `interest_format`
- `intro_text`
- `portfolio_url`
- `message_to_hosts`
- `status`
- `reviewed_by`
- `reviewed_at`
- `admin_note`
- `created_at`
- `updated_at`

建议状态：

- `pending`
- `approved`
- `rejected`
- `withdrawn`

### 4.3 `participants`

用途：

- 表示进入活动流程的参与者身份

建议字段：

- `id`
- `user_id`
- `application_id`
- `account_email`
- `display_name`
- `contact_handle`
- `status`
- `invited_at`
- `activated_at`
- `created_at`
- `updated_at`

建议状态：

- `active`
- `withdrawn`
- `completed`

### 4.4 `schedule_versions`

用途：

- 表示一版完整排期

建议字段：

- `id`
- `title`
- `status`
- `published_at`
- `created_at`
- `updated_at`

建议状态：

- `draft`
- `active`
- `archived`

### 4.5 `schedule_segments`

用途：

- 表示可认领的时间段

建议字段：

- `id`
- `schedule_version_id`
- `sequence_no`
- `display_label`
- `planned_duration_minutes`
- `starts_at`
- `ends_at`
- `status`
- `current_participant_id`
- `claimed_at`
- `notes`
- `created_at`
- `updated_at`

建议状态：

- `claimable`
- `held`
- `locked`
- `published`
- `completed`
- `cancelled`

### 4.6 `project_drafts`

用途：

- 记录参与者的预告与审查资料

建议字段：

- `id`
- `participant_id`
- `segment_id`
- `preview_title`
- `preview_summary`
- `public_author_name`
- `format_label`
- `public_tags_json`
- `preview_status`
- `preview_submitted_at`
- `content_note`
- `content_warnings`
- `review_note`
- `review_status`
- `review_submitted_at`
- `admin_feedback`
- `created_at`
- `updated_at`

### 4.7 `event_windows`

用途：

- 控制可提交动作的开放状态

建议键：

- `application_open`
- `segment_claim_open`
- `segment_change_open`
- `preview_submit_open`
- `review_submit_open`

### 4.8 `participant_events`

用途：

- 记录参与者可见和后台可审计的关键动作

建议字段：

- `id`
- `participant_id`
- `actor_type`
- `actor_id`
- `event_type`
- `target_type`
- `target_id`
- `payload_json`
- `created_at`

## 5. Indexes and Constraints

### 5.1 Basic Constraints

- `participants.user_id` 唯一
- 参与者账号邮箱唯一
- `portal_profiles.user_id` 唯一
- `applications.user_id` 可在一期约束为唯一
- `project_drafts.participant_id` 唯一
- `schedule_segments(schedule_version_id, sequence_no)` 唯一

### 5.2 Active Holding Constraint

应建立部分唯一索引，确保同一参与者在同一版有效排期中只持有一个进行中的时间段。

### 5.3 Query Indexes

建议建立以下索引：

- `applications(contact_email)`
- `applications(user_id)`
- `portal_profiles(contact_email)`
- `participants(status)`
- `schedule_segments(status, sequence_no)`
- `participant_events(participant_id, created_at)`

## 6. Atomicity Rules

### 6.1 Claim

认领动作需要同时验证：

- 当前窗口开放
- 当前会话有效
- 目标时间段可认领
- 当前参与者没有其他进行中时间段

### 6.2 Change

变更动作需要同时验证：

- 当前窗口开放
- 当前参与者已有持有时间段
- 新时间段可认领
- 变更写入具备原子性

### 6.3 Release

释放动作需要同时验证：

- 当前窗口开放
- 当前时间段归属于当前参与者

## 7. API Design Principles

### 7.1 Auth Endpoints

认证端点统一挂载在 `/api/auth/*`。

### 7.2 Portal Endpoints

门户端点统一返回 JSON，并依赖会话读取当前参与者。

### 7.3 Admin Bridge

后台接口负责：

- 审核报名
- 创建参与者
- 发送参与者入口邮件
- 维护时间段与窗口

## 8. API Draft

### 8.1 Auth

- `GET /api/auth/*`
- `POST /api/auth/*`

### 8.2 Portal Bootstrap

- `GET /api/portal/me`
- `GET /api/portal/dashboard`

### 8.3 Schedule APIs

- `GET /api/portal/segments/current`
- `GET /api/portal/segments/available`
- `POST /api/portal/segments/claim`
- `POST /api/portal/segments/change`
- `POST /api/portal/segments/release`

### 8.4 Project Draft APIs

- `GET /api/portal/project`
- `PATCH /api/portal/project/preview`
- `POST /api/portal/project/preview/submit`
- `PATCH /api/portal/project/review`
- `POST /api/portal/project/review/submit`

### 8.5 History API

- `GET /api/portal/history`

## 9. Admin Bridge APIs

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

## 10. Implementation Order

推荐实现顺序如下：

1. 认证基础表
2. `applications`
3. `participants`
4. `schedule_versions` 与 `schedule_segments`
5. `event_windows`
6. `project_drafts`
7. `participant_events`
8. 索引与约束

## 11. Practical Notes

### 11.1 Keep `applications` and `participants` Separate

报名记录与参与者身份不合并。

### 11.2 Keep Event Windows Centralized

开放窗口统一由服务端读取 `event_windows` 计算，不在前端硬编码。

### 11.3 Keep Durable Objects Optional

在当前规模下，D1 事务与约束为默认方案。仅在后续并发需求显著上升时再评估 Durable Objects。

## 12. References

- [skeleton.md](./skeleton.md)
- [participant-account-system.md](../accounts/participant-account-system.md)
- [time-segment-model.md](../../architecture/time-segment-model.md)
- Better Auth Email OTP
  - https://better-auth.com/docs/plugins/email-otp
- Cloudflare D1 Worker API
  - https://developers.cloudflare.com/d1/worker-api/d1-database/
- SQLite Partial Indexes
  - https://www.sqlite.org/partialindex.html
