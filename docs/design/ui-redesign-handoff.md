# Starward2026 UI Redesign Handoff

Last updated: 2026-04-12

## 1. Purpose

本文用于向视觉设计与 UI 重设计阶段提供统一交接材料。

本文覆盖：

- 当前已实现页面清单
- 每个页面的功能目标
- 每个页面的推荐视觉方向
- 每个页面依赖的主要接口与字段
- 跨页面的状态、表单与后台信息结构约束

本文不覆盖：

- 最终像素级视觉稿
- 前端组件实现细节
- 公开作品归档页

## 2. Scope

本次交接仅覆盖当前已实现并已接入路由的页面：

### 2.1 Public

- `/`
- `/apply`
- `/apply/success`

### 2.2 Participant Portal

- `/portal/login`
- `/portal`
- `/portal/profile`
- `/portal/application`
- `/portal/schedule`
- `/portal/project`
- `/portal/history`

### 2.3 Admin

- `/admin`
- `/admin/applications`
- `/admin/applications/:applicationId`
- `/admin/participants`
- `/admin/participants/:participantId`
- `/admin/schedule`
- `/admin/project-drafts`
- `/admin/project-drafts/:draftId`
- `/admin/settings/windows`

不在本次范围内：

- `/works`
- `/works/:slug`

## 3. Current Visual Baseline

当前实现已经形成一套可识别的基础语言，可作为重设计的出发点，但不应原样放大。

### 3.1 Already Established

- 夜间深蓝底色与轻雾化径向光晕
- 标题使用衬线字体，正文使用无衬线字体
- 大圆角面板与胶囊按钮
- 以状态徽标、卡片、提示文案组织信息
- 公共页、门户页、后台页共享同一外层壳

### 3.2 What Should Be Preserved

- 项目整体应保留“夜间观测 / 秘封组 / 仪式感”的基调
- 公共页仍应比后台更具氛围感
- 门户与后台必须保留清晰的状态层级
- 重要动作应继续通过状态徽标与主按钮明确表达

### 3.3 What Should Change

- 不能让所有页面都长得像同一种卡片堆叠页
- 公共页、门户页、后台页需要有更明确的视觉分层
- 表单页需要更强的信息分组，而不是连续字段堆叠
- 后台页需要更强的扫描效率，而不是偏宣传页的节奏

## 4. Cross-Page Design Direction

以下方向基于当前项目约束，并参考了 W3C、GOV.UK Design System 与 PatternFly 的通用模式。

### 4.1 Public Pages

公共页应采用“活动前章 / 仪式入口”风格，而不是管理系统风格。

建议：

- 视觉重点放在阶段状态、活动氛围与入口引导
- 模块节奏可以更疏朗
- 主 CTA 不超过 2 到 3 个
- 页面信息密度低于门户页与后台页

不建议：

- 把首页做成纯施工中占位页
- 使用后台式表格或强工具面板
- 把公共页做成多层级复杂导航

### 4.2 Participant Portal

参与者门户更适合“任务面板 + 状态总览”风格。

建议：

- 使用清晰的下一步提示
- 用状态卡片总结用户当前阶段
- 表单页保持线性、稳定、低干扰
- 认领与资料提交页强调当前可执行动作

不建议：

- 做成社交平台式信息流
- 做成多层营销落地页
- 用大量装饰打断任务完成

### 4.3 Admin

后台更适合“运营控制台”风格。

建议：

- 以过滤、列表、状态、详情为主
- 列表页优先扫描效率
- 详情页优先决策效率
- 空状态要明确告诉管理员下一步应该做什么

不建议：

- 后台与公共页共用完全相同的信息节奏
- 过度使用大面积叙事性文案
- 让关键审核动作埋在页面深处

### 4.4 Form Rules

所有表单页应满足以下要求：

- 每个输入字段保持显式标签，不依赖 placeholder 充当标签
- 资料输入按任务逻辑分组，而不是按数据库字段顺序分组
- 错误提示应靠近字段或在提交区统一摘要展示
- 提交前后状态应有明确反馈

