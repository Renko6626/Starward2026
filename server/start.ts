import type { AddressInfo } from "node:net";
import { startNodeServer } from "./node.ts";

/**
 * VPS entrypoint.
 *
 * `server/node.ts` intentionally exports `startNodeServer()` without invoking
 * it, so tests can import the module without binding a port. This entry is the
 * only place that actually starts listening; `vite.vps.config.ts` bundles it to
 * `dist-vps/node.mjs` so Node never has to resolve the extensionless
 * `worker/**` import graph at runtime.
 *
 * `startNodeServer()` loads and validates the environment, opens SQLite, and
 * applies pending migrations before `serve()` is called, so the first request
 * can never observe a partially provisioned schema.
 */
const server = await startNodeServer();

server.once("listening", () => {
  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? (address as AddressInfo).port : address;

  console.log(`Starward2026 VPS server listening on ${port ?? "unknown"}.`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    console.log(`Received ${signal}; shutting down.`);
    server.close(() => process.exit(0));
  });
}
