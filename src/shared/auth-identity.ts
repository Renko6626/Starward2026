import { z } from "zod";
export function isReservedAuthEmail(email: string) {
  return email.trim().toLowerCase().split("@")[1]?.endsWith(".invalid") ?? false;
}
export function getRealAuthEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value && !isReservedAuthEmail(value) ? value : null;
}
export const optionalContactEmailSchema = z.preprocess(
  value => typeof value === "string" ? value.trim().toLowerCase() || null : value ?? null,
  z.string().email("请填写有效邮箱，或留空。").max(320).refine(value => !isReservedAuthEmail(value), "请填写真实联系邮箱。").nullable(),
);