### 4.5 State Rules

所有页面至少要考虑以下状态：

- loading
- empty
- error
- read-only
- editable
- action-disabled-by-window

### 4.6 Accessibility and Information Structure References

本次交接建议主要参考以下方向：

- W3C WAI 表单标签与说明
- GOV.UK task list 用于“阶段性任务入口”
- PatternFly card/table/empty state 用于后台信息架构

### 4.7 Theme-Specific Art Direction

本项目的主题不是泛东方、也不是神社奇幻，更不是通用二次元科技 UI。

更准确的关键词应是：

- 秘封倶楽部
- 都市夜行
- 校外观测
- 学术社团
- 都市传说
- 记录与观测
- 月、星、车站、地图、旧仪器
- 日常闲谈与轻微异常并存

从题材气质上，建议将视觉锚点放在以下方向：

- 夜间城市而非幻想乡自然风景
- 观测记录而非战斗演出
- 社团笔记、调查档案、旧唱片与研究器材，而非纯赛博霓虹
- 有距离感的浪漫与轻微不安，而不是高强度恐怖
- 两位成员在现实边缘观察“另一侧”的感觉，而不是传统 JRPG 冒险界面

### 4.8 Theme Motifs

建议优先使用以下母题：

- 月相
- 星图
- 电车线路
- 站台编号
- 城市夜景
- 地图网格
- 观测日志
- 档案标签
- 模拟仪表
- 老式收音机或线路图
- 唱片、封套、索引卡

这些母题适合以低频方式出现：

- 背景暗纹
- 分隔线
- 页头插图
- 状态区装饰
- 图标系统

不建议直接堆满：

- 大面积宇宙星空照片
- 赛博朋克 HUD
- 过多魔法阵
- 传统和风纹样
- 纯学院制服萌系装饰

### 4.9 Theme Color Direction

推荐色彩不是单纯黑蓝，而是“夜间城市观察”方向。

建议主色组：

- 深靛蓝
- 墨黑蓝
- 灰雾蓝
- 月白
- 旧金 / 琥珀
- 暗红作为极少量警示色

建议辅助色组：

- 铁锈黄
- 站台绿
- 旧纸灰
- 收音机荧光蓝绿

推荐的整体关系：

- 公共页使用更明显的深夜氛围与冷暖对照
- 门户页降低氛围浓度，保留少量月白与观测蓝
- 后台页进一步收敛到高对比中性色，仅用状态色区分动作

### 4.10 Theme Typography

建议把排版理解为“记录体 + 标题体”的组合。

推荐原则：

- 标题使用带文学感或出版感的衬线字体
- 正文、表单、后台数据区使用高可读性的无衬线字体
- 可少量引入档案标签式等宽字或窄体字，用于编号、时间段编码、状态标签

标题气质应接近：

- 观测报告标题
- CD 封套标题
- 旧刊物专栏

不建议：

- 纯萌系圆体铺满全站
- 过度硬核的科幻等宽体主导正文
- 非常花哨的装饰字体大面积使用

### 4.11 Theme Texture and Layout Language

建议让页面有“被整理过的观察材料”感。

可采用的视觉语言：

- 目录卡
- 档案页边注
- 观察记录编号
- 站台或线路编号
- 薄雾感玻璃面板
- 轻度纸张 / 印刷层次
- 像唱片封套或册页一样的模块编排

布局上建议：

- 公共页更像封面与前言
- 门户页更像个人观测笔记与任务面板
- 后台页更像主催整理中的运营档案

### 4.12 Theme Dos and Don'ts

Do：

- 让公共页带有“夜里出门观测”的前奏感
- 让门户页像“我的记录册”和“下一步任务清单”
- 让后台页像“主催的调查与审核台”
- 用月、线、编号、索引、标记去建立主题识别
- 用克制的视觉异常感表达“现实边缘有别的东西”

Do not：

