import { z } from "zod";

export const eventWindowKeys = [
  "application_open",
  "segment_claim_open",
  "segment_change_open",
  "preview_submit_open",
  "review_submit_open",
  "public_release_open",
] as const;

export const eventWindowKeySchema = z.enum(eventWindowKeys);

export type EventWindowKey = z.infer<typeof eventWindowKeySchema>;

export type EventWindowState = "disabled" | "scheduled" | "open" | "ended";

export const eventWindowStateLabels: Record<EventWindowState, string> = {
  disabled: "未启用",
  scheduled: "尚未开始",
  open: "开放中",
  ended: "已结束",
};

export function getApplicationWindowLabel(window: EventWindowSummary | null | undefined) {
  if (!window || window.state === "disabled") return "报名未开放";
  return `报名${eventWindowStateLabels[window.state]}`;
}

export function getWindowLabel(items: EventWindowSummary[], key: EventWindowKey) {
  const window = items.find((item) => item.key === key);
  return eventWindowStateLabels[window?.state ?? "disabled"];
}

export type EventWindowSummary = {
  key: EventWindowKey;
  label: string;
  isEnabled: boolean;
  isOpen: boolean;
  state: EventWindowState;
  opensAt: string | null;
  closesAt: string | null;
  updatedAt: string;
};

const nullableIsoDatetimeSchema = z.string().trim().datetime({ offset: true }).nullable().optional();

export const updateEventWindowInputSchema = z
  .object({
    isEnabled: z.boolean(),
    opensAt: nullableIsoDatetimeSchema,
    closesAt: nullableIsoDatetimeSchema,
  })
  .transform((value) => ({
    isEnabled: value.isEnabled,
    opensAt: value.opensAt ?? null,
    closesAt: value.closesAt ?? null,
  }))
  .superRefine((value, context) => {
    if (value.opensAt && value.closesAt && Date.parse(value.closesAt) <= Date.parse(value.opensAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "结束时间必须晚于开始时间。",
        path: ["closesAt"],
      });
    }
  });

export type UpdateEventWindowInput = z.infer<typeof updateEventWindowInputSchema>;

export const eventWindowLabels: Record<EventWindowKey, string> = {
  application_open: "报名开放",
  segment_claim_open: "时间段认领开放",
  segment_change_open: "时间段变更 / 释放开放",
  preview_submit_open: "预告资料提交开放",
  review_submit_open: "审查说明提交开放",
  public_release_open: "公开发布开放",
};

export function buildWindowFlagMap(items: EventWindowSummary[]) {
  const segmentClaimOpen =
    items.find((item) => item.key === "segment_claim_open")?.isOpen ?? false;
  const segmentChangeOpen =
    items.find((item) => item.key === "segment_change_open")?.isOpen ?? false;

  return {
    applicationOpen: items.find((item) => item.key === "application_open")?.isOpen ?? false,
    segmentClaimOpen,
    segmentChangeOpen,
    previewSubmitOpen: items.find((item) => item.key === "preview_submit_open")?.isOpen ?? false,
    reviewSubmitOpen: items.find((item) => item.key === "review_submit_open")?.isOpen ?? false,
    publicReleaseOpen: items.find((item) => item.key === "public_release_open")?.isOpen ?? false,
  };
}
