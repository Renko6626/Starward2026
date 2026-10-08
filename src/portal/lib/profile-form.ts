import type { UpdatePortalProfileInput } from "../../shared/portal";

export const portalContactChannels = ["QQ", "微信", "Discord", "Telegram", "Email", "其他"];

const bilibiliUidPattern = /^[1-9]\d{0,19}$/;

function normalizeBilibiliUid(value: string) {
  const trimmed = value.trim();
  if (bilibiliUidPattern.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed.startsWith("space.bilibili.com/") ? `https://${trimmed}` : trimmed);
    if (!["https:", "http:"].includes(url.protocol) || url.hostname !== "space.bilibili.com" || url.username || url.password || url.port) return trimmed;
    const uid = url.pathname.split("/")[1];
    return uid && bilibiliUidPattern.test(uid) ? uid : trimmed;
  } catch { return trimmed; }
}

export function getBilibiliProfileUrl(value: string) {
  const uid = normalizeBilibiliUid(value);
  return bilibiliUidPattern.test(uid) ? `https://space.bilibili.com/${uid}` : undefined;
}

export function normalizePortalProfileInput(
  input: UpdatePortalProfileInput,
  registrationEmail?: string,
): UpdatePortalProfileInput {
  return {
    creditName: input.creditName.trim(),
    bilibiliUid: normalizeBilibiliUid(input.bilibiliUid),
    contactEmail: (registrationEmail ?? input.contactEmail).trim().toLowerCase(),
    primaryContactChannel: input.primaryContactChannel.trim(),
    primaryContactHandle: input.primaryContactHandle.trim(),
    backupContact: normalizeOptionalText(input.backupContact),
    isAnonymous: input.isAnonymous,
  };
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