- 做成泛用 SaaS 后台皮肤
- 做成重度赛博朋克 UI
- 做成传统和风祭典网页
- 做成单纯星空壁纸 + 白字的低信息设计
- 做成恋爱视觉小说风格的人物展示站

## 5. Shared Domain Objects

以下字段组会在多个页面反复出现，建议视觉稿先建立统一表达方式。

### 5.1 User

- `id`
- `email`
- `name`
- `emailVerified`

### 5.2 Portal Profile

- `penName`
- `contactEmail`
- `primaryContactChannel`
- `primaryContactHandle`
- `backupContact`
- `publicCreditMode`
- `publicCreditName`
- `updatedAt`

### 5.3 Application

- `id`
- `displayName`
- `contactEmail`
- `contactHandle`
- `interestFormat`
- `introText`
- `portfolioUrl`
- `messageToHosts`
- `status`
- `adminNote`
- `reviewedBy`
- `reviewedAt`
- `updatedAt`

### 5.4 Participant

- `id`
- `displayName`
- `inviteEmail`
- `contactHandle`
- `status`
- `activatedAt`
- `currentSegmentCode`
- `currentSegmentName`
- `updatedAt`

### 5.5 Segment

- `id`
- `code`
- `name`
- `description`
- `status`
- `claimedAt`
- `releasedAt`
- `sortOrder`

### 5.6 Project Draft

- `previewStatus`
- `reviewStatus`
- `previewTitle`
- `previewSummary`
- `publicAuthorName`
- `formatLabel`
- `publicTags`
- `contentNote`
- `contentWarnings`
- `reviewNote`
- `adminFeedback`
- `previewSubmittedAt`
- `reviewSubmittedAt`
- `reviewedAt`
- `updatedAt`

### 5.7 Event Window

- `key`
- `label`
- `isEnabled`
- `isOpen`
- `opensAt`
- `closesAt`
- `updatedAt`

## 6. Page Inventory Summary

| Route | Audience | Primary function | Recommended visual mode |
| --- | --- | --- | --- |
| `/` | Public | Start page and phase communication | Atmospheric prologue page |
| `/apply` | Public | Explain rules and direct users into portal | Guidance page |
| `/apply/success` | Public / logged-in | Confirm application submission | Confirmation page |
| `/portal/login` | Applicant | Email OTP entry | Minimal entry form |
| `/portal` | Applicant / participant | Status overview and next step entry | Task dashboard |
| `/portal/profile` | Applicant | Maintain contact profile and public credit settings | Structured profile form |
| `/portal/application` | Applicant | Submit formal application | Reviewable application form |
| `/portal/schedule` | Approved participant | Claim or change segment | Action board |
| `/portal/project` | Approved participant | Maintain preview and review materials | Dual-panel workbench |
| `/portal/history` | Approved participant | View audit trail | Lightweight timeline |
| `/admin` | Admin | Entry overview for operations | Control hub |
| `/admin/applications` | Admin | Review queue | Filterable operations table |
| `/admin/applications/:applicationId` | Admin | Review one application and approve/reject | Decision detail page |
| `/admin/participants` | Admin | Participant roster | Dense list page |
| `/admin/participants/:participantId` | Admin | Maintain one participant | Operations detail page |
| `/admin/schedule` | Admin | View and correct segment allocation | Editable board/table hybrid |
| `/admin/project-drafts` | Admin | Review draft queue | Dense review list |
| `/admin/project-drafts/:draftId` | Admin | Review one participant draft | Split review detail page |
| `/admin/settings/windows` | Admin | Control action windows | Control panel |

## 7. Detailed Page Spec

## 7.1 `/`

### Function

- 宣告当前项目阶段
- 回答“活动是什么、现在到哪一步、从哪里进入”
- 引导到 `/apply`、`/portal/login`、`/admin`

### Current Modules

- Hero
- 阶段状态元信息
- 两张说明卡
- 页面结构清单

### Recommended Visual Direction

