import type { ApplicationStatus } from "../../src/shared/applications";

export function resolvePortalApplicationMutation(status: ApplicationStatus | null) {
  if (!status) {
    return {
      mode: "create" as const,
      editable: true,
    };
  }

  if (status === "approved") {
    return {
      mode: "locked" as const,
      editable: false,
      message: "该报名已审核通过，当前不再允许通过参与者入口修改。",
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
