export const LOCAL_D1_DATABASE_NAME: string;
export const LOCAL_D1_STATE_PATH: string;
export const LOCAL_PORTAL_COOKIE_NAME: string;

export type LocalDevSeedApplication = {
  id: string;
  contact_email: string;
};

export type LocalDevPortalSession = {
  slug: "pending-review" | "approved-participant";
  label: string;
  userEmail: string;
  sessionToken: string;
  targetPath: string;
};

export type LocalDevSeedFixtures = {
  applications: LocalDevSeedApplication[];
  portalSessions: LocalDevPortalSession[];
  eventWindows: {
    key: string;
    label: string;
    is_enabled: number;
    opens_at: string | null;
    closes_at: string | null;
    created_at: string;
    updated_at: string;
  }[];
};

export const localDevSeedFixtures: LocalDevSeedFixtures;

export function buildLocalSeedSql(): string;

export function createSignedSessionCookieValue(input: {
  sessionToken: string;
  secret: string;
}): Promise<string>;

export function buildLocalPortalSessionSummaries(input: {
  secret: string;
}): Promise<
  Array<{
    slug: string;
    label: string;
    userEmail: string;
    cookieName: string;
    cookieValue: string;
    cookieHeader: string;
    browserSnippet: string;
  }>
>;

export function readBetterAuthSecret(repoRoot: string): string | null;