- 更像活动前章，而不是通用 landing page
- 顶部 hero 可保留强氛围，但内容应更聚焦阶段与入口
- CTA 层级应极明确
- 下半区可改为更整合的阶段说明和入口导航，不必维持均质卡片阵列

### Primary API

- `GET /api/health`

### Key Response Fields

- `status`
- `service`
- `timestamp`

## 7.2 `/apply`

### Function

- 说明正式报名已收口到门户内
- 展示当前报名窗口是否开放
- 引导未登录用户去 `/portal/login`
- 引导已登录用户去 `/portal/application`

### Current Modules

- 当前报名窗口状态卡
- 规则边界说明卡
- 下一步入口卡

### Recommended Visual Direction

- 做成“报名规则与入口说明页”，不是表单页
- 强调规则变化与账号体系边界
- 视觉上应比首页更收敛、更偏说明文档
- 主 CTA 只有一个主动作，其他是辅助跳转

### Primary API

- `GET /api/applications/intake`
- `authClient.useSession()`

### Key Response Fields

- `isOpen`
- `turnstileEnabled`
- `window.key`
- `window.label`
- `window.isOpen`
- `window.opensAt`
- `window.closesAt`
- `interestFormats[].value`
- `interestFormats[].label`

## 7.3 `/apply/success`

### Function

- 告知用户报名资料已绑定到当前账号
- 说明后续审核与继续登录方式
- 引导回 `/portal`

### Current Modules

- 成功状态头部
- 后续步骤说明
- 返回按钮组

### Recommended Visual Direction

- 这页应接近“确认页 / 回执页”
- 不需要复杂视觉层级
- 需要明确下一步时间线和入口
- 可以加入更强的状态确认标识，但不应变成营销页

### Primary API

- 无页面级主动请求

### Key Response Fields

- 无

## 7.4 `/portal/login`

### Function

- 发送邮箱验证码
- 使用 OTP 建立会话
- 根据当前账号状态跳转到下一页

### Current Modules

- 认证策略说明
- 邮箱输入区
- 验证码输入区
- 状态反馈消息

### Recommended Visual Direction

- 这是“入口页”，不是说明页
- 应把输入区放在更强视觉中心
- 认证说明保留，但不应压过表单本体
- 登录反馈、等待态、错误态必须非常清楚

### Primary API

- `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })`
- `authClient.signIn.emailOtp({ email, otp })`
- `GET /api/portal/me`

### Key Response Fields

- `PortalMeResponse.user`
- `PortalMeResponse.participant`
- `PortalMeResponse.profile`
- `PortalMeResponse.application`

## 7.5 `/portal`

### Function

- 汇总当前账号状态
- 区分待审核用户与已获批参与者
- 作为所有后续动作的统一入口

### Current Modules

- 基本身份摘要卡
- 待审核分支卡
- 已获批分支卡
- 当前窗口状态卡
- 最近事件卡

### Recommended Visual Direction

- 推荐改造成“任务型工作台”
- 未获批时更像 task list
- 已获批时更像个人控制台
- “下一步动作”要比“状态解释”更突出

### Primary API

- `GET /api/portal/dashboard`
- `authClient.signOut()`

### Key Response Fields

- `user.email`
- `profile`
- `application.status`
- `participant.displayName`
- `participant.status`
- `participant.activatedAt`
- `participant.currentSegmentCode`
- `currentSegment`
- `projectDraft.previewStatus`
- `projectDraft.reviewStatus`
- `windows[]`
- `recentEvents[]`

## 7.6 `/portal/profile`

### Function

- 维护主催识别所需联系资料
- 设置对外公开署名方式

### Current Modules

- 填写原则说明
- 资料表单
- 保存反馈

### Recommended Visual Direction

- 这页应是一张高可信度资料表单
- 将“联系身份”和“公开署名”分成两个清晰组块
- 公共署名模式切换应有动态说明
- 视觉重点应是稳定、清晰，而非氛围化

### Primary API

- `GET /api/portal/profile`
- `PATCH /api/portal/profile`

