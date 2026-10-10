import { afterEach, expect, it, vi } from "vitest";
import { createAuth } from "./auth";
import { SqliteD1Fixture } from "../test/sqlite-d1";
import { ACTIVITY_RULES_VERSION } from "../../src/shared/activity-rules";
const fixtures: SqliteD1Fixture[]=[];
afterEach(()=>{vi.unstubAllGlobals();fixtures.splice(0).forEach(f=>f.sqlite.close());});
function setup() {
  const f=new SqliteD1Fixture(); fixtures.push(f);
  const env={DB:f.db,BETTER_AUTH_SECRET:"test-only-qq-secret-with-at-least-32-characters",BETTER_AUTH_URL:"http://localhost:20262",QQ_OAUTH_ENABLED:"true",QQ_APP_ID:"123456",QQ_APP_KEY:"test-qq-key"};
  let openId="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  let responseAppId="123456";
  vi.stubGlobal("fetch", vi.fn(async (input: string|URL|Request)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.hostname!=="graph.qq.com") throw new Error("Unexpected external request");
    if(url.pathname==="/oauth2.0/token") return Response.json({access_token:"test-token",expires_in:3600});
    if(url.pathname==="/oauth2.0/me") return Response.json({client_id:responseAppId,openid:openId});
    return Response.json({ret:0,nickname:"QQ 作者",figureurl_qq_1:"https://example.com/avatar.png"});
  }));
  const auth=createAuth(env);
  const request=async(path:string,body?:object,cookie="",consent:string|null=null)=>{
    (await auth.$context).skipOriginCheck=false;
    return auth.handler(new Request(`http://localhost:20262/api/auth${path}`,{method:body?"POST":"GET",headers:{"user-agent":"iPhone test-browser",origin:env.BETTER_AUTH_URL,"content-type":"application/json",cookie,...(consent?{"x-starward-rules-version":consent}:{})},body:body?JSON.stringify(body):undefined}));
  };
  const cookies=(r:Response)=>r.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");
  const start=async(signUp=false,cookie="",link=false)=>{
    const r=await request(link?"/oauth2/link":"/sign-in/oauth2",{providerId:"qq",requestSignUp:signUp,callbackURL:"/portal",newUserCallbackURL:"/portal",errorCallbackURL:"/portal/login",disableRedirect:true},cookie,signUp?ACTIVITY_RULES_VERSION:null);
    expect(r.status).toBe(200);
    const data=await r.json() as {url:string};
    expect(new URL(data.url).searchParams.get("display")).toBe("mobile");
    const state=new URL(data.url).searchParams.get("state");
    return {state,cookie:[cookie,cookies(r)].filter(Boolean).join("; ")};
  };
  const finish=(s:{state:string|null;cookie:string})=>request(`/oauth2/callback/qq?code=test-code&state=${s.state}`,undefined,s.cookie);
  return {f,auth,request,cookies,start,finish,setOpenId:(id:string)=>{openId=id;},setAppId:(id:string)=>{responseAppId=id;}};
}
it("creates one QQ account without email and reuses its session and workspace",async()=>{
  const t=setup();
  const initial=await t.finish(await t.start(true)); expect(initial.status).toBe(302); expect(initial.headers.get("location")).toContain("/portal");
  const session=await t.request("/get-session",undefined,t.cookies(initial)); const user=(await session.json() as {user:{id:string}}).user; expect(user.id).toBeTruthy();
  expect(t.f.sqlite.prepare("SELECT providerId FROM account").get()).toMatchObject({providerId:"qq"});
  expect(t.f.sqlite.prepare("SELECT invite_email,status FROM participants").get()).toMatchObject({invite_email:null,status:"pending"});
  expect(t.f.sqlite.prepare("SELECT rules_version FROM activity_rule_acceptances").get()).toMatchObject({rules_version:ACTIVITY_RULES_VERSION});
  const again=await t.finish(await t.start()); expect(again.headers.get("location")).toContain("/portal");
  const againSession=await t.request("/get-session",undefined,t.cookies(again)); expect((await againSession.json() as {user:{id:string}}).user.id).toBe(user.id);
  expect(t.f.sqlite.prepare('SELECT count(*) AS n FROM "user"').get()).toMatchObject({n:1});
  expect(t.f.sqlite.prepare("SELECT count(*) AS n FROM participants").get()).toMatchObject({n:1});
});
it("requires consent for first signup and rejects callback state reuse or absence",async()=>{
  const t=setup();
  const absent=await t.finish(await t.start()); expect(absent.headers.get("location")).toContain("error=");
  expect(t.f.sqlite.prepare('SELECT count(*) AS n FROM "user"').get()).toMatchObject({n:0});
  const missingConsent=await t.request("/sign-in/oauth2",{providerId:"qq",requestSignUp:true});expect(missingConsent.status).toBe(403);
  const start=await t.start(true); const first=await t.finish(start);expect(first.headers.get("location")).not.toContain("error=");
  const repeated=await t.finish(start);expect(repeated.headers.get("location")).toContain("error=");
  const other=await t.start(true);const wrong=await t.finish({...other,cookie:""});expect(wrong.headers.get("location")).toContain("error=");
  expect(t.f.sqlite.prepare('SELECT count(*) AS n FROM "user"').get()).toMatchObject({n:1});
});
it("links QQ to an existing email user without changing user or participant",async()=>{
  const t=setup();
  const signup=await t.request("/sign-up/email",{email:"existing@example.com",password:"a-password-123",name:"Existing"},"",ACTIVITY_RULES_VERSION);
  expect(signup.status).toBe(200);const old=(await signup.json() as {user:{id:string}}).user;
  const participant=t.f.sqlite.prepare("SELECT id FROM participants").get();
  const bound=await t.finish(await t.start(false,t.cookies(signup),true));expect(bound.headers.get("location")).not.toContain("error=");
  const login=await t.finish(await t.start()); const session=await t.request("/get-session",undefined,t.cookies(login));
  expect((await session.json() as {user:{id:string;email:string}}).user).toMatchObject({id:old.id,email:"existing@example.com"});
  expect(t.f.sqlite.prepare("SELECT id FROM participants").get()).toEqual(participant);
  expect(t.f.sqlite.prepare('SELECT count(*) AS n FROM "user"').get()).toMatchObject({n:1});
});
it("rejects reserved email authentication and rolls back when consent storage fails",async()=>{
  const t=setup();
  const reserved=await t.request("/sign-up/email",{email:"x@qq.starward.invalid",password:"a-password-123",name:"Fake"},"",ACTIVITY_RULES_VERSION);expect(reserved.status).toBe(403);
  t.f.sqlite.exec("CREATE TRIGGER fail_rules BEFORE INSERT ON activity_rule_acceptances BEGIN SELECT RAISE(ABORT,'unavailable'); END");
  const response=await t.finish(await t.start(true));expect(response.headers.get("location")).toContain("error=");
  for(const table of ['user','account','session','participants']) expect(t.f.sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get()).toMatchObject({n:0});
});

