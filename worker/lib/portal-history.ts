import type { PortalEventItem } from "../../src/shared/portal";

type PortalEventPayload = Record<string, unknown>;

type BuildPortalEventLabelInput = {
  eventType: string;
  actorType: PortalEventItem["actorType"];
  payloadJson: string | null;
};

export function buildPortalEventActorLabel(actorType: PortalEventItem["actorType"]) {
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
    case "portal_activated":
      return "参与者门户已激活。";
    case "portal_invite_sent":
      return "主催发送了参与者门户入口提醒。";
    case "participant_updated":
      return "主催更新了你的参与者状态。";
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
      return "已保存预告信息草稿。";
    case "preview_submitted":
      return "已提交预告信息，等待主催审核。";
    case "review_saved":
      return "已保存审查说明草稿。";
    case "review_submitted":
      return "已提交审查说明，等待主催查看。";
    case "project_draft_admin_reviewed":
      return "主催更新了你的资料审核结果。";
    default:
      return `系统记录了一条事件：${input.eventType}。`;
  }
}

function parsePortalEventPayload(payloadJson: string | null): PortalEventPayload {
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
    return `${normalizedCode} · ${normalizedName}`;
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
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
