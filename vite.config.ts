import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: { dedupe: ["three"] },
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react(), tailwindcss(), cloudflare({ remoteBindings: false })],
  server: {
    host: "0.0.0.0",
    port: 20262,
    strictPort: true,
  },
});
