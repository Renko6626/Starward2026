# Starward2026 Time Segment Model

Last reviewed against official documentation: 2026-04-11

2026-10-07 更新：接力以单个作品发布时间点建模，使用 `schedule_segments.scheduled_at`；对外称“发布时点”。保留排期版本、认领与交换机制。下文中的时长、起止时间属于早期方案，不作为当前实现要求。

## 1. Purpose

本文定义 `时间段 / schedule segment` 的命名与领域模型决策。

## 2. Terminology Decision

项目采用以下术语：

- 对外中文：`时间段`
- 英文领域术语：`schedule segment`
- 页面层概念：`schedule`

## 3. Decision Rationale

早期设计稿中的 `slot` 命名会自然导向固定棒次结构，隐含以下假设：

- 数量固定
- 顺序固定
- 时长固定

当前业务不满足上述假设。当前排期存在以下特征：

- 参与人数可能变化
- 每段时长可能调整
- 后续可能整体重排

因此，领域模型应改为排期版本与时间段的两层结构。

## 4. Official Basis

### 4.1 Cloudflare D1

Cloudflare D1 支持事务语义的批量写入，适合时间段认领与调整类操作。

参考：

- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/

### 4.2 SQLite Partial Indexes

SQLite partial unique index 适合表达“同一参与者在同一版排期中仅持有一个进行中的时间段”。

参考：

- https://www.sqlite.org/partialindex.html

### 4.3 SQLite Date/Time Storage

SQLite 支持 ISO 8601 风格文本时间，适合当前阶段的渐进式排期建模。

参考：

- https://www.sqlite.org/lang_datefunc.html

## 5. Recommended Model

### 5.1 `event_windows`

`event_windows` 继续负责动作开放窗口，不负责完整排期。

### 5.2 `schedule_versions`

新增 `schedule_versions` 表，用于表示完整排期版本。

建议字段：

- `id`
- `title`
- `status`
- `published_at`
- `created_at`
- `updated_at`

建议状态：

- `draft`
- `active`
- `archived`

### 5.3 `schedule_segments`

新增 `schedule_segments` 表，用于表示排期中的可认领时间段。

建议字段：

- `id`
- `schedule_version_id`
- `sequence_no`
- `display_label`
- `planned_duration_minutes`
- `starts_at`
- `ends_at`
- `status`
- `current_participant_id`
- `claimed_at`
- `notes`
- `created_at`
- `updated_at`

建议状态：

- `claimable`
- `held`
- `locked`
- `published`
- `completed`
- `cancelled`

## 6. Constraints

建议至少添加以下约束：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_segments_version_sequence
ON schedule_segments(schedule_version_id, sequence_no);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_segments_held_participant
ON schedule_segments(schedule_version_id, current_participant_id)
WHERE current_participant_id IS NOT NULL
  AND status = 'held';
```

## 7. Naming Rules

### 7.1 Pages

页面层命名使用 `schedule`：

- `/portal/schedule`
- `/admin/schedule`

### 7.2 APIs

API 资源命名使用 `segments`：

- `GET /api/portal/segments/current`
- `GET /api/portal/segments/available`
- `POST /api/portal/segments/claim`
- `POST /api/portal/segments/change`
- `POST /api/portal/segments/release`
- `GET /api/admin/segments`

## 8. Related Table Changes

### 8.1 `project_drafts`

`project_drafts.segment_id` 为当前字段名。

### 8.2 `participant_events`

建议事件名调整为：

- `segment_claimed`
- `segment_changed`
- `segment_released`

建议 `target_type` 使用：

- `schedule_segment`

### 8.3 `event_windows`

建议窗口键使用：

- `segment_claim_open`
- `segment_change_open`

## 9. Repository Adoption Notes

仓库内采用该命名时的处理顺序如下：

1. 新建 `schedule_versions`
2. 新建 `schedule_segments`
3. 将页面与 API 文档切换到新命名
4. 调整 `project_drafts` 与 `participant_events` 关联字段
5. 移除旧命名与兼容入口

## 10. Decision Summary

领域模型采用 `schedule_versions + schedule_segments`。运行时接口与代码命名已完成统一。
