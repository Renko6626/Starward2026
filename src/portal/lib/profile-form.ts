import type { UpdatePortalProfileInput } from "../../shared/portal";

export function normalizePortalProfileInput(input: UpdatePortalProfileInput): UpdatePortalProfileInput {
  return {
    penName: normalizeOptionalText(input.penName),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    primaryContactChannel: input.primaryContactChannel.trim(),
    primaryContactHandle: input.primaryContactHandle.trim(),
    backupContact: normalizeOptionalText(input.backupContact),
    publicCreditMode: input.publicCreditMode,
    publicCreditName:
      input.publicCreditMode === "pseudonymous"
        ? normalizeOptionalText(input.publicCreditName)
        : undefined,
  };
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
