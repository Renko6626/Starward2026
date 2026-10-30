# 完整作品投稿与审核 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current session. Steps use checkbox (`- [x]`) syntax for tracking. 用户若明确选择委派，再使用 superpowers:subagent-driven-development；本计划不自行授权并行 agent。

**Goal:** 作者在个人工作台醒目地提交完整作品版本、查看审核状态与主催意见；管理员查看所有作者的最新稿并开展有版本依据的内容审核。

**Architecture:** 沿用每位参与者一份 `project_drafts` 作品容器、现有私有 R2 和分片上传。D1 增加完整投稿版本、版本审稿记录，文件固定关联版本；新记录作为审核权威来源，用集中投影衔接既有公开作品流程，不重建作品主表。

**Tech Stack:** TypeScript、React 19、TanStack Router、Hono、Cloudflare Workers/D1/R2、Zod、Vitest；不新增依赖。

**Spec:** [完整设计](../specs/2026-10-31-work-submission-review-design.md)。执行者先读设计及本计划，两者共同约束实施。

## Global Constraints

- 暂不设置首交或修订的时间 cutoff，不因活动开始、结束或旧截止日期自动禁止投稿。
- 每次正式提交都是一个完整版本。上传文件不等于正式提交；点击提交后，版本内容固定。
- 审稿意见保存后作者直接可见，不增加内部备注、意见发布审批或邮件通知系统。
- 上传、正式提交、版本查看、审核状态及意见均进入作者个人工作台 `/portal/`，位置醒目，最新意见直接展开。
- 首次通过版保留为审核基准；通过后的小修沿用通过结论并显示更新，明确复审结论可改变当前状态。
- 单文件沿用 500 MiB，分片沿用 8 MiB；每版至少一个完成上传的本人文件。
- 不新增存储供应商、后台队列、幂等令牌、自动重试、差异算法、转码、在线编辑器或一人多作品模型。
- 采用新迁移，保留旧数据、R2 文件、作者与排期关系、已有公开时间及撤下保护，不修改已执行迁移。
- 技术路线已确认；若实施中必须改变技术栈、重要模块边界、存储方案或扩大功能，先报告用户，不由实现者自行扩展。
- 默认不执行浏览器自动点击、填表或交互 E2E；UI 验证仅截图。文案和样式不新增永久测试。
- 本文最初交付为计划；用户随后授权在 `feat/submission-and-review` 实施。下方任务完成情况及实际验证见文末执行记录。

## Review Focus

1. 作者尚未正式交稿：上传成功也应显示未提交，管理端不能漏掉该作者。由 Task 2、Task 3 的真实 D1 用例覆盖。
2. 审核依据与最新稿不同：通过 V1 后提交 V2，保持通过、标明依据 V1；明确退回 V2 后交 V3 要待审。由 Task 1 的状态规则及 Task 3 的持久化用例覆盖。
3. 已提交文件或跨作者文件：不可删除、不可改挂、不可成为别人版本的附件；本人和管理员仍可下载。由 Task 2 路由测试覆盖。
4. 历史日期或意见为空：活动后仍可投稿；需修改／未通过缺理由时拒绝保存，普通意见不改变结论。分别由 Task 2、Task 3 覆盖。
5. 审核资料误入公开端：小修及意见不覆盖公开快照，旧已公开作品保留，撤下后不自动恢复。由 Task 4 的既有公开作品测试覆盖。

## 基线、工作区与提交边界

- 当前 `main` / `96cd0ac`，与 `origin/main` 一致；远端上传分支已通过 PR #20 合入。
- `feat/i18n` 含尚未合入的英文版；本轮不合并。实施若改以其他已确认分支为基线，需要重新核对这里列出的入口和类型。
- 已有未跟踪目录 `.superdesign/`、`experiments/station/history-comparison/`、`temp/` 不属于本次改动，不清理、不加入提交。
- 实施开始时按 `superpowers:using-git-worktrees` 检查已有隔离工作区。推荐分支 `feat/work-submission-review`，不要直接在当前 `main` 上开始业务改动。
- 六个任务顺序执行，共用契约在 Task 1 固定，避免并行改写大路由文件。每完成一个可验证任务可独立提交；不推送、不创建发布 tag、不执行生产迁移。

