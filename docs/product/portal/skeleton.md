# Starward2026 Participant Portal Skeleton

Last updated: 2026-04-12

## 1. Purpose

本文定义参与者门户的产品骨架。

术语说明：

- 对外中文术语使用 `时间段`
- 英文领域术语使用 `schedule segment`
- 相关迁移策略见 [time-segment-model.md](../../architecture/time-segment-model.md)

## 2. Product Position

参与者门户是面向活动参与者的轻量作者页面，不是开放社区平台。

门户的目标如下：

- 建立稳定的参与者入口
- 提供时间段操作入口
- 提供资料补录入口
- 提供状态与历史记录查询

## 3. Scale Assumptions

当前产品假设如下：

- 参与者约 30 至 40 人
- 管理员数量较少
- 峰值并发有限，但存在短时抢占行为

基于上述假设，门户采用以下原则：

- 维持轻量架构
- 保留人工协调空间
- 将并发控制集中在服务端

## 4. Account Principles

门户采用以下账号原则：

- 存在稳定身份
- 支持邮箱与密码注册、登录，不要求邮件验证；保留邮箱验证码入口
- 允许通过邮箱密码或邮箱验证码建立入口会话
- 登录成功不等于获得参与资格
- 正式报名只能在已登录账号内提交
- 公开匿名与后台可识别同时成立
- 入口术语使用“参与者入口”，不使用平台化账户术语

## 5. Scope

### 5.1 Required

- 登录
- 总览页
- 联系资料维护
- 报名状态与审核反馈
- 已批准参与者的时间段入口
- 已批准参与者的资料补录入口
- 状态提示

### 5.2 Recommended

- 历史记录
- 截止时间提醒
- 阶段说明

### 5.3 Excluded

- 社交关系
- 评论
- 私信
- 即时消息
- 成就与积分

## 6. Route Skeleton

推荐路由如下：

- `/portal/login`
- `/portal`
- `/portal/profile`
- `/portal/application`
- `/portal/schedule`
- `/portal/project`
- `/portal/history`

兼容别名路由可保留，但不作为长期文档中的正式命名。

## 7. Role Model

### 7.1 Visitor

能力：

- 浏览公共页面
- 查看活动说明
- 进入参与者登录入口

### 7.2 Authenticated Applicant

能力：

- 维护联系资料与公开署名
- 查看报名与审核状态
- 查看当前账号状态

### 7.3 Approved Participant

能力：

- 查看自身状态
- 认领与调整时间段
- 补录资料
- 查看历史记录

### 7.4 Admin

能力：

- 查看所有参与者与时间段
- 审核资料
- 处理例外情况
- 管理开放窗口

## 8. Core Objects

### 8.1 Participant

关键字段：

- `id`
- `display_name`
- `account_email`
- `contact_handle`
- `status`

### 8.2 Portal Profile

关键字段：

- `user_id`
- `pen_name`
- `contact_email`
- `primary_contact_channel`
- `primary_contact_handle`
- `backup_contact`
- `public_credit_mode`
- `public_credit_name`

### 8.3 Schedule Segment

关键字段：

- `id`
- `code`
- `name`
- `description`
- `status`
- `current_participant_id`
- `claimed_at`

### 8.4 Project Draft

关键字段：

- `participant_id`
- `preview_title`
- `preview_summary`
- `preview_status`
- `review_status`
- `public_author_name`

### 8.5 Activity Log

关键字段：

- `participant_id`
- `actor_type`
- `event_type`
- `target_type`
- `target_id`
- `created_at`

## 9. State Model

### 9.1 Application State

- `pending`
- `approved`
- `rejected`
- `withdrawn`

### 9.2 Participant State

- `approved`
- `withdrawn`
- `completed`

### 9.3 Schedule Segment State

- `claimable`
- `held`
- `locked`
- `published`
- `completed`
- `cancelled`

### 9.4 Project Draft State

- `draft`
- `submitted`
- `approved`
- `revision_requested`

## 10. Primary Flows

### 10.1 First Entry

1. 访客在 `/portal/login` 使用邮箱密码或邮箱验证码建立或恢复会话
2. 系统在首次成功登录后创建或恢复 `participant` 作者页面主体
3. 系统根据当前账号资料完成度，将首次进入用户导向下一步必填页面
4. 已登录用户补充联系资料与公开署名设置
5. 已登录用户填写报名资料，并可提前整理作品资料
6. 管理员审核后将 `participant.status` 从 `pending` 更新为 `approved`
7. 已批准账号解锁时间段等正式动作

### 10.2 Schedule Claim

1. 参与者查看可用时间段
2. 参与者提交认领动作
3. 服务端验证窗口、会话和可用性
4. 系统写入状态与事件日志

### 10.3 Schedule Change

1. 参与者查看当前时间段与候选时间段
2. 参与者提交变更动作
3. 服务端处理冲突与状态更新

### 10.4 Schedule Release

