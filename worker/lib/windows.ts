import {
  eventWindowKeySchema,
  eventWindowLabels,
  type EventWindowKey,
  type EventWindowSummary,
  type EventWindowState,
} from "../../src/shared/windows";

export type EventWindowRow = {
  key: string;
  label: string;
  is_enabled: number;
  opens_at: string | null;
  closes_at: string | null;
  updated_at: string;
};

export function mapEventWindowRow(row: EventWindowRow): EventWindowSummary | null {
  const parsedKey = eventWindowKeySchema.safeParse(row.key);

  if (!parsedKey.success) {
    return null;
  }

  const key = parsedKey.data;
  const state = computeWindowState(row.is_enabled, row.opens_at, row.closes_at);

  return {
    key,
    label: row.label || eventWindowLabels[key],
    isEnabled: Boolean(row.is_enabled),
    isOpen: state === "open",
    state,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    updatedAt: row.updated_at,
  };
}

export function computeIsWindowOpen(
  isEnabled: number | boolean,
  opensAt: string | null,
  closesAt: string | null,
) {
  return computeWindowState(isEnabled, opensAt, closesAt) === "open";
}

export function computeWindowState(
  isEnabled: number | boolean,
  opensAt: string | null,
  closesAt: string | null,
  now = Date.now(),
): EventWindowState {
  if (!isEnabled) {
    return "disabled";
  }

  if (closesAt && Date.parse(closesAt) <= now) {
    return "ended";
  }

  if (opensAt && Date.parse(opensAt) > now) {
    return "scheduled";
  }

  return "open";
}

export function getWindowOrFallback(
  rows: EventWindowSummary[],
  key: EventWindowKey,
): EventWindowSummary {
  return (
    rows.find((row) => row.key === key) ?? {
      key,
      label: eventWindowLabels[key],
      isEnabled: false,
      isOpen: false,
      state: "disabled",
      opensAt: null,
      closesAt: null,
      updatedAt: new Date(0).toISOString(),
    }
  );
}
