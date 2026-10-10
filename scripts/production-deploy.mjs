import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export function parseWranglerConfig(source) {
  const { config, error } = ts.parseConfigFileTextToJson("wrangler.jsonc", source);
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
  return config;
}

export function validateProductionConfig(config) {
  const production = config.env?.production;
  if (!production) throw new Error("wrangler.jsonc must define env.production.");

  const database = production.d1_databases?.find((binding) => binding.binding === "DB");
  if (!database || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(database.database_id ?? "")) {
    throw new Error("Set env.production.d1_databases.DB to the real production D1 database ID.");
  }
  const nonProductionDatabases = [
    ...(config.d1_databases ?? []),
    ...(config.env?.staging?.d1_databases ?? []),
  ];
  if (nonProductionDatabases.some((binding) => binding.database_id?.toLowerCase() === database.database_id.toLowerCase())) {
    throw new Error("Production must use a separate D1 database from local/staging bindings.");
  }

  let url;
  try { url = new URL(production.vars?.BETTER_AUTH_URL); }
  catch { throw new Error("Set env.production.vars.BETTER_AUTH_URL to the production HTTPS origin."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash ||
      url.hostname === "localhost" || /(^|\.)(example\.(com|org|net)|invalid)$/.test(url.hostname) || /replace-with/i.test(url.hostname)) {
    throw new Error("BETTER_AUTH_URL must be a real production HTTPS origin, without a path or placeholder.");
  }
  if (!production.routes?.some((route) => route.custom_domain === true && route.pattern === url.hostname)) {
    throw new Error("Add an env.production.routes custom_domain matching BETTER_AUTH_URL.");
  }
  for (const name of ["ALLOW_LOCAL_ADMIN_BYPASS", "ALLOW_LOCAL_DEV_ORIGINS"]) {
    if (String(production.vars?.[name]).toLowerCase() === "true") {
      throw new Error(name + " must not be enabled in production.");
    }
  }

  const otherNamespaceIds = new Set([
    ...(config.ratelimits ?? []),
    ...(config.env?.staging?.ratelimits ?? []),
  ].map((binding) => binding.namespace_id));
  const productionIds = new Set();
  for (const name of ["APPLICATION_SUBMIT_IP_RATE_LIMITER", "APPLICATION_SUBMIT_EMAIL_RATE_LIMITER"]) {
    const binding = production.ratelimits?.find((item) => item.name === name);
    if (!binding || !/^\d+$/.test(binding.namespace_id ?? "") || otherNamespaceIds.has(binding.namespace_id) || productionIds.has(binding.namespace_id)) {
      throw new Error("Configure " + name + " with a distinct production rate limit namespace ID.");
    }
    productionIds.add(binding.namespace_id);
  }
  return { productionUrl: url.origin };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const config = parseWranglerConfig(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
    const { productionUrl } = validateProductionConfig(config);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, "production_url=" + productionUrl + "\n");
    console.log("Production configuration is ready: " + productionUrl);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
