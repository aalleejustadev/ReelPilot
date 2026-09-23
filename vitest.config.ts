import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

import { defineConfig } from "vitest/config"

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Load .env so database tests can run locally; they skip when it's absent (CI).
const envFile = fromRoot("./.env")
const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {}

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // Tests run outside React Server Components, where `server-only` throws.
      "server-only": fromRoot("./node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    env,
  },
})
