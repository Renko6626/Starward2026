# 邮箱先验证注册实现计划

> **For agentic workers:** Use superpowers:executing-plans to implement the confirmed route in this session. Respect AGENTS.md's test scope and architecture approval requirements.

**Goal:** 邮箱经 OTP 验证后开户、设置密码，服务端封住直接密码注册并限制发码频率。

**Architecture:** 保留 Better Auth 1.6.2、Email OTP、Workers、D1 与 Resend。复用 `/sign-in/email-otp` 和 `/set-password`，注册与验证码登录共用同一发码限制。新增两个 Cloudflare RateLimit 绑定，邮箱每 60 秒一次、IP 每 60 秒十次；不新增数据库表、不升级依赖。

**Tech Stack:** 现有 React、Better Auth、Hono、Cloudflare Workers/D1。

**Spec:** 用户已确认“邮箱 → 验证码 → 设置密码 → 进入”的方案 2。

## Global Constraints

- 规则同意、时段参数和首次开户跳转保留。
- 未验证邮箱不能密码登录、设置密码或访问作者业务接口；QQ 兼容标识不按邮箱补验处理。
- 旧未验证邮箱账号通过有效 OTP 后，保留用户与业务记录，撤销旧会话及未经邮箱验证建立的所有登录凭据（包括外部绑定），要求重新设置密码；错误或过期 OTP 不改变账号。QQ-only 内部兼容身份不经过此流程。
- 已验证账号的 OTP 登录不改已有密码，不重复开户。
- 新验证码开户成功后，响应头告知客户端是否需要设置密码；设置期间阻止自动跳转。刷新入口页时从会话及 credential 记录恢复密码步骤；QQ 绑定回调在写入后检查原会话，撤销与回调交叠时清理本次绑定。
- 仅测试已有生产认证接口的关键行为，页面只截图；不部署、不创建 PR、不自动提交本轮改动。

## Review Focus

- 直接调用密码注册接口不能绕过 OTP。
- 无效、过期、重放验证码不能开户或修改旧凭据。
- 旧会话补验前不能绕过邮箱验证访问报名资料。
- 同邮箱切换大小写、切换注册/登录入口不能绕过发送限额。
- 已验证旧账号及规则同意记录保持稳定，密码设置不产生第二个用户或工作台。

## Tasks

- [x] 服务端与接口测试：修改 `worker/lib/auth.ts`、`worker/lib/types.ts`、`worker/lib/password-auth.test.ts`，复用现有 SQL 夹具；新增局部 `worker/lib/auth-rate-limit.ts` 封装 CF 发码限制。调整 QQ 和邮件策略测试中的开户准备，使用真实 OTP handler。
- [x] 页面与配置：修改 `PortalLoginPage.tsx` 为邮箱/验证码/密码三步；共享响应头与 60 秒倒计时；在 Wrangler 顶层、staging、production 配置两个认证限流绑定并生成类型。
- [x] 文档与验证：同步当前账号及开发文档；运行相关测试、类型检查、构建，截图检查注册首屏；进行一次只读代码审查。


## Verification

- `npm run check`、`npm test`、`npm run build` 通过；构建仅有现有大包提示。
- 桌面及 390px 注册首屏已截图查看；没有执行浏览器点击或填表测试。
- 只读审查发现并修复入口刷新跳过密码步骤、QQ 待完成绑定与会话撤销交叠两处问题；两个 QQ 回归用例先失败后通过，复核无剩余阻碍项。
- 未验证真实邮箱投递或 Cloudflare 线上配额；本轮未提交、推送、部署或创建 PR。


## Follow-up: 邮件密码重置（用户已授权）

- [x] 复用现有原生重置接口与 `forget-password` OTP，共用 IP/邮箱发码限额，不新增模型、依赖或迁移。
- [x] 输入登录邮箱后填写重置验证码与新密码，成功后撤销旧会话并回到密码登录；登录页与账号密码设置提供入口。
- [x] 接口测试覆盖正常重置、短密码后继续使用同一码、旧会话失效、未知邮箱、共享限流、邮件失败、验证码过期/用途/尝试耗尽及旧未验证账号资料保留。
- [x] 最终检查和截图：类型检查、全部测试与构建通过，查看手机及桌面重置首屏；只读复核无阻碍项。

## Follow-up: 邮件样式（用户已授权）

- [x] 注册／登录及重置邮件使用同一套 NASAPUNK HTML 模板，复用项目名称和 logo，突出验证码，提供账号页面及主页链接；保留纯文本版本。
- [x] 生成演示验证码样稿并截图检查桌面及手机尺寸；相关真实 handler 用例检查发信内容、logo 和操作链接。
