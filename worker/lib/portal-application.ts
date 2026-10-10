import type { ApplicationStatus } from "../../src/shared/applications";

export function resolvePortalApplicationMutation(
  status: ApplicationStatus | null,
  applicationWindowOpen: boolean,
) {
  if (!status) {
    if (!applicationWindowOpen) {
      return {
        mode: "create" as const,
        editable: false,
        reason: "window_closed" as const,
        message: "当前报名窗口未开放，请等待主催开启。",
      };
    }

    return {
      mode: "create" as const,
      editable: true,
    };
  }

  if (status === "approved") {
    return {
      mode: "locked" as const,
      editable: false,
      reason: "approved" as const,
      message: "该报名已审核通过，当前不再允许通过作者页面修改。",
    };
  }

  if (!applicationWindowOpen) {
    return {
      mode: "update" as const,
      editable: false,
      reason: "window_closed" as const,
      message: "当前报名窗口未开放，请等待主催开启。",
    };
  }

  return {
    mode: "update" as const,
    editable: true,
  };
}

export function resolvePortalApplicationProfileRequirement(
  profile: { userId: string } | null,
) {
  if (!profile) {
    return {
      ok: false as const,
      code: "portal_profile_required",
      status: 409,
      message: "请先补充联系资料，再填写报名资料。",
    };
  }

  return {
    ok: true as const,
  };
}
