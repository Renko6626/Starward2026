# Documentation Index

## Purpose

本文作为 `docs/` 目录入口，说明文档分层结构与推荐阅读顺序。

## 当前收集范围与后续作品资料约定

2026 年 10 月 11 日更新。当前阶段只需作者填写「基本信息」和「创作意向」，这些信息已经足够；确认参与或报名审核通过，不意味着现在就要填写作品具体内容。作品预告和审查说明已从工作台暂时隐藏，现有数据及后端实现保留。

作品具体资料计划在约两到三周后统一通知作者填写。具体开放时间、字段及提交规则尚未确定，不据此自动开放表单。本段限定的是作者需要填写的信息范围，现有接力排期、上下棒查看不属于新增作品资料收集。

后续需要讨论两类信息，以下是需求方向，尚未确定页面、接口或数据库如何拆分：

- **接力活动本身的信息（metadata）**：作者的完成情况、活动作品在 B 站的发布链接，以及需要记录的活动履约信息。
- **作品本身的信息**：标题、简介、文件本体、封面图及其他必要字段，供作品提交、保存和展示使用。

检查现有字段后，已确认当前表单存在语义重叠和重复收集的风险，预告、作品信息与审核流程的边界也不清晰，不能视为下一阶段已定稿的字段清单：

| 现有字段 | 重叠或边界问题 |
| --- | --- |
| 报名 `interestFormat`，作品 `workType`、`formatLabel` | 同时存在预计类型、正式类型和自由填写的作品形式；需要约定哪些是计划、哪些是最终值，是否预填，以及是否还需要自由填写项。 |
| 报名 `introText`，作品 `previewSummary`，审查 `contentNote` | 分别收集创作意向、公开简介和供主催核对的内容概述，容易要求作者重复描述同一作品；需要明确用途，决定哪些复用、哪些确有必要单独填写。 |
| `previewTitle`、`previewSummary` | 名称属于预告，但代码同时将其用于最终作品标题、简介和公开展示；这是一套字段承担了多个阶段的职责，不能因关闭预告就直接删除已有内容。 |
| `workUrl`、`releaseConfirmedAt`、`publishedAt` 与两套审核状态 | 活动发布确认、作品链接、站内公开及预告／审查流程混在现有作品模型中。应先统一各状态的含义；作者确认发布与站内公开是不同事件，不能当作重复字段直接合并。 |

`contentWarnings`（内容提醒）、`reviewNote`（给主催的补充说明）有各自用途，是否保留、何时填写及谁能看到，也需一起约定，不能仅因同属说明文字就直接合并。现有 `workUrl` 和 `coverUrl` 保存的是 HTTPS 外链；本次检查未发现文件本体上传流程，不能将链接字段视为已经支持作品文件提交。B 站账号 UID／主页也不等于具体作品的发布链接。

**下一阶段实施前，须由主催与开发统一商量并确认**：两类信息的边界、最终字段清单、必填与选填、公开与私有范围、报名资料如何复用、完成与发布状态的定义、文件和封面的提交方式、审核流程，以及旧字段和已有数据如何迁移。确认前不继续增加重复表单，不自行删除或合并字段，也不提前恢复作品资料填写入口。

已有[取消预告流程的影响评估](./delivery/work-submission-without-preview.md)可作为讨论材料，其中的字段保留、命名和迁移建议不代表本次已确认；后续应按统一约定更新该文档和实现。

## Directory Structure

```text
docs/
├── README.md
├── architecture/
├── development/
├── delivery/
├── product/
└── design/
```

目录职责如下：

- `architecture/`
  - 长期稳定的系统架构、领域模型与命名规则
- `development/`
  - 本地开发、seed、调试与运行约定
- `delivery/`
  - 交付阶段、范围定义与实施计划
- `product/`
  - 稳定的产品流程、账号模型与页面职责
- `design/`
  - 页面线框、内容结构与模块规范

## Recommended Reading Order

首次了解项目时，建议按以下顺序阅读：

1. [architecture/system.md](./architecture/system.md)
2. [delivery/phase-1/scope.md](./delivery/phase-1/scope.md)
3. [delivery/phase-1/plan.md](./delivery/phase-1/plan.md)
4. [product/accounts/participant-account-system.md](./product/accounts/participant-account-system.md)
5. [development/local-d1.md](./development/local-d1.md)
6. [product/portal/skeleton.md](./product/portal/skeleton.md)
7. [product/portal/data-api.md](./product/portal/data-api.md)
8. [product/site/skeleton.md](./product/site/skeleton.md)

设计或页面实现阶段可继续阅读：

- [design/homepage-wireframe.md](./design/homepage-wireframe.md)
- [design/apply-page-wireframe.md](./design/apply-page-wireframe.md)
- [design/ui-redesign-handoff.md](./design/ui-redesign-handoff.md)
- [design/works-page-wireframe.md](./design/works-page-wireframe.md)
- [design/work-detail-page-spec.md](./design/work-detail-page-spec.md)
- [superpowers/specs/2026-10-06-romantic-ring-station-design.md](./superpowers/specs/2026-10-06-romantic-ring-station-design.md)：当前环形鸟船设定，含固定主轴分区与外部构造
- [design/torifune-session-handoff.md](./design/torifune-session-handoff.md)
- [design/torifune-design-progress.md](./design/torifune-design-progress.md)
- [design/torifune-structure-draft.md](./design/torifune-structure-draft.md)
- [design/torifune-functional-layout.svg](./design/torifune-functional-layout.svg)
- [design/torifune-ecology-section.svg](./design/torifune-ecology-section.svg)
- [design/torifune-layout-comparison.svg](./design/torifune-layout-comparison.svg)
- [design/torifune-axial-spine.svg](./design/torifune-axial-spine.svg)

## File Map

架构：

- [architecture/system.md](./architecture/system.md)
- [architecture/time-segment-model.md](./architecture/time-segment-model.md)

交付：

- [delivery/todo.md](./delivery/todo.md)：活动待办
- [delivery/work-submission-without-preview.md](./delivery/work-submission-without-preview.md)：取消预告流程的影响评估、metadata 迁移与后续作品提交方案
- [delivery/phase-1/scope.md](./delivery/phase-1/scope.md)
- [delivery/phase-1/plan.md](./delivery/phase-1/plan.md)

开发：

- [development/local-d1.md](./development/local-d1.md)
- [development/production-deployment.md](./development/production-deployment.md)：`-prod` tag 自动部署、Cloudflare 权限与首次上线配置

产品：

- [product/accounts/participant-account-system.md](./product/accounts/participant-account-system.md)
- [product/portal/skeleton.md](./product/portal/skeleton.md)
- [product/portal/data-api.md](./product/portal/data-api.md)
- [product/site/skeleton.md](./product/site/skeleton.md)
- [product/site/participation-rules-source.md](./product/site/participation-rules-source.md)：合作方提供的规则原稿、展示建议和待确认事项

设计：

- [design/nasapunk-style-research.md](./design/nasapunk-style-research.md)：NASApunk 的出处、视觉语言、参考图与本站应用建议
- [design/visual-materials-and-motion-research.md](./design/visual-materials-and-motion-research.md)：视觉素材、蒙版、时间表占用填充及小众动画库调研
- [design/homepage-wireframe.md](./design/homepage-wireframe.md)
- [design/apply-page-wireframe.md](./design/apply-page-wireframe.md)
- [design/ui-redesign-handoff.md](./design/ui-redesign-handoff.md)
- [design/works-page-wireframe.md](./design/works-page-wireframe.md)
- [design/work-detail-page-spec.md](./design/work-detail-page-spec.md)
