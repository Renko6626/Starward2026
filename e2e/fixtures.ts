import { createHmac } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import { buildLocalSeedSql } from "../scripts/lib/local-dev-bootstrap.mjs";

const secret = "e2e-local-secret-with-at-least-32-characters";
const sessionCookie = (token: string) => `${token}.${createHmac("sha256", secret).update(token).digest("base64")}`;

// Generated only in the temporary Worker entry; never present in production.
// Execute through D1 to avoid external SQLite connections racing workerd.
async function execute(statements: string[]) {
  const response = await fetch("http://127.0.0.1:21262/__e2e/fixture-sql", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ statements }),
  });
  if (!response.ok) throw new Error(`Fixture SQL failed: ${await response.text()}`);
  return await response.json() as { results: Record<string, string | number | null>[] }[];
}

export async function seed(sql: string) {
  // Fixtures contain ordinary SQL statements and SQL single-quoted strings.
  // Ignore semicolons inside strings, including escaped apostrophes.
  const statements = sql.match(/(?:[^;']|'(?:[^']|'')*')+/g)?.map(value => value.trim()).filter(Boolean) ?? [];
  await execute(statements);
}

export async function rows(sql: string) {
  return (await execute([sql]))[0].results;
}

export async function approveSecondAuthor() {
  await seed(`UPDATE participants SET status = 'approved' WHERE id = 'part_seed_pending';
    UPDATE applications SET status = 'approved' WHERE id = 'app_seed_portal_pending';
    UPDATE schedule_segments SET status = 'held', current_participant_id = 'part_seed_pending' WHERE id = 'seg_seed_101';
    UPDATE project_drafts SET segment_id = 'seg_seed_101' WHERE id = 'draft_seed_pending';`);
}

export const test = base.extend<{
  resetDatabase: void;
  authorContextOptions: import("@playwright/test").BrowserContextOptions;
  pendingPage: Page;
  approvedPage: Page;
  adminPage: Page;
}>({
  resetDatabase: [async ({}, use) => {
    await seed(`DELETE FROM segment_swap_requests;
      DELETE FROM collaboration_guards;
      DELETE FROM participant_events;
      DELETE FROM project_drafts;
      DELETE FROM schedule_segments;
      DELETE FROM participants;
      DELETE FROM applications;
      DELETE FROM "user";
      DELETE FROM verification;
      ${buildLocalSeedSql()}`);
    await use();
  }, { auto: true }],
  authorContextOptions: async ({ contextOptions, baseURL, viewport, deviceScaleFactor, isMobile, hasTouch, userAgent, reducedMotion }, use) => {
    await use({ ...contextOptions, baseURL, viewport, deviceScaleFactor, isMobile, hasTouch, userAgent, reducedMotion });
  },
  pendingPage: async ({ browser, authorContextOptions, baseURL }, use) => {
    const context = await browser.newContext(authorContextOptions);
    await context.addCookies([{ name: "better-auth.session_token", value: sessionCookie("starward-local-pending-session"), url: baseURL! }]);
    await use(await context.newPage());
    await context.close();
  },
  approvedPage: async ({ browser, authorContextOptions, baseURL }, use) => {
    const context = await browser.newContext(authorContextOptions);
    await context.addCookies([{ name: "better-auth.session_token", value: sessionCookie("starward-local-approved-session"), url: baseURL! }]);
    await use(await context.newPage());
    await context.close();
  },
  adminPage: async ({ browser, authorContextOptions }, use) => {
    const context = await browser.newContext({ ...authorContextOptions, extraHTTPHeaders: { "x-admin-email": "e2e-admin@starward.local" } });
    await use(await context.newPage());
    await context.close();
  },
});

export { expect };

export async function openPortal(page: Page) {
  await page.goto("/portal");
  await expect(page.getByRole("heading", { name: "作者档案" })).toBeVisible();
}

export async function openChapter(page: Page, id: string) {
  const chapter = page.locator(`#${id}`);
  if (await chapter.evaluate(element => element.tagName === "DETAILS" && !element.hasAttribute("open"))) {
    await chapter.locator(":scope > summary").click();
  }
  return chapter;
}