### Request Fields

- `penName`
- `contactEmail`
- `primaryContactChannel`
- `primaryContactHandle`
- `backupContact`
- `publicCreditMode`
- `publicCreditName`

### Key Response Fields

- `user.email`
- `profile.penName`
- `profile.contactEmail`
- `profile.primaryContactChannel`
- `profile.primaryContactHandle`
- `profile.backupContact`
- `profile.publicCreditMode`
- `profile.publicCreditName`
- `profile.updatedAt`

## 7.7 `/portal/application`

### Function

- 维护正式报名资料
- 展示审核状态
- 审核前允许修改
- 审核后转只读

### Current Modules

- 当前状态摘要
- 报名表单
- 主催备注提示

### Recommended Visual Direction

- 应做成“可回看的正式申请页”
- 顶部摘要区固定展示审核状态
- 表单区与状态区必须清晰分离
- 若资料被锁定，页面应明显进入只读模式

### Primary API

- `GET /api/portal/application`
- `POST /api/portal/application`
- `PATCH /api/portal/application`

### Request Fields

- `displayName`
- `contactEmail`
- `contactHandle`
- `interestFormat`
- `introText`
- `portfolioUrl`
- `messageToHosts`

### Key Response Fields

- `editable`
- `editState`
- `message`
- `profile`
- `participant.status`
- `application.displayName`
- `application.contactEmail`
- `application.contactHandle`
- `application.interestFormat`
- `application.status`
- `application.introText`
- `application.portfolioUrl`
- `application.messageToHosts`
- `application.adminNote`

## 7.8 `/portal/schedule`

### Function

- 初次认领时间段
- 变更时间段
- 释放时间段
- 呈现当前窗口是否允许操作

### Current Modules

- 当前模式摘要
- 当前持有状态卡
- 可选时间段卡片列表
- 动作规则说明

### Recommended Visual Direction

- 推荐做成“当前坑位 / 时间段操作板”
- 当前持有信息必须强于候选列表
- 候选时间段更适合密度较高的卡片或列表
- 操作可用与不可用状态需要极明确

### Primary API

- `GET /api/portal/segments/current`
- `GET /api/portal/segments/available`
- `POST /api/portal/segments/claim`
- `POST /api/portal/segments/change`
- `POST /api/portal/segments/release`

### Request Fields

- `segmentId`

### Key Response Fields

- `participant.displayName`
- `currentSegment.code`
- `currentSegment.name`
- `currentSegment.description`
- `currentSegment.status`
- `currentSegment.claimedAt`
- `actions.canClaim`
- `actions.canChange`
- `actions.canRelease`
- `actions.claimHint`
- `actions.changeHint`
- `actions.releaseHint`
- `windows[]`
- `available.items[].id`
- `available.items[].code`
- `available.items[].name`
- `available.items[].description`
- `available.items[].status`

## 7.9 `/portal/project`

### Function

- 维护公开预告资料
- 维护给主催的审查说明
- 在窗口开放时执行提交

### Current Modules

- 顶部状态摘要
- 当前窗口说明
- 主催反馈卡
- 预告信息区
- 审查说明区

### Recommended Visual Direction

- 推荐做成“双栏工作台”或“上下双工位”
- 预告与审查说明必须显式区分“公开”和“仅主催可见”
- 状态徽标和上次提交时间应固定可见
- 这是用户后续高频返回页面，应强调可维护性

### Primary API

- `GET /api/portal/project`
- `PATCH /api/portal/project/preview`
- `POST /api/portal/project/preview/submit`
- `PATCH /api/portal/project/review`
- `POST /api/portal/project/review/submit`

### Preview Request Fields

- `previewTitle`
- `previewSummary`
- `publicAuthorName`
- `formatLabel`
- `publicTags`

### Review Request Fields

- `contentNote`
- `contentWarnings`
- `reviewNote`

### Key Response Fields

