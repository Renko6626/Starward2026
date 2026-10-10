import type { PortalEventItem } from "../../src/shared/portal";

type PortalEventPayload = Record<string, unknown>;

type BuildPortalEventLabelInput = {
  eventType: string;
  actorType: PortalEventItem["actorType"];
  payloadJson: string | null;
};

export function buildPortalEventActorLabel(
  actorType: PortalEventItem["actorType"],
) {
  switch (actorType) {
    case "participant":
      return "你";
    case "admin":
      return "主催";
    case "system":
      return "系统";
  }
}

export function buildPortalEventLabel(input: BuildPortalEventLabelInput) {
  const payload = parsePortalEventPayload(input.payloadJson);

  switch (input.eventType) {
    case "application_segment_reserved":
      return "已提交报名并预留时段，等待审核。";
    case "application_withdrawn":
      return "已撤回报名并释放时段。";
    case "segment_swapped":
      return "双方已同意交换，当前时段已更新。";
    case "portal_activated":
      return "作者页面已建立。";
    case "portal_invite_sent":
      return "主催发送了报名通过确认邮件。";
    case "participant_updated":
      return "主催更新了你的参与状态。";
    case "segment_claimed":
      return `已认领时间段 ${formatSegment(payload.segmentCode, payload.segmentName)}。`;
    case "segment_changed":
      return `已将时间段从 ${formatSegment(payload.fromSegmentCode, payload.fromSegmentName)} 调整为 ${formatSegment(
        payload.toSegmentCode,
        payload.toSegmentName,
      )}。`;
    case "segment_released":
      return `已释放时间段 ${formatSegment(payload.segmentCode, payload.segmentName)}。`;
    case "segment_admin_assigned":
      return `主催为你分配了时间段 ${formatSegment(payload.segmentCode, payload.segmentName)}。`;
    case "segment_admin_released":
      return `主催释放了你当前的时间段 ${formatSegment(payload.segmentCode, payload.segmentName)}。`;
    case "preview_saved":
      return "已保存作品预告。";
    case "preview_submitted":
      return "已提交作品预告，等待主催审核。";
    case "review_saved":
      return "已保存审查说明。";
    case "review_submitted":
      return "已提交审查说明，等待主催审核。";
    case "work_auto_published":
      return "作品资料审核通过，已在站内展示。";
    case "work_release_confirmed":
      return "你已填写作品链接并确认发布。";
    case "work_link_updated":
      return "你更新了作品链接，首次发布确认时间保留。";
    case "project_preview_saved":
      return "已保存作品预告。";
    case "project_review_saved":
      return "已保存审查说明。";
    case "work_published":
      return "主催已在站内展示你的作品。";
    case "work_unpublished":
      return "主催已撤下作品的站内展示。";
    case "project_draft_admin_reviewed":
      return "主催更新了你的资料审核结果。";
    default:
      return `系统记录了一条事件：${input.eventType}。`;
  }
}

function parsePortalEventPayload(
  payloadJson: string | null,
): PortalEventPayload {
  if (!payloadJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as PortalEventPayload;
  } catch {
    return {};
  }
}

function formatSegment(code: unknown, name: unknown) {
  const normalizedCode = normalizeOptionalText(code);
  const normalizedName = normalizeOptionalText(name);

  if (normalizedCode && normalizedName) {
    return `${normalizedCode} ${normalizedName}`;
  }

  if (normalizedCode) {
    return normalizedCode;
  }

  if (normalizedName) {
    return normalizedName;
  }

  return "未命名时间段";
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
