import type { CreateApplicationInput } from "../../shared/applications";

export function normalizeApplicationInput(
  form: CreateApplicationInput,
): CreateApplicationInput {
  return {
    contactEmail: form.contactEmail.trim(),
    contactHandle: normalizeOptional(form.contactHandle),
    interestFormat: form.interestFormat,
    introText: normalizeOptional(form.introText),
    portfolioUrl: normalizeOptional(form.portfolioUrl),
    messageToHosts: normalizeOptional(form.messageToHosts),
    turnstileToken: normalizeOptional(form.turnstileToken),
  };
}

export function getTurnstileSiteKey(env: {
  VITE_TURNSTILE_SITE_KEY?: string | undefined;
}) {
  const trimmed = env.VITE_TURNSTILE_SITE_KEY?.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
