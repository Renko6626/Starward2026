# QQ 优先登录与邮件收缩设计草案

日期：2026-10-10。分支：`feat/qq-oauth`，基于 `origin/main` 的 `6ee5680`。

状态：用户随后确认按本方案直接实施，并要求完成后开 PR。QQ 优先、邮箱选填、旧账号使用 Better Auth 现成绑定能力，以及仅保留登录验证码邮件均已实施；真实 QQ 平台授权及远端上线尚未执行。

## 1. 用户目标

- 新参与者可以直接通过 QQ 授权建立账号，无需先注册或验证邮箱。
- 后续以 QQ 一键登录为主要入口；首次仍受 QQ 自身授权确认约束。
- 保留现有邮箱密码和邮箱验证码入口，已有账号、报名、作品、排期继续可用。
- 邮箱作为选填联系方式，填写联系邮箱不等于添加邮箱登录方式。
- 邮件仅用于用户主动请求的邮箱登录验证码。审核通过、邀请、换期均不发邮件，即使配置了 Resend。
- 使用现有工作台展示审核和交换请求状态；本次不建设 QQ 消息推送、群机器人或独立通知系统。

## 2. 已核查的现状

主线使用 React、Hono、Cloudflare Workers、D1、Better Auth。`renko-dev` 上的 Node/SQLite/VPS 部署尚未合入；此计划不包含它的整合。

- `worker/lib/auth.ts` 仅配置邮箱密码和 Email OTP。开户必须通过活动规则版本校验。
- 本地安装的 Better Auth Generic OAuth 支持自定义 `getToken`、`getUserInfo`、显式账号绑定，以及受保护的 OAuth state；回调要求用户资料中存在邮箱。
- QQ 标准用户资料接口不提供邮箱或真实 QQ 号，不能用昵称、头像或用户填写的 QQ 号关联现有账号。
- `user.email`、`applications.contact_email`、`portal_profiles.contact_email`、`participants.invite_email` 目前必填；报名写入会用认证邮箱覆盖联系邮箱。
- 审核通过发信位于 `worker/lib/participant-admin.ts`；手动补发位于 `worker/routes/admin.ts`；换期发信位于 `worker/routes/portal.ts`。
- staging 只读请求返回 Cloudflare 403 / 1010；没有验证线上代码版本、数据库迁移状态或 QQ 应用资质。

## 3. 推荐的认证与数据方案

沿用 Better Auth + Workers + D1，在 `genericOAuth` 中添加 QQ provider，不更换运行时或增加身份服务。

| 身份／资料 | 建议存储和用途 |
| --- | --- |
| 网站账号 | 现有 `user.id`；所有登录方式共同指向它 |
| QQ 登录身份 | 现有 `account`，`providerId = qq`，`accountId` 包含 AppID 与 OpenID，按现有唯一约束防重复 |
| QQ 账号的认证邮箱字段 | `SHA-256(AppID + ':' + OpenID)@qq.starward.invalid`，仅作为 Better Auth 内部兼容标识，`emailVerified = false` |
| 真实联系邮箱 | `portal_profiles.contact_email` 选填；没有时为 NULL，不存兼容标识 |
| 报名联系邮箱 | `applications.contact_email` 选填，保存真实联系邮箱快照 |
| 历史邮箱邀请 | `participants.invite_email` 改为允许 NULL，保留旧值及非空唯一约束；QQ 直接开户为 NULL |
| 参与者业务身份 | 现有 `participants.id`，以 `user_id` 关联账号，排期与作品继续依赖参与者 ID |

业务 DTO 中 `email`、`contactEmail`、`inviteEmail` 根据用途允许为 `string | null`。内部标识不出现在工作台、后台名册、业务响应或公开作品中；Better Auth SDK 的会话字段只用于读取登录态，禁止拿来填联系表单。任何 `.invalid` 地址都不能进入发信或邮箱登录入口。

旧邮箱账号的认证邮箱不变；绑定 QQ 后不覆盖其邮箱、署名和业务身份。关闭隐式账号合并，只允许在有效会话内主动绑定。QQ OpenID 已属于其他账号时拒绝绑定，不能转移归属。

替代路线是另建纯 QQ 认证层，直接以 OpenID 管理账号与会话。它能消除认证邮箱兼容字段，但需要新增会话及安全维护责任，改动明显更多；推荐本次沿用现有认证层。

## 4. 登录与绑定流程

新用户先明确同意规则，再发起 QQ 授权。服务端将当前规则版本写入 Better Auth 保护的 state；回调验证 state 后，开户钩子读取 `getOAuthState()`，重新核对规则版本并保存同意记录。规则在授权期间更新时要求重新开始，不能沿用旧版本开户。

未勾选同意也可以发起“已有账号登录”，但不得自动开户：QQ provider 设置 `disableImplicitSignUp: true`，只有经服务端校验同意的请求可以携带 `requestSignUp: true`。已存在 QQ account 的登录不要求补历史同意记录。开户或同意保存失败不得留下账号、QQ account、参与者或有效会话。

