import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

import { defineConfig } from "vitest/config"

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// Load .env so database tests can run locally; they skip when it's absent (CI).
// Variables already set in the shell win, as with dotenv (e.g. CI pointing
// storage at a local S3 server).
const envFile = fromRoot("./.env")
const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {}
const env = Object.fromEntries(
  Object.entries(fileEnv).filter(([name]) => process.env[name] === undefined)
)

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // Tests run outside React Server Components, where `server-only` throws.
      "server-only": fromRoot("./node_modules/server-only/empty.js"),
      // Next's font loader only runs inside Next's build.
      "next/font/google": fromRoot("./src/shared/testing/next-font-stub.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    env,
    // Database tests make several round trips to Neon per test (~300ms each
    // from a laptop); 5s was too tight. CI's local Postgres is much faster.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
