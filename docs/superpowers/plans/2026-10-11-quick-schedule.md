# Quick Schedule Implementation Plan

**Goal:** 管理排期页输入北京时间起点和分钟间隔，预览后一次保存空白标准格。

**Architecture:** 前端生成排期，复用现有 GET/PATCH 管理接口，不调整模型或依赖。已配置的标准格保留，但仍占序号对应的时间位置；追加格不参与。保存前重读服务端数据，发现时间已变则停止并重新预览。用户另外确认 PATCH 新增 `fill-empty-time` 模式，服务端仅原子补填空白标准格时间，并保持生效排期条件；不修改状态、说明、认领人或认领／释放记录。分次保存失败时保留已成功结果，并明确提示。

**Spec:** 用户本轮确认的快速排期方案。
**Tech Stack:** React、TypeScript、现有管理接口。

- [x] 新增 `src/admin/lib/quick-schedule.ts` 及精简行为测试，覆盖 24 格、跨日、保留已有时间与跳过追加格、非法输入。
- [x] 新增 `src/admin/components/QuickSchedule.tsx`，提供参数、预览、进度和部分失败提示；在 `AdminSchedulePage.tsx` 集成，未保存修改时禁用批量操作。
- [x] 经用户确认扩展 `src/shared/admin.ts` 及 `worker/data/admin.ts`，仅补时间模式使用单条条件 UPDATE；复用 `worker/data/admin.test.ts` 的 SQLite 夹具验证并发认领、并发填时间及元数据保留。只读复核无剩余重要问题。
- [x] `npm run check`、相关 Vitest（quick-schedule、creator-list、schedule-bootstrap、admin data）、`npm run build` 和 `git diff --check` 通过。查看桌面与手机静态组件样稿截图；未执行浏览器自动交互，未部署 staging、提交或创建 PR。
