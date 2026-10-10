import { getPortalEmailOtpValidityLabel } from "../../src/shared/email-otp";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function buildPortalOtpEmail(input: {
  otp: string;
  type: "sign-in" | "forget-password";
  siteUrl: string;
}) {
  const site = new URL(input.siteUrl);
  if (site.protocol !== "https:" && site.protocol !== "http:") {
    throw new Error("The email website URL must use HTTP or HTTPS.");
  }
  const homeUrl = site.origin;
  const resetting = input.type === "forget-password";
  const actionUrl = `${homeUrl}/portal/login${resetting ? "?reset=password" : ""}`;
  const title = resetting ? "重置登录密码" : "验证你的邮箱";
  const description = resetting
    ? "你正在重置逐星巡礼作者账号的登录密码。请在重置页面输入下方验证码，再设置新密码。"
    : "请在逐星巡礼账号页面输入下方验证码，继续注册或登录。";
  const action = resetting ? "继续重置密码" : "前往账号页面";
  const validity = getPortalEmailOtpValidityLabel();
  // Paint the corner beneath content; clients without gradients retain the solid background.
  const hatchedCells = [[0, 0], [3, 0], [6, 1], [1, 2], [4, 2], [2, 3], [0, 4], [5, 4], [3, 5], [1, 6], [6, 6]];
  const cornerTexture = [
    "linear-gradient(135deg,#111416 45%,rgba(17,20,22,.92) 65%,rgba(17,20,22,.18) 100%)",
    ...hatchedCells.map(() => "repeating-linear-gradient(135deg,rgba(160,200,216,.24) 0 1px,transparent 1px 6px)"),
    "linear-gradient(to right,rgba(160,200,216,.24) 1px,transparent 1px)",
    "linear-gradient(to bottom,rgba(160,200,216,.24) 1px,transparent 1px)",
  ].join(",");
  const textureSizes = ["100% 100%", ...hatchedCells.map(() => "24px 24px"), "24px 24px", "24px 24px"].join(",");
  const texturePositions = ["right bottom", ...hatchedCells.map(([x, y]) => `right ${x * 24}px bottom ${y * 24}px`), "right bottom", "right bottom"].join(",");
  const textureRepeats = ["no-repeat", ...hatchedCells.map(() => "no-repeat"), "repeat", "repeat"].join(",");
  const subject = `逐星巡礼 Starward2026 ${resetting ? "密码重置" : "邮箱"}验证码`;
  const text = ["逐星巡礼 / Starward Pilgrimage 2026", "", description, "",
    `验证码：${input.otp}`, `有效期：${validity}`, "请勿将验证码告知他人。", "",
    `${action}：${actionUrl}`, `项目网站：${homeUrl}`, "",
    "如果这不是你本人的操作，可以直接忽略此邮件。",
  ].join("\n");
  const html = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#090909;color:#e7e7e7;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(title)}，验证码 ${escapeHtml(input.otp)}，${validity}内有效。</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#090909" style="background-color:#090909;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="#111416" style="width:100%;max-width:560px;background-color:#111416;background-image:${cornerTexture};background-size:${textureSizes};background-position:${texturePositions};background-repeat:${textureRepeats};border:1px solid #475258;">
        <tr><td style="height:3px;background-color:#a0c8d8;font-size:0;line-height:3px;">&nbsp;</td></tr>
        <tr><td style="padding:24px;border-bottom:1px solid #343e43;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="58" style="vertical-align:middle;"><a href="${escapeHtml(homeUrl)}"><img src="${escapeHtml(`${homeUrl}/brand/moon-phase.png`)}" width="44" height="38" alt="逐星巡礼 logo" style="display:block;border:0;width:44px;height:38px;"></a></td>
            <td style="vertical-align:middle;"><a href="${escapeHtml(homeUrl)}" style="color:#f1f3f4;text-decoration:none;font-size:21px;font-weight:700;letter-spacing:2px;">逐星巡礼</a><div style="margin-top:6px;color:#a4b2b8;font-family:'Courier New',monospace;font-size:11px;line-height:16px;">Starward Pilgrimage 2026</div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:30px 24px 24px;">
          <h1 style="margin:0 0 14px;color:#f1f3f4;font-size:24px;font-weight:600;line-height:34px;">${title}</h1>
          <p style="margin:0;color:#b9c3c8;font-size:14px;line-height:25px;">${description}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border:1px solid #647c87;background-color:#090d10;">
            <tr><td align="center" style="padding:14px 12px 0;color:#a0c8d8;font-size:12px;line-height:20px;">一次性验证码</td></tr>
            <tr><td align="center" style="padding:8px 8px 10px;color:#f1f3f4;font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:6px;line-height:48px;">${escapeHtml(input.otp)}</td></tr>
            <tr><td align="center" style="padding:0 12px 16px;color:#a4b2b8;font-size:12px;line-height:20px;">${validity}内有效，请勿告知他人</td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td bgcolor="#c4dce6" style="background-color:#c4dce6;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;border:1px solid #c4dce6;padding:13px 22px;color:#101619;font-size:14px;font-weight:700;line-height:20px;text-decoration:none;">${action}</a></td></tr></table>
          <p style="margin:24px 0 0;color:#8f9ba2;font-size:12px;line-height:21px;">如果这不是你本人的操作，可以直接忽略此邮件。</p>
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #343e43;color:#89989f;font-size:11px;line-height:20px;">
          逐星巡礼账号服务<br><a href="${escapeHtml(homeUrl)}" style="color:#a0c8d8;text-decoration:underline;word-break:break-all;">${escapeHtml(homeUrl)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}