## 文件职责

| 文件／区域 | 本次职责 |
| --- | --- |
| `src/shared/work-submissions.ts`（新增） | 投稿、意见、摘要类型、请求校验及唯一状态计算 |
| `migrations/0025_work_submissions.sql`（新增） | 两张业务表、文件版本关联、清空投稿窗口结束时间 |
| `worker/data/work-submissions.ts`（新增） | 版本读写、审稿读写、统一摘要、公开快照投影 |
| `worker/routes/work-submissions.ts`（新增） | 作者投稿与版本查询路由，沿用当前认证边界 |
| `worker/routes/work-files.ts`、`worker/data/work-files.ts` | 复用上传；区分暂存文件和已提交文件，固定历史稿 |
| `worker/routes/admin.ts`、`worker/data/admin.ts` | 管理端版本查询、意见写入、全体作者列表与筛选摘要 |
| `worker/data/project-drafts.ts`、`worker/data/relay-publication.ts`、`worker/data/works.ts` | 退役旧写入口，对接审核投影和既有公开发布 |
| `src/portal/components/WorkSubmissionSection.tsx`（新增） | 工作台作品主面板、编辑区、最新意见、版本查看 |
| `src/portal/components/WorkFilesSection.tsx` | 将上传能力改为可嵌入投稿编辑区的暂存文件组件 |
| `src/portal/pages/PortalOverviewPage.tsx`、`src/portal/components/RegistrationProgress.tsx`、`src/portal/archive.css` | 醒目位置、锚点、状态刷新、手机布局 |
| `src/admin/pages/AdminProjectDraftsPage.tsx`、`AdminProjectDraftDetailPage.tsx`、`src/admin/components/AdminWorkFiles.tsx` | 统一状态、最新稿优先、按版本文件及审稿表单 |
| `src/shared/windows.ts`、`worker/data/event-windows.ts`、`worker/lib/windows.ts`、`src/admin/pages/AdminEventWindowsPage.tsx` | 保留手动启用／开始时间，投稿窗口不再设置结束时间 |
| `src/shared/activity-rules.ts`、`src/app/components/MissionCountdown.tsx`、相关规则与交付文档 | 去掉投稿硬截止及误导文案，保留接力开始时间 |

## 共用契约

以下名称在各任务间保持一致，避免前后端分别发明状态。

```ts
type WorkReviewStatus = 'not_submitted' | 'pending' | 'changes_requested' | 'approved' | 'rejected';
type WorkReviewDecision = 'changes_requested' | 'approved' | 'rejected';

type WorkSubmissionSummary = {
  id: string; versionNumber: number; title: string; workType: WorkType;
  summary: string; versionNote: string | null; submittedAt: string; fileCount: number;
};
type WorkSubmissionReview = {
  id: number; submissionId: string; versionNumber: number;
  feedback: string | null; decision: WorkReviewDecision | null; createdAt: string;
};
type WorkSubmissionDetail = WorkSubmissionSummary & {
  files: WorkFile[]; reviews: WorkSubmissionReview[];
};
type WorkReviewSummary = {
  status: WorkReviewStatus;
  decisionSubmissionId: string | null;
  decisionVersionNumber: number | null;
  hasUpdatesAfterReview: boolean;
};
type WorkSubmissionWorkspace = {
  draftId: string; review: WorkReviewSummary;
  latest: WorkSubmissionDetail | null;
  firstApprovedSubmission: WorkSubmissionSummary | null;
  versions: WorkSubmissionSummary[];
  latestFeedback: WorkSubmissionReview | null;
  pendingFiles: WorkFile[];
  window: EventWindowSummary;
  legacyFeedback: string | null;
};
type CreateWorkSubmissionInput = {
  title: string; workType: WorkType; summary: string;
  versionNote?: string; fileIds: string[];
};
type CreateWorkSubmissionReviewInput = {
  feedback?: string; decision?: WorkReviewDecision;
};
```

`WorkType`、`WorkFile`、`EventWindowSummary` 均复用已有类型。接口序列化不向作者返回管理员邮箱；`reviewed_by` 仅在数据库保存。状态函数为 `summarizeWorkReview(latestVersion: number | null, lastDecision: { submissionId: string; versionNumber: number; decision: WorkReviewDecision } | null): WorkReviewSummary`。