- `participant.displayName`
- `participant.currentSegmentCode`
- `participant.currentSegmentName`
- `draft.previewStatus`
- `draft.reviewStatus`
- `draft.previewTitle`
- `draft.previewSummary`
- `draft.publicAuthorName`
- `draft.formatLabel`
- `draft.publicTags`
- `draft.contentNote`
- `draft.contentWarnings`
- `draft.reviewNote`
- `draft.adminFeedback`
- `draft.previewSubmittedAt`
- `draft.reviewSubmittedAt`
- `draft.reviewedAt`
- `windows[]`

## 7.10 `/portal/history`

### Function

- 提供参与者可见的轻量审计历史
- 帮助用户确认系统记录

### Current Modules

- 页头说明
- 简化历史列表
- 返回动作按钮

### Recommended Visual Direction

- 更适合时间线或事件列表
- 不需要复杂筛选器
- 应突出“最近发生了什么”
- 需要让事件标签可快速扫描

### Primary API

- `GET /api/portal/history`

### Key Response Fields

- `participant.displayName`
- `items[].id`
- `items[].eventType`
- `items[].actorType`
- `items[].actorLabel`
- `items[].label`
- `items[].createdAt`

## 7.11 `/admin`

### Function

- 作为运营后台总入口
- 汇总第一期需要的几个真实管理面

### Current Modules

- 后台定位说明
- 后台模块清单
- 入口 tiles

### Recommended Visual Direction

- 这页更适合“控制台首页”
- 不应像宣传页
- 各模块入口应有明确优先级
- 可以加入“待审核数量 / 待处理数量”等摘要，但不是必须

### Primary API

- 无页面级主动请求

### Key Response Fields

- 无

## 7.12 `/admin/applications`

### Function

- 展示报名审核队列
- 支持筛选与检索
- 跳转到报名详情和参与者详情

### Current Modules

- 检索框
- 过滤器按钮组
- 列表表格
- 空状态提示

### Recommended Visual Direction

- 应以高扫描效率为优先
- 推荐保留表格主形态
- 筛选器应靠近表格头部
- “入口已建 / 资料已补 / 已转参与者”这三类状态建议可视化为标签或子状态

### Primary API

- `GET /api/admin/applications`

### Key Response Fields

- `items[].id`
- `items[].displayName`
- `items[].contactEmail`
- `items[].contactHandle`
- `items[].interestFormat`
- `items[].status`
- `items[].createdAt`
- `items[].reviewedAt`
- `items[].authUserEmail`
- `items[].hasPortalProfile`
- `items[].participantId`
- `items[].participantStatus`

## 7.13 `/admin/applications/:applicationId`

### Function

- 查看单个报名详情
- 查看入口账号状态
- 查看联系资料与公开署名设置
- 执行批准、拒绝、撤回
- 发送门户提醒邮件

### Current Modules

- 审核摘要卡
- 报名与入口信息卡
- 联系资料与署名卡
- 报名正文卡
- 内部备注输入
- 审核动作区

### Recommended Visual Direction

- 这是后台最重要的决策页之一
- 建议采用“上摘要 + 中详情 + 下动作”的结构
- 审核动作需始终靠近备注区
- 可考虑将联系资料与报名正文分成左右双栏

### Primary API

- `GET /api/admin/applications/:applicationId`
- `PATCH /api/admin/applications/:applicationId`
- `POST /api/admin/participants/:participantId/invite`

### Review Request Fields

- `status`
- `adminNote`

### Key Response Fields

- `application.status`
- `application.interestFormat`
- `application.createdAt`
- `application.reviewedAt`
- `application.contactEmail`
- `application.contactHandle`
- `application.portfolioUrl`
- `application.introText`
- `application.messageToHosts`
- `application.adminNote`
- `application.authUser.id`
- `application.authUser.email`
- `application.portalProfile.penName`
- `application.portalProfile.contactEmail`
- `application.portalProfile.primaryContactChannel`
- `application.portalProfile.primaryContactHandle`
- `application.portalProfile.backupContact`
- `application.portalProfile.publicCreditMode`
- `application.portalProfile.publicCreditName`
- `application.participant.id`
- `application.participant.status`
- `application.participant.activatedAt`

