import type { AdminSegmentItem } from '../../shared/admin';

export type QuickScheduleEntry = {
  segment: AdminSegmentItem;
  scheduledAt: string;
  needsSave: boolean;
};

export function buildQuickSchedule(segments: AdminSegmentItem[], start: string, intervalMinutes: number): QuickScheduleEntry[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) throw new Error('请选择完整的起始时间。');
  const first = new Date(`${start}:00+08:00`);
  if (!Number.isFinite(first.getTime()) || new Date(first.getTime() + 8 * 3600000).toISOString().slice(0, 16) !== start) {
    throw new Error('起始时间无效，请重新选择。');
  }
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 10080) {
    throw new Error('间隔须为 1 到 10080 分钟之间的整数。');
  }
  return segments.filter(segment => segment.kind === 'standard' && segment.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((segment, index) => ({
      segment,
      scheduledAt: segment.scheduledAt ?? new Date(first.getTime() + index * intervalMinutes * 60000).toISOString(),
      needsSave: !segment.scheduledAt,
    }));
}
