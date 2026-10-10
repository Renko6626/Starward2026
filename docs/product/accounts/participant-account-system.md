# Starward2026 Participant Account System PRD

Last updated: 2026-10-11

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

- 当前访客先通过邮箱验证码建立已验证的入口账号，再设置登录密码；QQ 授权后端保留，默认关闭，等待审核与联调
- 登录成功不等于获得参与资格
- 正式报名只能在已登录账号内提交
- 参与资格由后台审核和状态控制决定
- 认证层、资料层、报名层与参与者业务层分离
- 匿名仅影响公开展示，不影响主催识别和联系
- 注册先验证邮箱归属，再设置密码；参与者自行填写联系方式种类与内容，不沿用登录邮箱

一句话定义：

`先进入作者页面，再补资料与作品，最后由后台开放参与资格。`

## 3. User Journey

### 3.1 Visitor

访客阶段的任务如下：

- 浏览活动说明
- 判断是否进入报名流程
- 首次通过邮箱验证码建立入口会话，之后使用密码或邮箱验证码登录

对应入口：

- `/`
- `/apply`
- `/portal/login`

`/portal/login` 默认显示“注册账号”。已有账号需切换到“密码登录”；邮箱验证码入口位于密码登录模式下。注册依次填写邮箱、验证 6 位验证码、设置 8–128 位密码；验证码登录也允许首次开户。新邮箱须先同意当前活动规则，已有账号可直接登录。需要设置密码时，验证成功后停留在密码步骤，保存后才执行首次开户跳转。

### 3.2 Authenticated Applicant

已建立会话但尚未通过审核的用户任务如下：

- 补充笔名、SNS 与联系资料
- 填写或完善报名资料
- 提前整理作品资料
- 查看审核状态

该阶段采用以下入口规则：

- 本次新注册且未携带 `segment` 时段参数、没有报名记录、参与者状态也不是 `approved` 或 `completed` 时，进入 `/works` 接力时间表，先选择时段
- 本次新注册携带 `segment` 参数时，进入 `/portal?segment=<时段 ID>#profile`，填写资料与报名；携带参数本身不会预留时段
- 已有账号登录，以及已登录用户再次访问登录页时，进入 `/portal`；如携带 `segment` 参数，同样保留参数并定位到资料区域
- 登录后先读取 `/api/portal/me` 判断去向；读取失败时，新注册且未携带时段进入时间表，其他情况进入作者页面
- 资料、报名和状态集中在 `/portal`，不再按资料完整程度依次跳转到独立页面

对应入口：

- `/portal`
- `/works`（接力时间表与时段选择）
- `/portal/project`

### 3.3 Approved Participant

审核通过后的任务如下：

- 确认已开放的参与者资格
- 进入时间段与资料作者页面
- 后续多次返回系统完成协作

对应入口：

- `/portal`
- `/works`（接力时间表与换期操作）
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
  - 密码或 Email OTP 校验
  - 登录态与 cookie 生命周期

- `portal_profile`
  - 参与者自填的联系方式与公开署名偏好
  - 后台审核时的识别依据

- `application`
  - 报名内容
  - 审核状态
  - 与活动意向相关的静态资料快照

- `participant`
  - 首次成功注册或登录时创建或关联的稳定业务身份；新建记录状态为 `pending`
  - 时间段、资料、事件日志的关联主体

- `admin`
  - 后台访问与运营操作

### 4.3 Canonical Business Identity

通过审核前，稳定的登录主体是 `auth user`。

通过审核后，活动内的核心业务身份为 `participant`，不是认证层 `user`。

## 5. Authentication Strategy

### 5.1 Selected Model

第一阶段采用以下认证模型：

- Better Auth（当前使用邮箱认证；QQ Generic OAuth 后端保留，默认关闭，页面无登录或绑定入口）
- 邮箱与密码（登录邮箱须先经验证码验证）
- Email OTP（保留）
- Cookie Session
- Resend（仅登录验证码需要）

