import type { ApplicationListItem } from "../../shared/applications";

export type AdminApplicationFilter =
  | "all"
  | "pending"
  | "needs-entry"
  | "needs-profile"
  | "converted";

export function filterAdminApplications(
  items: ApplicationListItem[],
  input: {
    filter: AdminApplicationFilter;
    query: string;
  },
) {
  const normalizedQuery = input.query.trim().toLowerCase();

  return items.filter((item) => {
    if (!matchesFilter(item, input.filter)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      item.displayName,
      item.contactEmail,
      item.authUserEmail ?? "",
      item.participantId ?? "",
    ]
      .join("\n")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function buildAdminApplicationFilterCounts(items: ApplicationListItem[]) {
  return {
    all: items.length,
    pending: items.filter((item) => matchesFilter(item, "pending")).length,
    "needs-entry": items.filter((item) => matchesFilter(item, "needs-entry")).length,
    "needs-profile": items.filter((item) => matchesFilter(item, "needs-profile")).length,
    converted: items.filter((item) => matchesFilter(item, "converted")).length,
  } satisfies Record<AdminApplicationFilter, number>;
}

function matchesFilter(item: ApplicationListItem, filter: AdminApplicationFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "pending") {
    return item.status === "pending";
  }

  if (filter === "needs-entry") {
    return !item.authUserEmail;
  }

  if (filter === "needs-profile") {
    return Boolean(item.authUserEmail) && !item.hasPortalProfile;
  }

  return Boolean(item.participantId);
}
