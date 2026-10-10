import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseWranglerConfig, validateProductionConfig } from "./production-deploy.mjs";

const placeholder = "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID";

export async function prepareProductionDatabase(config, { accountId, apiToken, fetchImpl = fetch } = {}) {
  const prepared = structuredClone(config);
  const binding = prepared.env?.production?.d1_databases?.find((item) => item.binding === "DB");
  if (binding?.database_id !== placeholder) {
    validateProductionConfig(prepared);
    return prepared;
  }

  // Check all other deployment settings before creating any Cloudflare resource.
  binding.database_id = randomUUID();
  validateProductionConfig(prepared);
  const nonProduction = [...(config.d1_databases ?? []), ...(config.env?.staging?.d1_databases ?? [])];
  const name = binding.database_name;
  if (!name || nonProduction.some((item) => item.database_name?.toLowerCase() === name.toLowerCase())) {
    throw new Error("Set a dedicated production database_name; staging/local names cannot be reused.");
  }
  if (!/^[0-9a-f]{32}$/i.test(accountId ?? "")) throw new Error("Set CLOUDFLARE_ACCOUNT_ID to the deployment account's 32-character ID.");
  if (!apiToken) throw new Error("Missing CLOUDFLARE_API_TOKEN secret.");
  const endpoint = "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/d1/database";

  async function request(url, method = "GET", body) {
    const response = await fetchImpl(url, {
      method,
      headers: { Authorization: "Bearer " + apiToken, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    const payload = await response.json();
    if (!response.ok || payload.success !== true) {
      const codes = (payload.errors ?? []).map((error) => error.code).join(", ");
      throw new Error("Cloudflare D1 " + method + " failed (HTTP " + response.status + "; codes: " + codes + "). Check the deployment account and token's D1 permissions.");
    }
    return payload.result;
  }

  const matches = [];
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ name, per_page: "100", page: String(page) });
    const databases = await request(endpoint + "?" + query);
    if (!Array.isArray(databases)) throw new Error("Cloudflare returned an invalid D1 database list.");
    matches.push(...databases.filter((database) => database.name === name));
    if (databases.length < 100) break;
  }
  if (matches.length > 1) throw new Error("Multiple D1 databases match the production name; configure an explicit database_id.");
  const database = matches[0] ?? await request(endpoint, "POST", { name });
  if (database?.name !== name) throw new Error("Cloudflare returned a different database than the requested production name.");
  binding.database_id = database.uuid;
  validateProductionConfig(prepared);
  return prepared;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const configFile = new URL("../wrangler.jsonc", import.meta.url);
    const source = parseWranglerConfig(await readFile(configFile, "utf8"));
    const prepared = await prepareProductionDatabase(source, {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
    });
    await writeFile(configFile, JSON.stringify(prepared, null, 2) + "\n");
    const database = prepared.env.production.d1_databases.find((item) => item.binding === "DB");
    console.log("Production D1 ready: " + database.database_name + " (" + database.database_id + ")");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