账号密码使用 Better Auth 的 `credential` account，密码长度 8–128 位。开户复用 `sign-in` Email OTP，成功后 `emailVerified=true`；直接 `POST /api/auth/sign-up/email` 已禁用。设置密码复用 `/api/auth/set-password`，必须持有已验证邮箱的有效会话。
验证码开户后先在入口页设置密码；中途离开导致尚未设置密码的账号，下次验证码登录时仍会进入密码步骤，也可在 `/portal` 资料区域的“登录密码”弹窗设置密码。已有密码账号修改密码须提供当前密码，并撤销其他会话。
历史未验证邮箱账号不能再用密码登录或访问作者业务接口；必须通过有效邮箱验证码补验。补验保留 user、参与者、报名及作品资料，撤销旧会话和未经邮箱验证建立的登录凭据，再由邮箱持有人设置密码。已有验证记录的账号继续沿用原密码。
忘记密码时，可在密码登录页选择“通过邮箱重置”，或从作者页面的“登录与密码”弹窗进入。填写登录邮箱后，输入邮件中的重置验证码与新密码即可重置，不要求旧密码。重置成功撤销该账号全部旧会话，需用新密码重新登录；报名与作品资料保留。验证码登录本身仍不重设已验证账号的已有密码。
没有有效会话且邮件不可用的旧账号，需先恢复身份验证渠道；不允许通过重新注册覆盖旧账号或仅凭邮箱领取既有邀请。

### 5.2 Explicit Non-Goals

第一阶段不包含：

- 独立用户名登录
- 多因素认证
- 对主催完全匿名的参与模式
- 绕过审核直接进入参与流程

### 5.3 Entry Boundary

入口边界定义如下：

- 公共说明与时间表入口：`/`、`/apply`、`/works`
- 认证入口：`/portal/login`
- 已登录作者入口：`/portal`、`/portal/project`、`/portal/history`
- 时间表操作入口：`/works`；具体可执行动作由服务端按参与者状态校验
- 管理后台：`/admin/*`

### 5.4 Session Policy

会话策略采用以下原则：

- 支持长期会话，减少重复登录
- 认证层显式配置 `expiresIn = 30 days`
- 认证层显式配置 `updateAge = 1 day`
- 持续使用中的会话按日续期；连续 30 天无访问后需要重新使用邮箱密码或邮箱验证码登录
- 提供明确的退出入口
- 不要求单设备限制
- 使用同一邮箱继续登录，可使用密码或邮箱验证码

## 6. Profile and Contact Requirements

### 6.1 Required Fields

已登录用户至少需要补充以下资料：

- 主联系渠道类型
- 主联系渠道标识
- 公开署名模式

### 6.2 Recommended Fields

如有需要，可继续补充：

- 邮箱可作为主联系方式的一种渠道，不设独立联系邮箱输入；历史字段保留兼容
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
- `/works`（默认 `view=gallery`，展示接力时间表）

### 9.2 Authenticated Applicant Surface

- `/portal`
- `/portal#profile`（资料与登录密码设置）
- `/portal#plan`（报名与参与计划）
- `/portal/project`
- `/portal/history`

认证入口为 `/portal/login`，位于作者页面布局之外。作者页面在会话检查完成后将未登录用户引导至该入口；业务接口独立校验会话。

### 9.3 Approved Participant Surface

审核通过后的账号继续使用上述作者入口，并在 `/works` 执行获准的排期操作。登录与访问页面本身不会授予参与资格。

### 9.4 Admin Surface

- `/admin/*`

### 9.5 Compatibility Redirects

- `/portal/profile` → `/portal#profile`
- `/portal/application` → `/portal#plan`
- `/portal/schedule` → `/works?view=gallery&type=all&q=`

这些旧地址仅保留重定向，不再承载独立的资料、报名或排期页面。

## 10. Anti-Abuse Requirements

### 10.1 Public Intake

第一阶段的公共入口仅承担说明与引导职责，不承载正式报名提交。

因此：

- `/apply` 不接收正式报名数据
- 正式报名统一在 `/portal` 内提交；旧 `/portal/application` 地址重定向至 `/portal#plan`
- 旧的 `POST /api/applications` 仅保留为兼容阻断接口

### 10.2 Portal Entry

参与者入口采用以下防护：

- 邮箱与密码（登录邮箱须先经验证码验证）
- Email OTP（保留）
- 邮箱规范化与统一比对
- 注册、验证码登录及密码重置共用服务端发送限额：同邮箱每 60 秒一次，同 IP 每 60 秒十次；使用独立 Cloudflare RateLimit 绑定，不只依赖前端倒计时或 Worker 内存。未配置限流或发信服务时拒绝发码
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
2. 首次访客在 `/portal/login` 输入邮箱、验证验证码、设置密码；已有账号用密码或邮箱验证码恢复会话
3. 系统在首次成功注册或登录后创建或关联 `participant` 作者页面主体，新建记录为 `pending`
4. 新注册且未选择时段的账号通常先进入 `/works`；选择时段后在 `/portal` 补充资料、提交报名，并可提前整理作品资料
5. 管理员结合资料与报名内容进行审核
6. 审核通过后系统将 `participant.status` 从 `pending` 更新为 `approved`
7. 已批准用户解锁时间段等正式动作
8. 后续使用同一邮箱继续登录并维持长期会话

