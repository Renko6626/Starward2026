export function getPasswordAuthErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "EMAIL_NOT_VERIFIED") return "此邮箱尚未验证，请使用邮箱验证码登录，再设置密码。";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") {
    return "邮箱或密码不正确，请检查后重试，也可使用邮箱验证码登录。";
  }
  return error.message || "注册或登录失败，请检查邮箱和密码。";
}