数据层主要函数：

- `getWorkSubmissionWorkspace(db: D1Database, draftId: string): Promise<WorkSubmissionWorkspace>`。
- `getWorkSubmissionDetail(db: D1Database, draftId: string, submissionId: string): Promise<WorkSubmissionDetail | null>`。
- `createWorkSubmission(db: D1Database, participantId: string, input: CreateWorkSubmissionInput): Promise<WorkSubmissionMutationResult>`。
- `createWorkSubmissionReview(db: D1Database, draftId: string, submissionId: string, input: CreateWorkSubmissionReviewInput, reviewedBy: string): Promise<WorkSubmissionMutationResult>`。
- `WorkSubmissionMutationResult` 沿用项目现有可判别结果习惯：成功 `{ ok: true, workspace, message }`；失败 `{ ok: false, status, code, message }`。路由映射到当前 JSON 错误格式，不另建错误框架。

### Task 1: 固定投稿契约、状态规则和数据结构

**Files:** 新增 `src/shared/work-submissions.ts`、`src/shared/work-submissions.test.ts`、`migrations/0025_work_submissions.sql`；修改 `migrations/README.md`。新增 `worker/data/work-submissions.test.ts` 并复用 `worker/test/sqlite-d1.ts`，不创建另一套数据库夹具。

**Interfaces:** 产出上方所有共用类型、两个请求 schema（`createWorkSubmissionSchema`、`createWorkSubmissionReviewSchema`）及 `summarizeWorkReview`。此任务不写 HTTP 路由。

- [x] 按设计添加新迁移：`work_submissions`、`work_submission_reviews`、`work_files.submission_id` 及必要的所属版本索引；`work_upload_open.closes_at` 清空，保留其启用状态和开始时间。实施前确认 0025 未被占用。
- [x] 用现有夹具从 `0024_work_files.sql` 的真实旧库升级，断言旧文件仍未归版、旧公开时间／双状态／反馈／对象 key 原值保留，结束时间清空；执行 `PRAGMA foreign_key_check` 无记录。不要为旧资料伪造完整投稿或通过记录。
- [x] 实现共用 schema：标题 trim 后 1—120，简介 1—1600，版本说明最多 2000；`fileIds` 至少一项且去重校验；无结论的空意见及需修改／未通过的空理由拒绝。
- [x] 实现状态函数，并用短用例断言：无版本 → 未提交；V1 无结论 → 待审；V1 通过后 V2 → 通过且依据 V1、有更新；V2 需修改后 V3 → 待审；V2 未通过 → 未通过。输入和预期字面量独立给出，不复制计算公式。
- [x] 运行 `npm test -- src/shared/work-submissions.test.ts worker/data/work-submissions.test.ts`，确认通过后提交此任务文件。

### Task 2: 作者完整版本提交、文件固定与无 cutoff

**Files:** 新增 `worker/data/work-submissions.ts`、`worker/routes/work-submissions.ts`、`worker/routes/work-submissions.test.ts`；修改 `worker/routes/portal.ts`、`worker/routes/work-files.ts`、`worker/data/work-files.ts`、`worker/routes/work-files.test.ts`、`worker/data/event-windows.ts`、`worker/lib/windows.ts`、`src/shared/windows.ts`、`worker/lib/event-window-update.test.ts`。

**Interfaces:** 消费 Task 1 类型。产出作者三项 API，以及数据层的查询和 `createWorkSubmission` 函数。最新版本按 `version_number DESC`，版本内意见按整数 ID 排序。

