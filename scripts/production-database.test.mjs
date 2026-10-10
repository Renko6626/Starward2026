import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseWranglerConfig } from "./production-deploy.mjs";
import { prepareProductionDatabase } from "./production-database.mjs";

const template = parseWranglerConfig(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const productionId = "11111111-2222-4333-8444-555555555555";
const accountId = "a".repeat(32);
function config() {
  const value = structuredClone(template);
  value.env.production.d1_databases[0].database_id = "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID";
  return value;
}
function response(result, status = 200, success = true) {
  return { ok: status < 400, status, json: async () => ({ result, success, errors: [{ code: 10000 }] }) };
}
function options(fetchImpl) { return { accountId, apiToken: "test-token", fetchImpl }; }

test("resolves the exact existing production database without creating or changing staging", async () => {
  const original = config();
  const prepared = await prepareProductionDatabase(original, options(async (url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(new URL(url).searchParams.get("name"), "starward2026-prod");
    return response([{ name: "starward2026-prod-other", uuid: "ignore" }, { name: "starward2026-prod", uuid: productionId }]);
  }));
  assert.equal(prepared.env.production.d1_databases[0].database_id, productionId);
  assert.equal(original.env.production.d1_databases[0].database_id, "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID");
  assert.deepEqual(prepared.env.staging, original.env.staging);
});

test("creates the dedicated database only when it is absent", async () => {
  const methods = [];
  const prepared = await prepareProductionDatabase(config(), options(async (url, init) => {
    methods.push(init.method);
    if (init.method === "GET") return response([]);
    assert.deepEqual(JSON.parse(init.body), { name: "starward2026-prod" });
    return response({ name: "starward2026-prod", uuid: productionId });
  }));
  assert.deepEqual(methods, ["GET", "POST"]);
  assert.equal(prepared.env.production.d1_databases[0].database_id, productionId);
});

test("honors an explicit database UUID without calling Cloudflare", async () => {
  const value = config();
  value.env.production.d1_databases[0].database_id = productionId;
  await prepareProductionDatabase(value, options(() => { throw new Error("unexpected network call"); }));
});

test("rejects invalid domains, shared database names and missing credentials before network access", async () => {
  const noNetwork = options(() => { throw new Error("unexpected network call"); });
  const badDomain = config();
  badDomain.env.production.routes = [];
  await assert.rejects(prepareProductionDatabase(badDomain, noNetwork), /custom_domain/);
  const sharedName = config();
  sharedName.env.production.d1_databases[0].database_name = sharedName.env.staging.d1_databases[0].database_name;
  await assert.rejects(prepareProductionDatabase(sharedName, noNetwork), /dedicated production/);
  await assert.rejects(prepareProductionDatabase(config(), { ...noNetwork, accountId: "" }), /CLOUDFLARE_ACCOUNT_ID/);
  await assert.rejects(prepareProductionDatabase(config(), { ...noNetwork, apiToken: "" }), /CLOUDFLARE_API_TOKEN/);
});

test("fails closed on authentication errors, ambiguous names and a staging UUID", async () => {
  await assert.rejects(prepareProductionDatabase(config(), options(async () => response(null, 403, false))), /HTTP 403/);
  const duplicate = { name: "starward2026-prod", uuid: productionId };
  await assert.rejects(prepareProductionDatabase(config(), options(async () => response([duplicate, duplicate]))), /Multiple D1/);
  const stagingId = template.env.staging.d1_databases[0].database_id;
  await assert.rejects(prepareProductionDatabase(config(), options(async () => response([{ name: "starward2026-prod", uuid: stagingId }]))), /separate D1/);
});

test("searches subsequent pages before deciding to create a database", async () => {
  const pages = [];
  const prepared = await prepareProductionDatabase(config(), options(async (url, init) => {
    assert.equal(init.method, "GET");
    const page = new URL(url).searchParams.get("page");
    pages.push(page);
    return response(page === "1" ? Array.from({ length: 100 }, (_, index) => ({ name: "other-" + index })) : [{ name: "starward2026-prod", uuid: productionId }]);
  }));
  assert.deepEqual(pages, ["1", "2"]);
  assert.equal(prepared.env.production.d1_databases[0].database_id, productionId);
});
