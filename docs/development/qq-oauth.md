# QQ OAuth 接入与上线准备

本站沿用 Better Auth、Workers 和 D1。当前上线入口为邮箱验证码验证后开户并设置密码、密码登录和邮箱验证码登录，QQ 默认关闭，待授权审核和联调完成后再开放；当前页面不显示 QQ 登录或绑定入口。工作台只填写联系方式种类与内容，可选择邮箱作为联系渠道，不自动沿用登录邮箱。旧联系邮箱字段和数据保留兼容，不再提供独立输入。审核与换期状态在工作台查看，邮件用于主动请求的注册、登录与密码重置验证码；注册和登录使用 `sign-in`，重置使用 `forget-password`。

## 配置

| 服务端变量 | 用途 |
| --- | --- |
| `QQ_OAUTH_ENABLED` | 默认 `false`；准备完应用与域名后设置为 `true` |
| `QQ_APP_ID` | QQ 互联网站应用的 AppID |
| `QQ_APP_KEY` | QQ 互联 AppKey，使用服务端 secret 配置 |
| `BETTER_AUTH_URL` | 已确认的站点 origin，不带 `/api/auth` |
| `BETTER_AUTH_SECRET` / `DB` | 原有认证密钥和 D1 绑定 |

QQ 网站应用登记的回调为 `https://<已确认域名>/api/auth/oauth2/callback/qq`。授权和换 token 使用同一个地址。仅请求 `get_user_info`，不需要 QQ 群机器人或消息推送权限。

本地使用被 Git 忽略的 `.dev.vars`；真实授权应在 QQ 平台允许的域名上测试。不要把本机 localhost 或临时预览域假定为已登记回调，不要把 AppKey 放在 `VITE_` 变量、仓库或聊天里。

Cloudflare secrets 使用所选环境的 `wrangler secret put QQ_APP_KEY`；AppID 和开关可放相同环境的非秘密 vars。环境需先确认，本文不自动执行配置或部署。`env.production` 仍有数据库和域名占位值，须填好后才可使用。`GET /api/auth/providers` 只暴露 QQ 配置是否启用，关闭或凭据不完整时邮箱入口继续可用。

## 身份与现有账号

QQ 的 AppID + OpenID 保存在现有 account 表，同一个 QQ 应用身份只能关联一个网站用户。QQ-only 账号用哈希生成的 `.invalid` 标识兼容认证层的邮箱字段；业务资料、报名、名册和公开作品不使用该标识。

已有邮箱账号要先用原登录方式进入，再主动绑定 QQ。未绑定就用 QQ 首次开户会得到独立账号；本期不提供自动合并和解除唯一 QQ 登录方式。QQ 授权不返回真实 QQ 号，用户填写的联系号码不作为登录身份。

首次 QQ 开户须同意当前规则，版本在受保护的 OAuth state 中保存并在回调时校验。状态过期、重放、跨浏览器或规则更新均拒绝开户。开户后的账号、会话或工作台写入失败会清理此次新身份，用户可重试；既有账号不会被删除。

## 迁移顺序

1. 确认目标数据库和站点、备份已有数据。
2. 应用迁移 `0020_qq_optional_contact_email.sql`。它会重建业务表以允许邮箱为空，保留子表数据、排期关联和触发器；不要使用 reset 代替升级。
3. 部署新应用，保留 `QQ_OAUTH_ENABLED=false`。旧应用假设邮箱非空，不能在出现 QQ 用户后直接回退旧代码。
4. 配置 QQ 应用、已登记回调、AppID、AppKey 后启用开关。
5. 人工检查首次开户、返回登录、旧账号绑定和手机授权，再开放给参与者。

关闭 QQ 开关会停止 QQ 入口，既有 QQ-only 用户也无法用 QQ 登录；如需限制新开户而保留既有用户登录，需另行增加该控制，不用关闭整个 provider 代替。不要删除账号、绑定关系或把旧会话失效当作回滚步骤。

## 本次验证及仍需联调项

本地测试调用真实 Better Auth handler 和生产 D1 SQL，只替换 QQ/Resend 的外部 HTTP 响应，覆盖开户、重复登录、绑定、归属冲突、授权 state、失败清理、无邮箱报名及审核、业务邮件停用和登录 OTP。

迁移已在独立本地 Wrangler D1 中演练：先应用 0019 前的全部迁移，写入真实生产逻辑生成的关联样本，再执行 0020。核对账号、会话、规则记录、资料、报名、参与者、作品、排期、交换与事件数据，外键检查通过。日常本地库及远端库未变更。

真实 QQ 网站应用审核、正式 AppID/AppKey、登记域名的授权回调、移动端 QQ 授权和真实验证码投递需要人工联调。本次未部署，不把受控响应测试当作 QQ 平台验收。

交付前还在独立 PR 文件快照中验证了依赖锁文件、类型检查、完整测试及构建。QQ 入口桌面/手机截图在受控可用状态下查看，没有自动点击或填写表单；实际 QQ 授权仍需上述人工联调。


## 邮箱验证注册与发送限制（2026-10-11）

新邮箱先经 `sign-in` OTP 验证后开户，再调用 `/api/auth/set-password` 设置密码。直接密码注册禁用，密码登录要求邮箱已验证。无需新增数据库迁移，保留 Better Auth 1.6.2。

`AUTH_OTP_IP_RATE_LIMITER`（每 60 秒 10 次）和 `AUTH_OTP_EMAIL_RATE_LIMITER`（每 60 秒 1 次）已声明在 Wrangler 顶层、staging 和 production；邮箱规范化并以 SHA-256 生成限流 key，注册、登录与密码重置入口共用配额。使用 Cloudflare 可信的 `cf-connecting-ip`；本地开发显式允许本地 origin 时可使用 loopback。缺少绑定、可信 IP 或 Resend 配置时返回 503，触发配额返回 429 与 60 秒重试提示。Cloudflare 原生限流适合短期防滥用，其计数按 Cloudflare 位置维护，不能视为严格的全球邮件发送总额。

旧未验证邮箱账号需先 OTP 补验，业务记录保留，旧登录凭据和会话撤销后重新设置密码。已验证账号 OTP 登录不重设已有密码。QQ-only 的内部 `.invalid` 身份不受邮箱补验门槛影响。真实邮箱收件、外部邮件服务和 Cloudflare 线上限流仍需部署后的人工验证，本地 handler 测试不等于投递验收。


### 邮件密码重置

注册／登录与密码重置邮件共用 `worker/lib/auth-email.ts` 的 NASAPUNK HTML 模板，并保留纯文本版本。邮件包含逐星巡礼名称、现有月相 logo、验证码、有效期、账号操作按钮及网站链接。图片与链接使用 `BETTER_AUTH_URL` 的站点 origin；未配置时使用当前请求 origin。重置按钮进入 `/portal/login?reset=password`，链接不携带验证码。邮件客户端可能屏蔽远程图片，验证码和项目名称仍以文字显示。

已开放原生 `/email-otp/request-password-reset` 和 `/email-otp/reset-password`，也允许 `send-verification-otp` 的 `forget-password` 用途，均接入同一发码限制。旧 `/forget-password/email-otp` 别名仍关闭，不开放邮箱变更或验证链接功能。密码重置配置 `revokeSessionsOnPasswordReset=true`；旧未验证账号完成重置时只清理外部绑定和旧会话，保留原生 handler 刚写入的新密码。