- [x] 为数据层创建完整 V1/V2 写真实 D1 用例：版本号递增、每版只含本次完整文件集合、V1 内容不随 V2 改变；完成上传但未提交时仍是未提交。
- [x] 实现提交的核心校验：已获参与资格、手动窗口开放、至少一个完整本人文件、文件 ID 唯一且均未归版。元数据快照、版本创建、文件归版及一条操作记录放在同一 D1 batch 内；不搬动 R2 对象。
- [x] 在 batch 写入时保留文件归属及未归版的条件，失败返回现有风格 409 刷新提示。事务不留半个版本；不增加自动重试或幂等令牌。
- [x] 作者三项路由绑定当前账号的作品容器，复用现有初始化和权限逻辑；不能通过 URL 中别人的版本 ID 访问。写请求按现有上传路由检查 Origin。
- [x] 修改文件查询：暂存列表仅返回 `submission_id IS NULL` 的完成文件；版本详情只返回该版文件。删除已归版文件返回 409（`submitted_file_locked`），本人和管理员仍可下载。
- [x] 保留上传的 500 MiB／8 MiB、进度、取消及失败提示。窗口关闭后仍可取消未完成上传；未归版已完成文件的删除沿用手动窗口规则，不动版本文件。
- [x] 投稿窗口统一忽略结束时间，并在更新该窗口时拒绝非空 `closesAt`；开始时间、启用状态继续生效。其他窗口逻辑完全复用现有行为。
- [x] 扩展现有上传路由用例：提交后删除拒绝且仍可下载；跨作者／未完成文件不能提交；2026-11-13 及旧结束日期之后，只要手动窗口开放仍能投稿。时间用例只放在最合适的一层，不复制到所有测试文件。
- [x] 运行 `npm test -- worker/data/work-submissions.test.ts worker/routes/work-submissions.test.ts worker/routes/work-files.test.ts worker/lib/event-window-update.test.ts worker/lib/windows.test.ts`，通过后提交。

### Task 3: 管理端版本审核、作者可见意见和全员列表

**Files:** 修改 `worker/data/work-submissions.ts`、`worker/routes/admin.ts`、`worker/data/admin.ts`、`src/shared/admin.ts`、`worker/lib/portal-history.ts`、`worker/data/admin.test.ts`、`worker/data/work-submissions.test.ts`、`worker/routes/work-submissions.test.ts`、`worker/lib/portal-history.test.ts`。

**Interfaces:** 产出管理端三项版本／意见 API、`createWorkSubmissionReview`；`AdminProjectDraftListItem` 增加 `review`、`latestSubmission`、参与者状态和最新提交时间。列表以参与者为起点，未初始化容器时 `id` 可空并保留 `participantId`，详情可按参与者初始化容器后取得既有 `draftId`。

- [x] 列表 LEFT JOIN 覆盖所有参与者，报名尚待审的行显示资格状态及无投稿，不开放作者上传权限；获资格但无文件／无作品容器的作者也必须能被管理员找到。
- [x] 为无容器的参与者提供 `GET /api/admin/participants/:participantId/project-draft`：对已获参与资格者复用现有初始化函数返回 `{ draftId }`，供列表进入现有详情 URL；待资格作者只链接已有参与者详情。不要让普通列表 GET 隐式批量创建作品。
- [x] 管理员意见追加到指定版本，普通意见不改变结论；当前结论只允许针对最新版本。若打开 V1 后已有 V2，保存决定返回 409 `submission_changed`，普通针对 V1 的意见仍可保存。
- [x] 通过后新版本保留通过状态及首次通过版；管理员明确对最新稿保存需修改／未通过后，状态按 Task 1 规则改变。已公开作品保存负面结论前沿用现有「先撤下」提示。
- [x] 作者工作区返回最新非空审稿正文及对应版本、时间；某版详情返回所有该版意见。正文仅向作者本人和管理员开放，不返回审稿人邮箱。
- [x] 复用 `participant_events` 记录 `work_submission_created`、`work_submission_reviewed` 等简短事件，事件不替代可直接阅读的审稿正文；更新现有 history label。
- [x] 用真实路由及 D1 用例验证意见作者立即可读、其他作者不可读、空理由被拒绝、意见不改变结论、需修改后新版待审、通过后新版保留基准。无容器作者列表及初始化在 `worker/data/admin.test.ts` / 对应路由测试中各覆盖其独立风险。
- [x] 运行 `npm test -- worker/data/admin.test.ts worker/data/work-submissions.test.ts worker/routes/work-submissions.test.ts worker/lib/portal-history.test.ts`，通过后提交。

### Task 4: 退役旧审核入口并接通公开发布