## 7.14 `/admin/participants`

### Function

- 查看已转入参与者的 roster
- 快速跳转到参与者详情

### Current Modules

- 列表表格
- 空状态提示

### Recommended Visual Direction

- 这是轻量 roster 页面
- 保持高密度列表即可
- 不需要太多装饰
- 重点是“显示名 / 邮箱 / 状态 / 当前时间段”

### Primary API

- `GET /api/admin/participants`

### Key Response Fields

- `items[].id`
- `items[].displayName`
- `items[].inviteEmail`
- `items[].contactHandle`
- `items[].status`
- `items[].applicationId`
- `items[].currentSegmentCode`
- `items[].updatedAt`

## 7.15 `/admin/participants/:participantId`

### Function

- 维护参与者显示名
- 维护联系方式备注
- 调整参与状态
- 发送门户提醒邮件

### Current Modules

- 状态摘要
- 当前时间段信息
- 关联报名入口
- 编辑表单
- 操作按钮

### Recommended Visual Direction

- 这是“运营维护页”，不是阅读页
- 页面应把“当前状态”“可编辑字段”“操作按钮”拆开
- 危险操作或高影响操作应有更强提示
- 可以将“系统关联信息”与“可编辑字段”分层显示

### Primary API

- `GET /api/admin/participants/:participantId`
- `PATCH /api/admin/participants/:participantId`
- `POST /api/admin/participants/:participantId/invite`

### Request Fields

- `displayName`
- `contactHandle`
- `status`

### Key Response Fields

- `participant.id`
- `participant.displayName`
- `participant.inviteEmail`
- `participant.contactHandle`
- `participant.status`
- `participant.applicationId`
- `participant.currentSegmentCode`
- `participant.currentSegmentName`
- `participant.userId`
- `participant.invitedAt`
- `participant.activatedAt`
- `participant.updatedAt`

## 7.16 `/admin/schedule`

### Function

- 查看当前时间段分配
- 初始化时间段
- 人工修正单个时间段状态
- 人工指定认领人

### Current Modules

- 初始化表单
- 时间段卡片网格
- 单段编辑表单

### Recommended Visual Direction

- 当前实现偏“卡片化编辑板”
- 如果时间段数量上涨，建议改为 table + drawer 或 table + side panel
- 当前阶段人数少，可保留卡片，但应增强编辑效率
- “状态”和“认领人”应比描述字段更突出

### Primary API

- `GET /api/admin/segments`
- `POST /api/admin/segments/bootstrap`
- `PATCH /api/admin/segments/:id`
- `GET /api/admin/participants`

### Bootstrap Request Fields

- `count`

### Segment Update Request Fields

- `description`
- `status`
- `currentParticipantId`

### Key Response Fields

- `segments[].id`
- `segments[].code`
- `segments[].name`
- `segments[].description`
- `segments[].status`
- `segments[].currentParticipantId`
- `segments[].currentParticipantName`
- `segments[].claimedAt`
- `segments[].releasedAt`
- `segments[].sortOrder`
- `segments[].updatedAt`
- `participants[].id`
- `participants[].displayName`
- `participants[].status`
- `participants[].currentSegmentCode`

## 7.17 `/admin/project-drafts`

### Function

- 展示预告与审查资料审核队列
- 跳转到单条资料详情

### Current Modules

- 列表表格
- 空状态提示

### Recommended Visual Direction

- 这是审核队列页，应与报名队列视觉一致
- 可保留高密度表格
- 状态标识要明显
- 行内最好能快速看出是否“待审 / 需修改 / 已通过”

### Primary API

- `GET /api/admin/project-drafts`

### Key Response Fields

- `items[].id`
- `items[].participantId`
- `items[].participantName`
- `items[].segmentCode`
- `items[].previewStatus`
- `items[].reviewStatus`
- `items[].previewTitle`
- `items[].publicAuthorName`
- `items[].updatedAt`

