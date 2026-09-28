import { defineConfig } from "vite";

/**
 * Build config for the VPS Node entrypoint.
 *
 * `server/start.ts` and the shared `worker/**` / `src/shared/**` modules are
 * bundled into a single ESM file (`dist-vps/node.mjs`); node_modules stay
 * external and are resolved from the production `node_modules` tree at runtime.
 * This is required because the shared Worker import graph uses extensionless
 * specifiers that Node's ESM resolver cannot resolve without a bundler.
 *
 * Run with `npm run build:vps`. The SPA build (`npm run build`) is separate.
 */
export default defineConfig({
  publicDir: false,
  build: {
    ssr: "server/start.ts",
    outDir: "dist-vps",
    emptyOutDir: true,
    target: "node22",
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "node.mjs",
      },
    },
  },
});