**Files:** 修改 `worker/data/work-submissions.ts`、`worker/data/project-drafts.ts`、`worker/routes/portal.ts`、`worker/routes/admin.ts`、`worker/data/works.ts`、`worker/data/relay-publication.ts`、`src/shared/works.ts`、`src/shared/portal.ts`、`src/shared/admin.ts`；调整 `worker/data/works.test.ts`、`worker/data/relay-publication.test.ts`、`worker/data/project-drafts.test.ts`。旧 `worker/lib/project-draft-admin.ts` 及专属测试失去调用时删除，不为删除本身新增测试。

**Interfaces:** 数据层内部 `syncProjectPublicationProjection` 生成与版本／意见写入放在同一 batch 的 D1 语句。公开授权由 `getWorkSubmissionWorkspace(...).review.status` 或等价集中摘要决定；公开 API 响应结构保持现有 `PublicWork`，不引入私有版本对象。

- [x] 按设计集中投影旧双状态，所有新审核结论写入只有一个入口。通过时复制该次通过版的标题／简介／类型；新版本提交和普通意见不写旧状态或公开快照，尤其不能让已公开历史作品初次补交触发旧 CHECK。
- [x] `getWorkPublicationIssues` 的调用链增加正式内容审核状态检查；`setWorkPublication`、`confirmPortalProjectRelease`、`publishConfirmedProjectIfReady` 都使用同一规则。不能出现旧双状态 approved、没有正式内容通过便可新公开的旁路。
- [x] 既有已经公开的历史作品仍可读取；已有 `work_unpublished` 事件仍抑制自动重新公开。保留首次发布确认日期及排期规则，不把无投稿 cutoff 扩展成修改公开发布日期约束。
- [x] 旧四个作者预告／审查写接口及后台旧双状态 PATCH 返回 410 和工作台指引；移除新流程对旧编辑器和旧审核 mutation 的调用。保留历史只读资料，不伪造正式审核基准。
- [x] 检查 `confirmPortalProjectRelease` 的可选旧 `preview` 参数及其他内部调用：关闭可修改已审作品元数据的旧旁路，发布确认只处理链接及确认时间，不覆盖审核快照。
- [x] 调整旧资料保存专属测试的范围；保留并迁移它们覆盖的独立权限、公开隐私、撤下保护和发布确认断言，不能只删除有效测试来使新流程通过。
- [x] 扩展现有公开行为用例，证明：V1 通过后 V2 的标题／简介不自动公开；审稿正文、版本说明、文件元数据不进入公开列表和详情；历史已公开稿可读；撤下后提交／普通意见不自动重新公开。
- [x] 运行 `npm test -- worker/data/works.test.ts worker/data/relay-publication.test.ts worker/data/work-submissions.test.ts worker/routes/work-submissions.test.ts worker/data/project-drafts.test.ts`，如已删除某专属文件则去掉对应路径，通过后提交。

### Task 5: 把投稿与审稿意见做进醒目的作者工作台

**Files:** 新增 `src/portal/components/WorkSubmissionSection.tsx`；修改 `src/portal/pages/PortalOverviewPage.tsx`、`src/portal/components/WorkFilesSection.tsx`、`src/portal/components/RegistrationProgress.tsx`、`src/portal/archive.css`。移除无调用的 `src/portal/pages/PortalProjectPage.tsx` 及只服务旧编辑器的类型／辅助逻辑；旧路由跳转保留。

**Interfaces:** `WorkSubmissionSection({ workspace, loadError, onRefresh }: { workspace: WorkSubmissionWorkspace | null; loadError: string | null; onRefresh: () => Promise<void> }): React.JSX.Element`；Overview 将投稿读取纳入已有刷新流程，单项读取失败不能遮住报名及其他工作台资料。