## 12. Phase-1 Scope

### 12.1 Required Now

第一阶段必须具备：

- 允许邮箱密码或邮箱验证码建立入口会话
- `/portal/login`
- `/portal`
- `/portal` 内的资料与报名区域，以及旧地址的兼容重定向
- 后台可审核并决定是否放行为参与者
- 已批准和未批准状态的服务端权限边界
- 匿名公开模式的资料结构

### 12.2 Follow-Up

以下能力可在第一阶段后续迭代中补齐：

- 时间段作者页面的完整体验
- 资料补录作者页面的完整体验
- 历史记录页的细化展示

## 13. Acceptance Criteria

账号系统完成后，至少满足以下条件：

- 任意访客都可通过有效邮箱验证码建立已验证的会话，并设置登录密码
- 未获准参与的账号不能执行参与者专属动作
- 后台可以根据资料与报名内容放行或撤回参与资格
- 主催始终可以看到稳定的联系资料
- 匿名模式只影响公开展示，不影响后台识别
- 用户后续可通过同一邮箱继续登录

## 14. Out of Scope

以下能力不在当前范围内：

- 长期平台化账户体系
- 社区关系与即时通信
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

## QQ 登录与邮件策略（2026-10-10）

以下描述保留的 QQ 后端能力；当前开关默认关闭，页面没有 QQ 登录或绑定入口，启用前仍需审核与联调。启用后，新用户同意当前活动规则并通过 QQ 授权开户，已有 QQ 账号可登录。QQ 登录不赋予审核通过资格。已有邮箱用户在有效会话中主动绑定 QQ，关联现有 user/participant，保留原报名、作品和排期，不按昵称或手填 QQ 号自动合并。

QQ 认证通过应用内 OpenID，QQ-only 账号在 Better Auth 内部使用不可投递的兼容标识，业务接口和界面不把它展示为邮箱。真实联系邮箱允许为空，与认证邮箱独立；补填联系邮箱不会产生密码登录凭据。QQ 号仍由参与者填写作为联系资料，OAuth 不核验该号码。

邮件用于用户主动请求的注册、登录及密码重置验证码。注册与登录共用 `sign-in` OTP，重置使用独立的 `forget-password` OTP；邮箱验证和邮箱变更用途仍关闭。审核通过、补发邀请、换期不发送邮件，状态在现有作者页面查看。历史发信记录保留；旧补发端点返回 410，其他未开放的 OTP 用途在生成验证码前被拒绝。

接入步骤、默认关闭的配置开关和升级要求见 [QQ OAuth 接入说明](../../development/qq-oauth.md)。

## 上线入口与联系资料（2026-10-11）

本次上线先用邮箱验证码验证并开户，再设置密码；之后可使用密码或邮箱验证码登录。验证码 6 位、10 分钟有效，最多错误 3 次，重发倒计时 60 秒。QQ 默认关闭，Google 尚未接入。工作台保留联系方式种类、内容和选填备用联系方式；参与者可选择 QQ、微信、邮箱或其他渠道，与账号身份分开。新资料不从登录邮箱预填联系邮箱，旧联系邮箱字段及数据保留，不改数据库或接口。审核结果在作者页面查看。


## 邮件密码重置（2026-10-11）

重置入口为 `/portal/login?reset=password`。原生接口 `/api/auth/email-otp/request-password-reset` 请求邮件验证码，`/api/auth/email-otp/reset-password` 用邮箱、重置验证码、新密码完成重置。验证码 6 位、10 分钟有效、最多错误 3 次，不能用登录验证码代替；新密码为 8–128 位。未知邮箱的请求返回通用成功提示，不开户或发信。QQ-only 的内部兼容地址不能邮件重置，联系邮箱不会成为重置身份。

历史未验证邮箱也可通过重置验证码补验。成功后保留已写入的新密码，撤销旧外部绑定与会话；已验证账号保留原有外部绑定。密码长度不合法时，在消费验证码前拒绝，便于用户修正后继续。
