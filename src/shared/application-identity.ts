type ApplicationIdentityInput = {
  displayName?: string | null;
  contactHandle?: string | null;
  contactEmail: string | null;
};

export function resolveApplicationDisplayName(input: ApplicationIdentityInput) {
  const displayName = input.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const contactHandle = input.contactHandle?.trim();

  if (contactHandle) {
    return contactHandle;
  }

  return input.contactEmail?.trim().toLowerCase() || "参与者";
}