- [x] 在工作台标题后、基本资料之前放默认展开的 `id="work-submission"` 主面板。已获资格作者即使窗口关闭、无文件或读取失败也能看见该区域及状态／错误说明。
- [x] 顶部突出当前状态、最新版本号、审核依据版本；最新非空意见正文、版本和时间直接展示。需要修改的提示与新版本提交入口同时可见，不要求去操作记录寻找。
- [x] 将现有上传组件去掉独立第 04 章节壳，嵌入完整版本编辑区。暂存文件与最新正式版本分组标清，提交按钮上传中禁用，成功后按服务端结果刷新；失败保留当前已上传文件并提示人工重试。
- [x] 实现标题、类型、简介及选填版本说明表单；新修订预填最近版 metadata，但文件集合为空，明确要求上传整套新文件。提交前展示本次文件列表，不静默继承旧文件。
- [x] 版本历史按需展开／读取。已提交文件只显示下载；本次暂存文件保留删除和取消操作。意见始终显示针对版本，审核后更新不得标成「V2 已通过」。
- [x] 目录及 RegistrationProgress 的上传锚点统一到新面板；作品审核状态不替换报名资格状态。保留接力安排、邻居及基本资料原有能力。
- [x] 执行 `npm run check`。不新增 JSX 字符串断言或只验证布局常量的永久测试；页面样式验收集中在 Task 6 截图阶段。
- [x] 提交作者工作台改动。

### Task 6: 管理端界面、规则口径与集中验收

**Files:** 修改 `src/admin/pages/AdminProjectDraftsPage.tsx`、`src/admin/pages/AdminProjectDraftDetailPage.tsx`、`src/admin/components/AdminWorkFiles.tsx`、`src/admin/lib/project-progress.ts` 及其已有测试、`src/routes/portal_/admin/project-drafts/route.tsx`、`src/admin/pages/AdminEventWindowsPage.tsx`、`src/shared/activity-rules.ts`、`src/app/components/MissionCountdown.tsx`、`src/app/components/MissionCountdown.test.ts`（仅删除失效 cutoff 专属覆盖、保留接力计时覆盖）、`scripts/lib/local-dev-bootstrap.mjs`、`e2e/project-submission.spec.ts`、`e2e/work-upload.spec.ts`、`e2e/admin-work-review.spec.ts`、`e2e/publication.spec.ts`、`docs/README.md`、`docs/delivery/todo.md`、`docs/delivery/work-submission-without-preview.md`、`docs/product/site/participation-rules-source.md`、`docs/development/production-deployment.md`。

**Interfaces:** 管理端消费 Task 3 的统一摘要和意见 API；URL `scope` 明确为 `unapproved | all | not-submitted | pending | changes-requested | approved | rejected | updated`，缺省 `unapproved`。旧 `has-files` URL 归一化为 `all`；作者详情返回列表保留筛选和搜索。

- [x] 列表显示全体作者交稿情况、统一审核状态、最新版本及时间、依据版本和更新标记；无容器行按 Task 3 入口取得 `draftId` 后进入旧详情 URL，不凭空构造 draft ID。
- [x] 详情默认最新稿，文件组件改为明确接收该版 `files`；历史选择有独立版本标题。审稿表单显示「针对 Vn」，支持仅保存意见／通过／需修改／未通过，保存后更新意见区；保留原有公开预览和公开／撤下操作。
- [x] 调整 `summarizeProjectProgress` 及已有用例，统计从新统一状态来；未正式提交的上传不能计入正式投稿。
- [x] 活动设置中隐藏退役的预告／审查窗口编辑项，投稿窗口保留启用和开始时间、移除结束时间控件；其他窗口保持原功能。
- [x] 移除工作台投稿倒计时及失效 `WORK_SUBMISSION_DEADLINE` 消费；首页接力开始倒计时保留。规则版本正常递增，旧规则同意记录保留，不新增强制重新同意流程。
- [x] 修改规则与现行产品文档中的硬截止、两周开放承诺及绑定截止的补救安排，说明完整成品、暂不设硬截止、修订及意见直接可见。保留历史交付记录为历史，明确由本设计替代，避免误改成过去已经如此。
- [x] 增加最少本地 seed：未提交、待审核、需修改、已通过 V1 后更新 V2。复用现有 fixture 结构，不另建演示工程；调整失效 E2E 的 API／断言以符合新流程，不新增交互场景，不执行浏览器 E2E。
- [x] 集中运行相关后端及共享逻辑检查：`npm test -- src/shared/work-submissions.test.ts worker/data/work-submissions.test.ts worker/routes/work-submissions.test.ts worker/routes/work-files.test.ts worker/data/admin.test.ts worker/data/works.test.ts worker/data/relay-publication.test.ts worker/lib/windows.test.ts worker/lib/event-window-update.test.ts worker/lib/portal-history.test.ts src/admin/lib/project-progress.test.ts src/portal/components/RegistrationProgress.test.ts src/app/components/MissionCountdown.test.ts`。仅新增文件到此时才存在；预期全部通过。
- [x] 运行 `npm run check` 和 `npm run build`，记录真实结果。只在失败、后续改动或具体未决问题下补跑受影响检查，不反复重启全量验证。
- [x] 静态截图检查：用现有本地会话及 seed 直接打开页面，在桌面约 1440px、手机约 390px 检查未提交上传入口、需修改的长意见、通过后更新提示、管理员最新版本及意见区。可以用 SQL 准备页面状态，只导航并截图，不自动点击／填表／提交表单。
- [x] 对照设计核对核心结果：在创作者工作台能发现上传和意见；完整版本及基准不丢；普通意见不改变状态；新稿不会被误标成已审；没有日期 cutoff；管理员无遗漏；公开端没有私有材料。
- [x] 提交最终改动并交付命令结果、截图路径和未验证项。说明真实生产 R2 上传、邮件、生产账号交互及部署未在此轮验证；不把本地模拟 R2 通过当成生产验收。