首次开户建立一个 `pending` 参与者，返回现有工作台完成资料与报名。QQ 昵称可以作为初始账号名字，不自动覆盖作品署名，也不赋予审核通过资格。

已有邮箱账号在有效会话内点击“绑定 QQ”，使用 Generic OAuth 的显式绑定流程。服务端校验发起会话、受保护 state 和目标账号归属；禁止根据邮箱、QQ 号或昵称自动认领其他账号。取消授权或绑定失败保持原有登录方式可用。

本期不提供自动合并两个已建立的账号，不提供解除唯一 QQ 登录方式，不把选填联系邮箱直接升级为认证邮箱。重复开户等特殊情况由主催核对，另外设计账号恢复或合并工具。

## 5. 邮件范围

唯一允许的发送类型是 Email OTP 的 `sign-in`。服务端前置校验和发送回调都拒绝 `email-verification`、`forget-password`、`change-email`，不只隐藏按钮。

删除审核通过和换期的发信调用。后台不再展示“自动发送通过提醒”或“补发通过提醒邮件”。旧手动补发接口保留路径，返回 `410` 和 `email_notifications_disabled`，不发信、不写发送记录。

业务响应不再生成“已发送邮件”或“邮件失败”；旧可选 `notification` 字段可暂留类型兼容，但新响应省略它。历史 `invite_sent` 事件原样保留。审核成功、时段交换成功以数据库业务结果为准，不依赖邮件服务。

用户主动选择邮箱验证码登录时仍使用 Resend。没有 Resend 时，邮箱验证码显示不可用，QQ 登录与业务操作继续可用。收缩邮件是独立变更，可在 QQ 接入前实施。

## 6. 配置与接入边界

建议配置 `QQ_OAUTH_ENABLED`、`QQ_APP_ID`、`QQ_APP_KEY`。AppKey 仅存服务端 secret，不使用 `VITE_` 前缀，不进入日志、计划或前端包。

使用网站应用 Authorization Code 流程，服务端兑换 token，获取并核对 OpenID/AppID，再读取 `get_user_info`。最小授权范围为 `get_user_info`；不依赖 OIDC discovery，不请求额外社交能力。

建议回调为 `https://<已确认域名>/api/auth/oauth2/callback/qq`。授权请求、换 token 和 QQ 平台登记必须一致，不能现在就把 production 模板或临时预览域当作真实回调。客户端回跳限定同站路径。

QQ 开关默认关闭。开关关闭或凭据不完整时不注册 provider；其他登录方式不受影响。建议增加只返回 `{ qq: { enabled: boolean } }` 的 `GET /api/auth/providers`，用于展示入口状态，不暴露配置值。

实现时复用当前安装版本的公开 API。若发现必须升级 Better Auth、调整运行时或额外建表保存 OAuth 状态，先提交新的决策点。

## 7. 数据迁移与验收边界

不修改历史迁移；新增 `0020_qq_optional_contact_email.sql`（若编号已被占用，按当前顺序递增）。仅放宽三个业务邮箱字段；认证表保持现有约束。必须保留账号、会话、报名、资料、参与者、作品、排期、交换请求、规则同意和历史事件。

D1 重建父表会触发外键的 CASCADE/SET NULL；`defer_foreign_keys` 不会关闭这些动作。因此不得直接复制旧迁移的 `foreign_keys = OFF` 做法。迁移计划应先快照依赖数据、移除会改变数据的触发器和受级联影响的子表，再重建和恢复，最后检查外键及关联；具体顺序见实施计划。

永久测试只覆盖具体新增行为和迁移保全风险，复用 `SqliteD1Fixture`；外部 QQ 请求可替换为受控响应，账号、会话、同意和业务写入必须调用真实生产逻辑。页面最多截图查看，不执行浏览器自动点击或填表。真实 QQ 授权最终由人工在已登记的测试域验收。

## 8. 实施前决策

- [x] 确认采用现有 Better Auth + 内部兼容标识，业务联系邮箱允许 NULL，作为 QQ 无邮箱开户方案。
- [x] 确认当前 Worker 路线为本次接入目标；若实际目标是 VPS，另行处理 `renko-dev` 整合。
- [ ] 确认 QQ 应用类型、测试及正式域名、回调配置、服务端凭据存放位置；不在聊天或 Git 中粘贴 AppKey。

## 9. 计划与依据

- [仅保留登录验证码邮件](../plans/2026-10-10-login-only-email.md)
- [QQ OAuth 接入计划](../plans/2026-10-10-qq-oauth.md)
- [QQ 授权码流程](https://wiki.connect.qq.com/使用authorization_code获取access_token)
- [QQ OpenID](https://wiki.connect.qq.com/获取用户openid_oauth2-0)
- [QQ 用户资料](https://wiki.connect.qq.com/get_user_info)
- [Better Auth Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth)
- [Cloudflare D1 外键](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [D1 SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
