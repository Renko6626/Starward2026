# 仅保留登录验证码邮件实施计划

> 执行者按任务逐项完成；需要实施时使用 `superpowers:executing-plans`。本计划不授权额外委派、部署或数据库重置。

**Goal:** 邮件仅用于用户主动请求的邮箱登录验证码；审核和换期继续正常执行，不发送通知邮件。

**Architecture:** 在现有认证入口限制邮件类型，移除业务发信调用和相关界面提示。旧补发接口返回明确停用结果，历史发送记录保留；不新增邮件开关、消息服务或数据库迁移。

**Tech Stack:** Hono、Better Auth Email OTP、Resend、React、现有 D1 数据层。

**Spec:** [设计草案](../specs/2026-10-10-qq-oauth-design.md)，尤其第 1、5、7 节。邮件收缩由用户明确要求，可独立于待确认的 QQ 数据模型实施。

**状态：** 待实施。本轮仅制定计划。

## Global Constraints

- 即使存在有效 Resend 配置，也不发送审核通过、手动邀请或换期邮件。
- 唯一允许的 OTP 发送类型为 `sign-in`；邮箱密码及登录验证码的现有行为继续可用。
- 不删除历史邀请事件，不修改审核、窗口、交换请求或排期的业务条件。
- 遵守用户的测试约定；不为文案或删除代码新增测试，不用源码字符串断言代替行为验证。
- UI 仅截图查看，不自动点击、填写表单或执行交互流程。

## Review Focus

- 配置完整时的审核通过与换期请求也不发信：任务 2 通过真实路由调用验证。
- 直接请求旧手动补发接口不绕过页面限制：任务 2 验证 410 和发送事件未增加。
- 直接请求非登录 OTP 不发信、不误报成功：任务 1 验证前置拒绝及无外部请求。
- Resend 不可用不影响审核和换期业务：任务 2 复用已有数据库行为测试。
- 旧登录验证码仍可发送和消费：任务 1 复用真实认证用例，固定外部发信响应。

## Task 1：限制认证邮件用途

**文件：** 修改 `worker/lib/auth.ts`；复用 `worker/lib/auth.test.ts`、`worker/lib/password-auth.test.ts`。

**接口：** 保留 `buildPortalEmailOtpOptions(env)`；`sendVerificationOTP` 只接受 `type = sign-in`，其他类型抛出带 `email_purpose_disabled` 的明确错误。前置拒绝发生在生成或发送验证码之前。

- [ ] 在现有认证用例中通过真实 auth handler 请求 `/api/auth/email-otp/send-verification-otp`：`sign-in` 可用；其余三种类型被拒绝，没有邮件 HTTP 请求和新增验证记录。只替换外部服务响应，不 mock 认证逻辑。
- [ ] 修改 OTP 发送前置钩子及 `sendPortalOtpEmail`，发送回调再次限制类型，防止其他插件端点间接调用发信。保留登录验证码有效期、次数限制及重发策略。
- [ ] 删除非登录验证码邮件的主题和正文分支，不新增找回密码、改邮箱或验证邮箱入口。
- [ ] 运行 `npm test -- worker/lib/auth.test.ts worker/lib/password-auth.test.ts`，要求既有密码和 OTP 登录用例通过；必要的新行为用例验证拒绝响应和无发信副作用。

## Task 2：移除业务邮件和补发入口

**文件：** 修改 `worker/routes/admin.ts`、`worker/routes/portal.ts`、`worker/data/collaboration.ts`、`src/admin/pages/AdminCreatorDetailPage.tsx`、`src/admin/lib/application-review.ts`、`src/portal/components/SwapRequests.tsx`。清理 `worker/lib/participant-admin.ts` 的纯邮件功能及无其他调用的代码。

**测试：** 复用 `worker/data/applications.test.ts`、`worker/data/collaboration.test.ts`、`worker/lib/participant-admin.test.ts`、`src/admin/lib/application-review.test.ts`。若现有测试只覆盖旧邮件 helper，将有效业务断言迁入真实路由用例 `worker/routes/email-policy.test.ts`，不用新测试证明 helper 已被删除。

**接口：** 审核及交换请求响应省略可选 `notification`；旧 `POST /api/admin/participants/:participantId/invite` 保留管理员鉴权后返回 410，错误 code 为 `email_notifications_disabled`。`createSwap` 仅返回保存的请求 ID，不再查询邮件收件人。

- [ ] 删除审核路由中的 `maybeSendParticipantApprovalNotice` 调用和换期路由中的 `Resend.emails.send`。审核与交换业务结果继续来自原有真实数据操作。
- [ ] 将旧手动补发路由改为停用响应，不调用 `recordParticipantInviteSent`；保留历史数据和其他仍使用的管理数据 helper。
- [ ] 移除后台补发按钮、自动发邮件说明和推荐提示，移除前端把邮件失败当成审核失败的逻辑；换期提示改为“请求已保存，对方可在作者页面查看”。
- [ ] 删除只服务业务邮件的 helper、注入参数和无效测试；可选响应类型暂留兼容，不为此次收缩扩大成接口版本升级。
- [ ] 用真实 app/route + `SqliteD1Fixture` 验证审核通过、换期保存、旧接口停用，配置非空测试用邮件参数并捕获外部请求，断言没有调用邮件服务；审核状态、请求记录、历史事件符合预期。管理员身份只复用项目已有测试鉴权方式。
- [ ] 运行 `npm test -- worker/data/applications.test.ts worker/data/collaboration.test.ts src/admin/lib/application-review.test.ts`，并运行实际保留或新增的相关路由测试；删除的测试文件不列入命令。

## Task 3：文档与交付检查

**文件：** 更新 `readme.md`、`docs/product/accounts/participant-account-system.md`；核对 `docs/product/site/participation-rules-source.md` 和 `src/shared/activity-rules.ts` 是否仍承诺邮件通知，仅在确有承诺时修正文案与规则版本，不改写其他条款。

- [ ] 文档明确 Resend 仅服务邮箱登录验证码，QQ 及业务操作不依赖邮件；不暗示已经具备 QQ 消息推送。
- [ ] 运行 `npm run check`、`git diff --check`；已有测试通过后不重复扩展检查。样式或界面改动需要时仅查看截图。
- [ ] 本地提交范围仅包含这项变更，建议提交信息 `refactor: keep email delivery for sign-in OTP only`。报告实际命令与结果，真实邮件投递未验证；不部署。

## 完成标准

除用户主动请求邮箱登录验证码外，产品路径均不会发送邮件。审核结果和换期请求在现有工作台可见，邮件服务缺失不改变业务成功结果，历史记录保留。