## 计划自审与交付说明

- 六项任务分别覆盖契约与迁移、作者提交、管理员审核、公开链路、作者界面、管理界面与集中验收；没有独立的基础设施项目。
- Review Focus 五项均有指定层级的行为覆盖；没有为同一故障在每层重复搭测试。
- 数据主表不重建，新增的两张表直接承载用户确认的版本与审稿业务。未增加恢复状态、通用队列或独立框架。
- 标题／简介长度、缺省显示全体、仅最新版本可改结论、旧稿仅追加意见，以及保留现有公开流程的投影，是本设计明确写出的实施细化，不能当作用户另外提出的功能。
- 本次执行建议：由主 agent 按上述顺序直接实施，任务共享数据契约及大路由文件较多，暂不并行委派。生产发布另走项目已有流程，需先阅读全局部署记忆。


## 执行记录（2026-10-31）

- 工作分支：`feat/submission-and-review`，从 `96cd0ac` 创建。保留原有未跟踪目录，未合并其他分支。
- 六项任务完成。版本数据、API、作者工作台、管理员审核、公开快照衔接、无 cutoff 及规则口径已落地。
- 实施细化：用户明确要求开新分支，采用当前工作区切换分支；共用接口连续调整，六任务最终作为完整功能统一提交，不在中间不一致状态逐任务提交。
- 窗口规则集中在既有窗口映射及管理员更新入口处理，不增加窗口表、恢复流程或请求队列。保留没有新入口调用的旧数据辅助函数，避免无关的大范围清理；旧写 API 已返回 410。
- 只读整分支审阅发现批量上传部分失败后可误交的问题：已通过上传组件错误回传和提交按钮／提交处理校验修正。已有上传失败 E2E 用例补充对应断言；遵守用户要求，未执行浏览器交互用例。两处旧发布提示的截止／双审核措辞同时修正。
- 验证：`npm run check` 通过；`npm run build` 通过。构建保留现有大 chunk 提示，未为此扩展性能改造。
- 相关测试命令：`npm test -- src/shared/work-submissions.test.ts worker/data/work-submissions.test.ts worker/routes/work-submissions.test.ts worker/routes/work-files.test.ts worker/data/admin.test.ts worker/data/works.test.ts worker/data/relay-publication.test.ts worker/lib/windows.test.ts worker/lib/event-window-update.test.ts worker/lib/portal-history.test.ts src/admin/lib/project-progress.test.ts src/portal/components/RegistrationProgress.test.ts src/app/components/MissionCountdown.test.ts`；13 个文件、65 项通过。
- `node node_modules/@playwright/test/cli.js test --list` 成功解析 10 个文件的 30 项已有 E2E；仅列出，没有执行。
- 本地截图：作者未提交／待审核／需修改／审核后更新四种状态，以及管理员列表／详情，分别检查 1440px 和 390px；页面无报错、无横向溢出。使用 `/tmp/sunyunbo/submission-and-review/preview` 的隔离测试库和测试账号，只导航、读取与截图，没有自动点击／填表。
- 截图目录：`/tmp/sunyunbo/submission-and-review/screenshots/`。日志：同级 `final-tests.log`、`final-build.log`、`e2e-list.log`；临时图片和账号不加入 Git。
- 未执行生产部署、远程迁移、真实生产 R2 验收、生产窗口开关或邮件发送。生产状态仍以既有发布记录为准。

