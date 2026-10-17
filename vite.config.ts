import vinext from "vinext";
import {defineConfig} from "vite";
import {cloudflare} from "@cloudflare/vite-plugin";

process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
process.env.WRANGLER_SEND_METRICS ??= "false";

export default defineConfig({
  plugins: [vinext(), cloudflare({
    viteEnvironment: {name: "rsc", childEnvironments: ["ssr"]},
    inspectorPort: false,
    config: {
      name: "pulse-market-dashboard",
      main: "./build/worker.ts",
      compatibility_date: "2026-05-15",
      compatibility_flags: ["nodejs_compat"],
      d1_databases: [{binding: "DB", database_name: "pulse-market-dashboard", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: "drizzle"}]
    }
  })]
});
