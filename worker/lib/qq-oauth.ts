import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import { APIError, getOAuthState, getSessionFromCtx } from "better-auth/api";
import { getCurrentAuthContext } from "@better-auth/core/context";
import type { GenericEndpointContext } from "better-auth";
import type { AppBindings } from "./types";
import { getRealAuthEmail } from "../../src/shared/auth-identity";

export function isQqEnabled(env: AppBindings) {
  return env.QQ_OAUTH_ENABLED?.trim().toLowerCase() === "true" && /^\d+$/.test(env.QQ_APP_ID?.trim() ?? "") && Boolean(env.QQ_APP_KEY?.trim()) && Boolean(env.BETTER_AUTH_URL?.trim());
}
export function buildQqAccountId(appId: string, openId: string) { return `${appId}:${openId}`; }
export async function buildQqInternalEmail(appId: string, openId: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(buildQqAccountId(appId, openId)));
  return `${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,"0")).join("")}@qq.starward.invalid`;
}
async function qqRequest(path: string, params: Record<string,string>) {
  const url = new URL(`https://graph.qq.com${path}`);
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("QQ request failed");
    const data = await response.json() as Record<string,unknown>;
    if (data.error || (data.ret !== undefined && data.ret !== 0)) throw new Error("QQ rejected request");
    return data;
  } catch {
    // Never surface URLs containing AppKey/code/token or provider response bodies.
    throw new APIError("BAD_REQUEST", { code:"QQ_AUTH_FAILED", message:"QQ 授权暂时不可用，请重新登录。" });
  }
}
export function buildQqProvider(env: AppBindings): GenericOAuthConfig | null {
  if (!isQqEnabled(env)) return null;
  const appId = env.QQ_APP_ID!.trim(); const appKey = env.QQ_APP_KEY!.trim();
  return {
    providerId:"qq", clientId:appId, clientSecret:appKey,
    authorizationUrl:"https://graph.qq.com/oauth2.0/authorize", tokenUrl:"https://graph.qq.com/oauth2.0/token",
    scopes:["get_user_info"], disableImplicitSignUp:true, overrideUserInfo:false,
    authorizationUrlParams(context): Record<string, string> {
      const agent = context.headers?.get("user-agent") ?? context.request?.headers.get("user-agent") ?? "";
      return /android|iphone|ipad|mobile/i.test(agent) ? { display:"mobile" } : {};
    },
    async getToken({code,redirectURI}) {
      const data = await qqRequest("/oauth2.0/token",{grant_type:"authorization_code",client_id:appId,client_secret:appKey,code,redirect_uri:redirectURI,fmt:"json"});
      if(typeof data.access_token!=="string" || !data.access_token || typeof data.expires_in!=="number" || data.expires_in<=0) throw new APIError("BAD_REQUEST",{code:"QQ_AUTH_FAILED",message:"QQ 授权未完成，请重试。"});
      return {accessToken:data.access_token,accessTokenExpiresAt:new Date(Date.now()+data.expires_in*1000),scopes:["get_user_info"]};
    },
    async getUserInfo(tokens) {
      if(!tokens.accessToken) return null;
      const identity=await qqRequest("/oauth2.0/me",{access_token:tokens.accessToken,fmt:"json"});
      if(String(identity.client_id)!==appId || typeof identity.openid!=="string" || !identity.openid || identity.openid.length>128) return null;
      const state=await getOAuthState();
      if(state?.link) {
        const ctx=await getCurrentAuthContext();
        const session=await getSessionFromCtx(ctx as GenericEndpointContext,{disableCookieCache:true});
        if(!session || session.user.id!==state.link.userId) throw new APIError("FORBIDDEN",{code:"QQ_LINK_SESSION_CHANGED",message:"绑定期间登录状态已变化，请重新登录后绑定。"});
        if(getRealAuthEmail(session.user.email) && !session.user.emailVerified) throw new APIError("FORBIDDEN",{code:"EMAIL_NOT_VERIFIED",message:"请先验证登录邮箱，再绑定 QQ。"});
      }
      const data=await qqRequest("/user/get_user_info",{access_token:tokens.accessToken,oauth_consumer_key:appId,openid:identity.openid});
      return {id:buildQqAccountId(appId,identity.openid),name:typeof data.nickname==="string"&&data.nickname.trim()?data.nickname:"QQ 作者",email:await buildQqInternalEmail(appId,identity.openid),emailVerified:false,image:typeof data.figureurl_qq_1==="string"&&data.figureurl_qq_1.startsWith("https://")?data.figureurl_qq_1:undefined};
    },
  };
}