### 后续调整：管理员默认待处理范围

用户要求优先查看所有已交稿但尚未审核通过的作品，默认范围改为 `unapproved`（已交稿未通过），包含待审核、需修改及未通过。未提交和已经通过（含通过后更新）的作品不进入此默认范围，全部作者仍可通过「全部作品」查看；显式筛选、搜索及返回列表的状态继续保留。验证命令为 `npm test -- src/admin/lib/project-progress.test.ts` 及 `npm run check`，不运行浏览器交互测试。

### 后续调整：投稿与审核页面收紧第二稿

用户确认减少空白和重复装饰：移除投稿区英文装饰标题与大外框，保留阅读底色；桌面端简介与版本说明左右两列等高 88px，标题和类型在左侧紧凑排列、整组最大宽度 36rem；手机端改为单列，版本说明初始高度 62px；已交稿默认展示状态、最新意见和文件，简介与版本说明按需展开，点击「提交修订版」才展开编辑区。折叠保留表单节点和输入，正式提交完成形成新版本后恢复收起。完整审稿记录保留在历史版本，避免在首屏重复显示最新意见。管理员详情采用 16px 区块间距和内边距，去掉与页面 gap 重复叠加的外边距，保留双栏及移动端布局。

此轮仅调整页面呈现及本地展开，不改接口、审核规则和存储。验证采用 `npm run check`、`npm run build` 及桌面／手机截图；不新增永久布局测试，不执行浏览器自动交互。截图位于 `/tmp/sunyunbo/submission-and-review/compact-preview/`。

### 后续调整：按交稿阶段说明流程的状态弹窗

用户确认：未交稿、未通过及首次通过的作者需要醒目流程说明；按账号在浏览器记忆已读，接受换设备再次提醒，不增加服务端通知数据。新增 `src/portal/lib/submission-notice.ts` 负责状态到说明及稳定通知标识的映射，`SubmissionStatusNotice.tsx` 复用原生 dialog、既有动效、关闭和工作区定位；作者工作区提供主动重看入口。

核心行为由 `src/portal/lib/submission-notice.test.ts` 的 5 个精简用例覆盖：暂存与正式提交区别、新版本待审、负面决定及意见对应、首次通过后修订不重复、账号与作品隔离。实际运行 `npm test -- src/portal/lib/submission-notice.test.ts src/shared/work-submissions.test.ts`，7 项通过；`npm run check`、`npm run build` 通过。只读增量审阅未发现重要问题。桌面／手机分别截图查看未交稿、待审、需修改、首次通过及预置已读状态，只导航和读取，没有点击或填表测试。截图 `/tmp/sunyunbo/submission-and-review/notice-preview/`；未部署。

### 后续文案调整：阶段提醒与审核主体

按用户要求使用 `humanizer-zh` 审阅通知，所有状态共用“DDL 临近，活动即将进入下一阶段”的背景提醒，再说明个人进度和下一步操作。删减模板化、重复表达，保留完整投稿、修改重交、首次通过基准及按排期发布等条件。通知、作品区的审核意见、资料可见范围及作品审稿事件文案将审核负责方统一称为“策划组”；不扩大为全站其他职责的称谓替换。已读标识、权限、数据和截止规则不变，也不新增具体截止日期。

本轮运行 `npm test -- src/portal/lib/submission-notice.test.ts src/shared/work-submissions.test.ts worker/lib/portal-history.test.ts`，11 项通过；`npm run check` 及差异空白检查通过。桌面／手机静态截图确认通用阶段提醒、策划组称谓和各状态说明完整可见；已读状态仍不自动重复弹窗。截图 `/tmp/sunyunbo/submission-and-review/notice-copy-preview/`，未执行浏览器交互或生产发布。
