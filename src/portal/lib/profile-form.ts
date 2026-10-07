import type { UpdatePortalProfileInput } from "../../shared/portal";

export function normalizePortalProfileInput(
  input: UpdatePortalProfileInput,
): UpdatePortalProfileInput {
  return {
    creditName: input.creditName.trim(),
    bilibiliUid: input.bilibiliUid.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
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
