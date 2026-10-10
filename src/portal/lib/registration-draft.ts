import { z } from "zod";
import { applicationInterestFormatSchema } from "../../shared/applications";

// Accept incomplete fields: this is an unsent form, never a valid submission.
const draftSchema = z.object({
  profile: z.object({
    creditName: z.string(), bilibiliUid: z.string(), contactEmail: z.string().nullable(),
    primaryContactChannel: z.string(), primaryContactHandle: z.string(),
    backupContact: z.string().optional(), isAnonymous: z.boolean(),
  }),
  application: z.object({
    contactEmail: z.string().nullable(), contactHandle: z.string().optional(),
    interestFormat: applicationInterestFormatSchema, introText: z.string().default(""),
    portfolioUrl: z.string().optional(), messageToHosts: z.string().optional(),
  }),
  segmentId: z.string(),
});

export function parseRegistrationDraft(raw: string | null) {
  try {
    const result = draftSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success ? result.data : null;
  } catch { return null; }
}

export const registrationDraftKey = (userId: string) => `starward-registration-draft:${userId}`;
