# Turnstile Authentication Implementation Plan

**Goal:** 保护注册／登录发码、重置发码、密码登录及既有报名提交。
**Architecture:** 复用 Better Auth 1.6 captcha 插件和已有 Turnstile 加载器，无新依赖或数据模型。公开 providers 响应补充启用状态；前端从现有 `VITE_TURNSTILE_SITE_KEY` 读取公开 key，Worker secret 开启服务端验证。共用可重试的验证组件，每次受保护请求结束后刷新一次性 token，OTP 验证、设置密码与重置提交不重复要求验证码。
**Spec:** 用户已确认“验证码发送、密码登录和报名提交”及公开 key 部署配置。
**Tech Stack:** React、Better Auth 1.6、Cloudflare Turnstile。

- [x] 接入 native captcha 并复用真实 auth handler/SQLite 夹具验证缺失、失败、重放、服务不可用和成功路径。native 1.6 URL 子串匹配会误拦 OTP 验证，回归用例先失败，增加精确路径匹配后通过。
- [x] 提取共享验证组件，接入登录、重置和报名，处理过期、加载失败、重试、模式切换和未加载配置。审查发现步骤切换后控件未重挂，已将登录 mode/step 纳入验证上下文，并在重置页“使用其他邮箱”时重置。
- [x] CI 注入公开 Site Key；更新配置说明，不提供或发布真实密钥。
- [x] `npm run check`、`npm test`、`npm run test:deploy`、`npm run build`、`git diff --check` 通过；查看桌面／手机关闭验证首屏，以及模拟开启但缺公钥的手机提示截图。只读复核无剩余重要问题；未进行浏览器点击或填表，未验证真实 CF widget、密钥与线上域名，不自动提交、推送或部署。
