import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  envDir: process.env.E2E_ROOT,
  resolve: { dedupe: ["three"] },
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    cloudflare({
      configPath: process.env.E2E_CONFIG_PATH,
      remoteBindings: false,
      persistState: process.env.E2E_STATE_PATH
        ? { path: process.env.E2E_STATE_PATH }
        : undefined,
      inspectorPort: process.env.E2E_MODE === "true" ? false : undefined,
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.E2E_PORT ?? 20262),
    strictPort: true,
  },
});