## 7.18 `/admin/project-drafts/:draftId`

### Function

- 审阅作者填写的预告与审查说明
- 修改预告审核状态
- 修改审查审核状态
- 写回管理员反馈

### Current Modules

- 状态摘要
- 参与者与时间段摘要
- 预告信息卡
- 审查说明卡
- 审核表单

### Recommended Visual Direction

- 推荐做成“左信息 / 右审核”或“上信息 / 下审核”
- 作者原文内容与管理员操作必须分离
- 审核结果和反馈区需要高可见度
- 可以强化“需要修改”的视觉警示

### Primary API

- `GET /api/admin/project-drafts/:draftId`
- `PATCH /api/admin/project-drafts/:draftId`

### Request Fields

- `previewStatus`
- `reviewStatus`
- `adminFeedback`

### Key Response Fields

- `draft.participantName`
- `draft.participantInviteEmail`
- `draft.participantContactHandle`
- `draft.participantStatus`
- `draft.segmentCode`
- `draft.segmentName`
- `draft.previewStatus`
- `draft.reviewStatus`
- `draft.previewTitle`
- `draft.previewSummary`
- `draft.publicAuthorName`
- `draft.formatLabel`
- `draft.publicTags`
- `draft.contentNote`
- `draft.contentWarnings`
- `draft.reviewNote`
- `draft.adminFeedback`
- `draft.previewSubmittedAt`
- `draft.reviewSubmittedAt`
- `draft.reviewedAt`
- `draft.reviewedBy`
- `draft.updatedAt`

## 7.19 `/admin/settings/windows`

### Function

- 控制报名、认领、改段、预告提交、审查提交、公开发布的开放窗口

### Current Modules

- 窗口卡片列表
- 启用状态控件
- 开始结束时间控件
- 保存反馈

### Recommended Visual Direction

- 这是控制面板，不是内容页
- 每个窗口应像一个独立控制单元
- 当前是否开放、是否启用、时间范围三者必须分开表达
- 对于时间类信息，应避免过度装饰

### Primary API

- `GET /api/admin/event-windows`
- `PATCH /api/admin/event-windows/:key`

### Request Fields

- `isEnabled`
- `opensAt`
- `closesAt`

### Key Response Fields

- `items[].key`
- `items[].label`
- `items[].isEnabled`
- `items[].isOpen`
- `items[].opensAt`
- `items[].closesAt`
- `items[].updatedAt`

## 8. Recommended UI System Rules

如果由美工重新设计，建议先统一以下规则，再展开单页设计。

### 8.1 Typography

- 公共页保留衬线标题
- 门户与后台可适度降低衬线使用频率
- 表单与后台表格应以高可读性的无衬线为主

### 8.2 Color

- 公共页可保留夜间深蓝与冷光高光
- 门户页建议降低背景戏剧性，增加任务可读性
- 后台页建议进一步降低装饰性，提升中性色与状态色的对比

### 8.3 Status Language

建议统一以下状态层：

- 阶段状态
- 数据状态
- 可编辑状态
- 动作窗口状态
- 审核状态

### 8.4 Layout Density

- Public：低密度
- Portal：中密度
- Admin：中高密度

### 8.5 Empty States

空状态不应只写“暂无数据”，而应说明下一步：

- 为什么为空
- 谁来触发下一步
- 用户可以去哪里

## 9. External References

以下公开资料为本次重设计建议提供了结构参考：

- GOV.UK Design System task list
  - https://design-system.service.gov.uk/components/task-list/
- W3C WAI Forms Tutorial: Labels
  - https://www.w3.org/WAI/tutorials/forms/labels/
- PatternFly Table design guidelines
  - https://www.patternfly.org/components/table/design-guidelines/
- PatternFly Card design guidelines
  - https://www.patternfly.org/components/card/design-guidelines
- PatternFly Empty state design guidelines
  - https://www.patternfly.org/components/empty-state/design-guidelines/
