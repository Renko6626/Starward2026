import type { GenericEndpointContext } from "better-auth";
import { APIError, getOAuthState } from "better-auth/api";
import { ACTIVITY_RULES_ACCEPTANCE_HEADER, ACTIVITY_RULES_VERSION } from "../../src/shared/activity-rules";

export function requireActivityRulesConsent(context: GenericEndpointContext | null) {
  const version = context?.headers?.get(ACTIVITY_RULES_ACCEPTANCE_HEADER)
    ?? context?.request?.headers.get(ACTIVITY_RULES_ACCEPTANCE_HEADER);
  if (!version) {
    throw new APIError("FORBIDDEN", {
      code: "ACTIVITY_RULES_REQUIRED",
      message: "首次建立账号前，请阅读并同意活动规则。",
    });
  }
  if (version !== ACTIVITY_RULES_VERSION) {
    throw new APIError("CONFLICT", {
      code: "ACTIVITY_RULES_CHANGED",
      message: "活动规则已更新，请刷新页面、阅读最新规则后重新确认。",
    });
  }
  return version;
}

export async function requireAccountCreationConsent(context: GenericEndpointContext | null) {
  if (context?.path === "/oauth2/callback/:providerId" || context?.path === "/oauth2/callback/qq") {
    const state = await getOAuthState();
    const version = state?.requestSignUp === true ? state.starwardRulesVersion : null;
    if (!version) throw new APIError("FORBIDDEN", { code:"ACTIVITY_RULES_REQUIRED", message:"ACTIVITY_RULES_REQUIRED" });
    if (version !== ACTIVITY_RULES_VERSION) throw new APIError("CONFLICT", { code:"ACTIVITY_RULES_CHANGED", message:"ACTIVITY_RULES_CHANGED" });
    return String(version);
  }
  return requireActivityRulesConsent(context);
}
