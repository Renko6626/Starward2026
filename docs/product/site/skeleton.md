# Starward2026 Site Skeleton

Last updated: 2026-04-12

## 1. Purpose

本文定义站点层面的产品骨架，覆盖公共站点、参与者入口与后台系统的页面职责。

## 2. Product Positioning

站点由以下部分构成：

- 活动开始页
- 报名说明页
- 作品归档页
- 参与者门户
- 管理员后台

产品定位如下：

- 公共站点负责活动说明与归档展示
- 参与者门户负责登录后的持续操作
- 管理后台负责审核与状态管理

## 3. Core User Questions

首页必须在前两屏内回答以下问题：

1. 活动是什么
2. 当前阶段是什么
3. 当前可用入口是什么

## 4. Route Skeleton

### 4.1 Public

- `/`
- `/apply`
- `/apply/success`
- `/works`
- `/works/:slug`
- `/about`

### 4.2 Participant

- `/portal/login`
- `/portal`
- `/portal/profile`
- `/portal/application`
- `/portal/schedule`
- `/portal/project`
- `/portal/history`

### 4.3 Admin

- `/admin`
- `/admin/applications`
- `/admin/participants`
- `/admin/schedule`
- `/admin/project-drafts`

## 5. Homepage Skeleton

首页建议包含以下区块：

- Hero
- 活动说明
- 接力机制说明
- 当前进度看板
- 时间线
- 参与须知
- 归档预览
- 主催与联系信息

## 6. Apply Page Skeleton

`/apply` 建议包含以下区块：

- 页面说明
- 报名前须知
- 正式报名边界说明
- 参与者入口 CTA
- 提交成功后的后续说明

## 7. Works Index Skeleton

作品列表页建议包含以下区块：

- 页面标题与元信息
- 归档说明
- 接力顺序视图
- 作品列表
- 署名与版权说明

## 8. Work Detail Skeleton

作品详情页建议包含以下区块：

- 返回导航
- 作品标题与作者
- 作品元信息
- 摘要
- 站外访问入口
- 接力上下文
- 作者附言

## 9. Participant Portal Skeleton

参与者门户建议包含以下页面：

- 登录页
- 总览页
- 资料页
- 报名状态页
- 时间段页
- 作品资料页
- 历史页

## 10. Admin Skeleton

管理员后台使用四个导航入口：

- 参与者管理：顶部展示待办摘要，列表切换待审核报名与全部创作者，保留未报名账号及历史报名。
- 作品审核：筛选待审核作品，搜索创作者、标题或发布时点。
- 接力排期：显示时点、认领人和状态，展开单项编辑；初始化与追加坑位沿用现有接口。
- 活动设置：配置报名、改期、作品提交与公开发布窗口。

参与者详情统一显示联系资料、报名计划、当前时点、审核操作、参与资格和作品入口。账号信息与人工资格维护默认折叠。

`/admin` 与 `/admin/applications` 跳转到参与者管理的待审核视图。已明确关联参与者的旧报名详情链接跳转到该参与者详情；未关联的历史报名沿用旧地址，由统一详情组件展示。

## 11. Visual Direction

视觉方向应满足以下要求：

- 支持档案式信息排布
- 支持接力顺序表达
- 适配桌面与移动端
- 公共页面与后台页面视觉层级清晰分离

## 12. Content Tone

文档与界面文案采用以下原则：

- 使用说明性表达
- 避免临时讨论口吻
- 避免平台化或企业后台术语
- 保持术语一致性

## 13. Relationship to Other Docs

- [homepage-wireframe.md](../../design/homepage-wireframe.md)
- [apply-page-wireframe.md](../../design/apply-page-wireframe.md)
- [works-page-wireframe.md](../../design/works-page-wireframe.md)
- [work-detail-page-spec.md](../../design/work-detail-page-spec.md)
- [skeleton.md](../portal/skeleton.md)