it("rejects stale consent, expired state and an identity from another QQ app", async () => {
  const t=setup();
  const stale=await t.start(true);
  t.f.sqlite.prepare("UPDATE verification SET value=json_set(value,'$.starwardRulesVersion','old-rules') WHERE identifier=?").run(stale.state);
  expect((await t.finish(stale)).headers.get("location")).toContain("error=");
  const expired=await t.start(true);
  t.f.sqlite.prepare("UPDATE verification SET value=json_set(value,'$.expiresAt',0) WHERE identifier=?").run(expired.state);
  expect((await t.finish(expired)).headers.get("location")).toContain("error=");
  t.setAppId("654321");
  expect((await t.finish(await t.start(true))).headers.get("location")).toContain("error=");
  expect(t.f.sqlite.prepare('SELECT count(*) AS n FROM "user"').get()).toMatchObject({n:0});
});
it("keeps QQ ownership when another user tries to bind it, or the linking session disappears", async () => {
  const t=setup(); await t.finish(await t.start(true));
  const qqUser=t.f.sqlite.prepare("SELECT userId FROM account WHERE providerId='qq'").get();
  const signup=await t.request("/sign-up/email",{email:"other@example.com",password:"a-password-123",name:"Other"},"",ACTIVITY_RULES_VERSION);
  const cookie=t.cookies(signup);
  const conflict=await t.finish(await t.start(false,cookie,true));
  expect(conflict.headers.get("location")).toContain("account_already_linked");
  expect(t.f.sqlite.prepare("SELECT userId FROM account WHERE providerId='qq'").get()).toEqual(qqUser);
  t.setOpenId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
  const missing=await t.start(false,cookie,true);
  missing.cookie=missing.cookie.split("; ").filter(v=>!v.startsWith("better-auth.session_token=")).join("; ");
  expect((await t.finish(missing)).headers.get("location")).toContain("/portal/login?error=");
  expect(t.f.sqlite.prepare("SELECT count(*) AS n FROM account WHERE providerId='qq'").get()).toMatchObject({n:1});
});
it("does not create duplicate users or participants during simultaneous first authorizations", async () => {
  const t=setup();const a=await t.start(true);const b=await t.start(true);
  const results=await Promise.all([t.finish(a),t.finish(b)]);
  expect(results.some(r=>r.status===302&&!r.headers.get("location")?.includes("error="))).toBe(true);
  for(const table of ["user","participants","activity_rule_acceptances"]) expect(t.f.sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get()).toMatchObject({n:1});
  expect(t.f.sqlite.prepare("SELECT count(*) AS n FROM account WHERE providerId='qq'").get()).toMatchObject({n:1});
  expect((await t.finish(await t.start())).headers.get("location")).not.toContain("error=");
});
it("cleans only a new QQ identity when account or workspace initialization fails", async () => {
  for (const failingTable of ["user","account","session","participants"]) {
    const t=setup();
    t.f.sqlite.exec(`CREATE TRIGGER fail_signup BEFORE INSERT ON ${failingTable} BEGIN SELECT RAISE(ABORT,'signup unavailable'); END`);
    await t.finish(await t.start(true));
    for (const table of ["user","account","session","participants","activity_rule_acceptances"]) expect(t.f.sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get(),`${failingTable}: ${table}`).toMatchObject({n:0});
    t.f.sqlite.exec("DROP TRIGGER fail_signup");
    const retry=await t.finish(await t.start(true)); expect(retry.headers.get("location")).not.toContain("error=");
  }
});
it("preserves existing QQ identity and sessions when a later workspace update fails", async () => {
  const t=setup();await t.finish(await t.start(true));
  const user=t.f.sqlite.prepare('SELECT id FROM "user"').get();
  t.f.sqlite.exec("CREATE TRIGGER fail_update BEFORE UPDATE ON participants BEGIN SELECT RAISE(ABORT,'workspace unavailable'); END");
  const failed=await t.finish(await t.start());expect(failed.headers.get("location")).toContain("error=");
  expect(t.f.sqlite.prepare('SELECT id FROM "user"').get()).toEqual(user);
  for (const table of ["user","account","session","participants","activity_rule_acceptances"]) expect(t.f.sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get()).toMatchObject({n:1});
  t.f.sqlite.exec("DROP TRIGGER fail_update");
  expect((await t.finish(await t.start())).headers.get("location")).not.toContain("error=");
});