1. 参与者提交释放动作
2. 服务端更新状态
3. 系统写入事件日志

### 10.5 Draft Update

1. 参与者编辑预告或审查资料
2. 参与者保存或提交
3. 服务端验证窗口与字段
4. 系统更新草稿状态

## 11. Page Skeletons

### 11.1 Dashboard

总览页应包含：

- 当前账号状态
- 参与者身份信息或待审核提示
- 当前时间段摘要
- 资料状态摘要
- 当前开放窗口
- 最近事件
- 导航入口

### 11.2 Profile Page

资料页应包含：

- 常用笔名
- 主联系渠道
- 备用联系方式
- 公开署名模式
- 匿名参与说明

### 11.3 Application Page

报名资料页应包含：

- 报名正文
- 创作形式偏好
- 审核状态
- 对主催备注
- 提交与更新反馈

### 11.4 Schedule Page

时间段页应包含：

- 当前持有状态
- 可用时间段列表
- 动作可用性说明
- 操作反馈

### 11.5 Project Page

资料页应包含：

- 预告信息分区
- 审查信息分区
- 当前状态
- 保存与提交动作

### 11.6 History Page

历史页应包含：

- 事件列表
- 时间信息
- 操作者信息

## 12. UX Rules

门户应遵守以下规则：

- 先展示状态，再展示动作
- 每个页面只保留一个主要任务
- 所有可提交动作都受 `event_windows` 控制
- 人工联系路径保持可见

## 13. Copy Rules

文案要求如下：

- 使用说明性表达
- 避免后台系统语气
- 统一使用 `时间段`
- 统一使用 `作者页面`

## 14. Relationship to Other Docs

- [participant-account-system.md](../accounts/participant-account-system.md)
- [data-api.md](./data-api.md)
- [scope.md](../../delivery/phase-1/scope.md)

## 2026-10-10：作品修改与发布确认

当前报名与作品资料集中在 `/portal`，时间表与换期入口为 `/works`。
所有作品字段在审核通过后仍可直接修改，保留审核结果，不通知审查人员。
距自己的发布时刻七天以内，作者页面顶部醒目提醒；发布当天（北京时间）填写
HTTPS 作品链接并确认。第一次提交即记录确认，之后修改链接保留首次确认时间。
预告与审查通过、公开资料完整后自动公开，无需下一棒确认或主催重复收录。
没有配置发布时间或超过当天尚未确认时，联系主催协调。

## 2026-10-10：作者页面文案同步

- 报名先填写基本信息和必填的创作意向；通过后继续创作，作品完成后再补齐作品资料。进度区的入口使用“查看作品资料”，不催促作者在报名通过后立即再次提交。
- 个人资料统一称为“署名与联系”；匿名只影响本站公开署名，主催仍可查看资料，B 站 UID 可提供给已确认排期的相邻作者。
- 公开部分称为“作品预告”，标题和简介采用“作品标题”“作品简介”；内部“审查说明”保留审核含义，“内容提醒”无需要说明的内容时填写“无”。两项提交仍明确标示为审核操作。
- 正式作品内容提交方式另行通知。公开作品链接在发布当天填写并确认；站内展示仍要求作品预告和审查说明审核通过、公开资料齐全。
- 历史页面统一为“操作记录”，反馈不再使用“摘要”“激活”等后台表达。登录成功提示不预先声称进入作者页面，兼顾新账号跳转到时间表的现有流程。

本次只同步文案，未合并预告和审查说明的独立审核状态，未实现正式作品内容提交通道。

报名中的“给主催的话”暂时停用，作者报名表不再提供输入；新报名不带入旧浏览器草稿中的留言，历史已保存留言保留。作品审查中的补充说明仍为选填。

报名中的“作品或主页链接（选填）”也暂时停用，新报名不带入旧浏览器草稿中的链接，历史已保存链接保留。B 站主页或 UID 继续用于相邻作者联系，正式作品链接仍在发布当天填写。

## 2026-10-10：报名阶段精简

- 删除作者页面的页内导航。报名区顶部集中显示状态、发布时间和必要操作，移除三步进度条及重复说明。
- “署名与联系”和“报名信息”中的表单始终展开，提交后也不折叠。
- 报名审核结果和主催反馈集中至“待办与反馈”，与现有换期请求共用区块。重新提交后保留的旧留言标为“上次报名反馈”。后续站内通知可在此展示，本轮未新增通知系统。
- 报名提交按钮按状态使用“提交报名”“更新报名”“重新提交报名”，相邻说明写明一并保存联系资料与创作意向、预留发布时间。
- 统一“刷新状态”“发布时间”“主催反馈”等报名用语；撤回说明明确释放时间及重新提交审核。
- 本轮只调整报名阶段及共用页面外壳，未调整作品表单、作品审核或公开规则。后续审核方向为报名一次，作品发布前零或一次，具体作品流程另行确认。
