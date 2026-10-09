export type RelayPublicationState = {
  scheduledAt: string | null;
  confirmedAt: string | null;
  phase: "unconfigured" | "upcoming" | "today" | "overdue" | "confirmed";
  showReminder: boolean;
  canConfirm: boolean;
  canEditLink: boolean;
  remainingDays: number | null;
};

const dayMs = 86400000;
function beijingDay(time: number) {
  return Math.floor((time + 8 * 3600000) / dayMs);
}

export function getRelayPublicationState(
  scheduledAt: string | null,
  confirmedAt: string | null,
  now = new Date(),
): RelayPublicationState {
  const base = { scheduledAt, confirmedAt, showReminder: false, canConfirm: false, canEditLink: false, remainingDays: null };
  if (confirmedAt) return { ...base, phase: "confirmed", canEditLink: true };
  const planned = scheduledAt ? Date.parse(scheduledAt) : NaN;
  if (!Number.isFinite(planned)) return { ...base, phase: "unconfigured" };
  const current = now.getTime();
  const difference = beijingDay(planned) - beijingDay(current);
  if (difference < 0) return { ...base, phase: "overdue" };
  const today = difference === 0;
  return {
    ...base,
    phase: today ? "today" : "upcoming",
    showReminder: today || planned - current <= 7 * dayMs,
    canConfirm: today,
    canEditLink: today,
    remainingDays: difference,
  };
}
