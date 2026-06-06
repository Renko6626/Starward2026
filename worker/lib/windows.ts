import {
  eventWindowKeySchema,
  eventWindowLabels,
  type EventWindowKey,
  type EventWindowSummary,
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

  return {
    key,
    label: row.label || eventWindowLabels[key],
    isEnabled: Boolean(row.is_enabled),
    isOpen: computeIsWindowOpen(row.is_enabled, row.opens_at, row.closes_at),
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
  if (!isEnabled) {
    return false;
  }

  const now = Date.now();

  if (opensAt && Date.parse(opensAt) > now) {
    return false;
  }

  if (closesAt && Date.parse(closesAt) <= now) {
    return false;
  }

  return true;
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
      opensAt: null,
      closesAt: null,
      updatedAt: new Date(0).toISOString(),
    }
  );
}
