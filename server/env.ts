export const DEFAULT_SQLITE_PATH = "./data/starward.sqlite";
export const DEFAULT_RESEND_FROM_NAME = "Starward2026";
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = "0.0.0.0";

export const VPS_ADMIN_MODES = ["better-auth", "disabled"] as const;
export type VpsAdminMode = (typeof VPS_ADMIN_MODES)[number];
export const DEFAULT_VPS_ADMIN_MODE: VpsAdminMode = "better-auth";

export const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];
export const DEFAULT_NODE_ENVIRONMENT: NodeEnvironment = "production";

/**
 * Validated, platform-neutral configuration for the Node/VPS runtime.
 *
 * Values are normalized (trimmed, URL canonicalized, enum lowercased) so the
 * Node entrypoint can map them onto `AppBindings` without re-parsing.
 */
export type NodeRuntimeEnv = {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  RESEND_FROM_NAME: string;
  TURNSTILE_SECRET_KEY?: string;
  SQLITE_PATH: string;
  VPS_ADMIN_MODE: VpsAdminMode;
  PORT: number;
  HOST: string;
  NODE_ENV: NodeEnvironment;
  ALLOW_LOCAL_DEV_ORIGINS: boolean;
  ALLOW_LOCAL_ADMIN_BYPASS: boolean;
};

/**
 * Startup configuration error. Messages name the offending variable but never
 * echo its value, so secrets cannot leak into logs.
 */
export class NodeRuntimeEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeRuntimeEnvError";
  }
}

export function loadNodeRuntimeEnv(source: NodeJS.ProcessEnv = process.env): NodeRuntimeEnv {
  return {
    BETTER_AUTH_SECRET: readRequired(source, "BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: readRequiredUrl(source, "BETTER_AUTH_URL"),
    BETTER_AUTH_TRUSTED_ORIGINS: readOptional(source, "BETTER_AUTH_TRUSTED_ORIGINS"),
    RESEND_API_KEY: readRequired(source, "RESEND_API_KEY"),
    RESEND_FROM_EMAIL: readRequired(source, "RESEND_FROM_EMAIL"),
    RESEND_FROM_NAME: readOptional(source, "RESEND_FROM_NAME") ?? DEFAULT_RESEND_FROM_NAME,
    TURNSTILE_SECRET_KEY: readOptional(source, "TURNSTILE_SECRET_KEY"),
    SQLITE_PATH: readOptional(source, "SQLITE_PATH") ?? DEFAULT_SQLITE_PATH,
    VPS_ADMIN_MODE: readEnum(source, "VPS_ADMIN_MODE", VPS_ADMIN_MODES, DEFAULT_VPS_ADMIN_MODE),
    PORT: readPort(source),
    HOST: readOptional(source, "HOST") ?? DEFAULT_HOST,
    NODE_ENV: readEnum(source, "NODE_ENV", NODE_ENVIRONMENTS, DEFAULT_NODE_ENVIRONMENT),
    ALLOW_LOCAL_DEV_ORIGINS: readBoolean(source, "ALLOW_LOCAL_DEV_ORIGINS", false),
    ALLOW_LOCAL_ADMIN_BYPASS: readBoolean(source, "ALLOW_LOCAL_ADMIN_BYPASS", false),
  };
}

function readTrimmed(source: NodeJS.ProcessEnv, name: string) {
  const value = source[name];
  return typeof value === "string" ? value.trim() : "";
}

function readOptional(source: NodeJS.ProcessEnv, name: string) {
  const value = readTrimmed(source, name);
  return value === "" ? undefined : value;
}

function readRequired(source: NodeJS.ProcessEnv, name: string) {
  const value = readOptional(source, name);

  if (value === undefined) {
    throw new NodeRuntimeEnvError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readRequiredUrl(source: NodeJS.ProcessEnv, name: string) {
  const value = readRequired(source, name);

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new NodeRuntimeEnvError(`Invalid ${name}: expected an absolute http(s) URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new NodeRuntimeEnvError(`Invalid ${name}: expected an absolute http(s) URL.`);
  }

  return url.toString().replace(/\/+$/, "");
}

function readEnum<T extends string>(
  source: NodeJS.ProcessEnv,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = readOptional(source, name);

  if (value === undefined) {
    return fallback;
  }

  const normalized = value.toLowerCase() as T;

  if (!allowed.includes(normalized)) {
    throw new NodeRuntimeEnvError(
      `Invalid ${name}: expected one of ${allowed.join(", ")}.`,
    );
  }

  return normalized;
}

const TRUTHY_FLAGS = new Set(["1", "true", "yes", "on"]);
const FALSY_FLAGS = new Set(["0", "false", "no", "off"]);

function readBoolean(source: NodeJS.ProcessEnv, name: string, fallback: boolean) {
  const value = readOptional(source, name);

  if (value === undefined) {
    return fallback;
  }

  const normalized = value.toLowerCase();

  if (TRUTHY_FLAGS.has(normalized)) {
    return true;
  }

  if (FALSY_FLAGS.has(normalized)) {
    return false;
  }

  throw new NodeRuntimeEnvError(`Invalid ${name}: expected a boolean value (true/false).`);
}

function readPort(source: NodeJS.ProcessEnv) {
  const value = readOptional(source, "PORT");

  if (value === undefined) {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new NodeRuntimeEnvError("Invalid PORT: expected an integer between 1 and 65535.");
  }

  const port = Number(value);

  if (port < 1 || port > 65535) {
    throw new NodeRuntimeEnvError("Invalid PORT: expected an integer between 1 and 65535.");
  }

  return port;
}
