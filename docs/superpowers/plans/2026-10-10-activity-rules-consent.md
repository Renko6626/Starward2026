# 活动规则与注册确认实施计划

**目标：** 实现用户已确认的独立规则页、注册确认和后端同意记录。

**设计：** [已确认方案](../specs/2026-10-10-activity-rules-consent-design.md)。沿用 React、TanStack Router、Better Auth、Worker 和 D1，使用账号创建钩子覆盖两种开户路径。

**工作区：** 保留当前工作区和运行中的开发服务，包含前面已经修改的指南与规则原稿；不覆盖实验目录或临时文件。

## 1. 规则与同意记录

- [x] 新增 `src/shared/activity-rules.ts`，提供当前版本、请求头名、确认文案和完整规则章节。
- [x] 新增 `migrations/0019_activity_rule_acceptances.sql` 与 `worker/data/activity-rule-acceptances.ts`，保存账号、版本、服务器时间。
- [x] 在 `worker/lib/password-auth.test.ts` 复用真实 D1 适配器和迁移，覆盖未同意、旧版本、记录写入失败、记录保存及旧账号登录；先运行失败用例再实现。
- [x] 修改 `worker/lib/auth.ts`，在开户前验证当前规则版本，在新账号创建后记录同意。验证码自动开户须覆盖，且缺少同意不消耗验证码。

## 2. 规则页与注册入口

- [x] 新增 `src/app/pages/RulesPage.tsx`、`src/app/pages/rules.css`、`src/routes/rules.tsx`。完整规则单独展示，标注版本，提供章节锚点。
- [x] 在 `src/portal/pages/PortalLoginPage.tsx` 添加默认未勾选的规则确认项，通过 SDK 的请求选项传递已同意版本。注册必选；验证码入口由后端区分已有账号和首次开户。
- [x] 指南和公共页脚添加规则链接，指南不放完整规则。

## 3. 本地准备与验证

- [x] 更新迁移说明、规则原稿的展示状态和待办。
- [x] `npm run check`，运行现有认证、账号与注册校验相关测试；`git diff --check`。
- [x] 应用本地新增迁移，保留现有数据；必要时短暂停止并恢复 `npm run dev`。
- [x] 查看规则页、指南和注册页截图，验证正文、确认项、链接与版式；不自动点击或填写表单。
- [x] 对照设计复查源码、测试证据、迁移影响和当前开发服务状态。

## 验证结果

- `npm run check`：通过。
- `npm test -- worker/lib/password-auth.test.ts worker/lib/auth.test.ts worker/lib/portal-access.test.ts src/portal/lib/onboarding.test.ts src/portal/lib/registration-validation.test.ts src/shared/email-otp.test.ts`：通过。
- `git diff --check`：通过。
- `npx wrangler d1 migrations apply starward2026 --local`：0019 已成功应用，现有本地数据保留。
- 规则页桌面/手机、注册页手机和指南桌面截图已查看，没有横向溢出；注册确认框默认未勾选，规则链接在新标签页打开。
- 独立只读审查发现 OTP 请求的额外 `type` 参数会跳过前置校验并消耗验证码，已用现有实际认证用例复现并修正。最终用例确认缺少同意和旧版本均保留验证码，新旧账号分别导航。
- Better Auth 不同阶段的 context 引用不保持一致；新账号标志改由前置钩子覆盖请求局部标记，再在成功响应的后置钩子返回。用例也覆盖已有账号伪造标记的情况。
- 未执行浏览器自动交互测试、远端迁移或部署。

## 第二版文案验证

- 按用户确认的纪念册发行与生成式 AI 口径整理规则，版本更新为 `2026-10-10-v2`；注册提示与后端校验同步使用新版本，更新日期单独保留为有效日期。
- `npm run check`、`git diff --check`：通过。
- `npm test -- worker/lib/password-auth.test.ts worker/lib/auth.test.ts src/portal/lib/onboarding.test.ts`：通过，包含旧版本拒绝、最新版本记录及验证码开户校验。
- 新版规则页桌面和手机、注册页手机截图已查看，没有横向溢出；纪念册条款靠前并突出显示，注册确认默认未勾选。
- 此轮未自动点击或填写浏览器表单，未执行远端迁移或部署。
