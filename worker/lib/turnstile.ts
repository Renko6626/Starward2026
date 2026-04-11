import { HTTPException } from "hono/http-exception";
import type { AppContext } from "./types";

type TurnstileResult = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(c: AppContext, token: string | undefined) {
  const secret = c.env.TURNSTILE_SECRET_KEY ?? c.env.TURNSTILE_SECRET;

  if (!secret) {
    return;
  }

  if (!token) {
    throw new HTTPException(400, {
      message: "Turnstile token is required.",
    });
  }

  const ip = c.req.header("cf-connecting-ip") ?? "";
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  if (ip) {
    formData.append("remoteip", ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new HTTPException(502, {
      message: "Turnstile verification request failed.",
    });
  }

  const payload = (await response.json()) as TurnstileResult;

  if (!payload.success) {
    throw new HTTPException(400, {
      message: "Turnstile verification failed.",
    });
  }
}
