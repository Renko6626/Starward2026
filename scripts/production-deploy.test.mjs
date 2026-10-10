import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseWranglerConfig, validateProductionConfig } from "./production-deploy.mjs";

const template = parseWranglerConfig(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
function readyConfig() {
  const config = structuredClone(template);
  const production = config.env.production;
  production.d1_databases[0].database_id = "11111111-2222-4333-8444-555555555555";
  production.vars.BETTER_AUTH_URL = "https://starward.mucwiki-edge.link";
  production.routes = [{ pattern: "starward.mucwiki-edge.link", custom_domain: true }];
  return config;
}

test("JSONC comments are supported and malformed configuration fails", () => {
  assert.equal(parseWranglerConfig('{ // comment\n "name": "worker" }').name, "worker");
  assert.throws(() => parseWranglerConfig('{ "name": }'));
});

test("ready production config returns the HTTPS origin", () => {
  assert.deepEqual(validateProductionConfig(readyConfig()), { productionUrl: "https://starward.mucwiki-edge.link" });
});

test("placeholder database IDs and shared staging databases are rejected", () => {
  const config = readyConfig();
  config.env.production.d1_databases[0].database_id = "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID";
  assert.throws(() => validateProductionConfig(config), /real production D1/);
  config.env.production.d1_databases[0].database_id = config.env.staging.d1_databases[0].database_id;
  assert.throws(() => validateProductionConfig(config), /separate D1 database/);
});

test("invalid origins and custom-domain mismatches are rejected", () => {
  for (const origin of ["http://starward.mucwiki-edge.link", "https://replace-with-production-domain.example.com", "https://starward.mucwiki-edge.link/path", "https://starward.mucwiki-edge.link/?x=1", "https://user:password@starward.mucwiki-edge.link", "https://localhost"]) {
    const config = readyConfig();
    config.env.production.vars.BETTER_AUTH_URL = origin;
    assert.throws(() => validateProductionConfig(config), /HTTPS origin/);
  }
  const config = readyConfig();
  config.env.production.routes[0].pattern = "staging.mucwiki-edge.link";
  assert.throws(() => validateProductionConfig(config), /custom_domain/);
});

test("dev bypasses and missing or shared rate limit bindings are rejected", () => {
  for (const name of ["ALLOW_LOCAL_ADMIN_BYPASS", "ALLOW_LOCAL_DEV_ORIGINS"]) {
    const config = readyConfig();
    config.env.production.vars[name] = "true";
    assert.throws(() => validateProductionConfig(config), /must not be enabled/);
  }
  const config = readyConfig();
  config.env.production.ratelimits = [];
  assert.throws(() => validateProductionConfig(config), /rate limit namespace/);
  config.env.production.ratelimits = structuredClone(config.env.staging.ratelimits);
  assert.throws(() => validateProductionConfig(config), /rate limit namespace/);
});
