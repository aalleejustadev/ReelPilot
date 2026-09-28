import "dotenv/config"

import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need Neon's direct (non-pooled) connection; PgBouncer's
    // transaction mode breaks Prisma Migrate. The app uses the pooled
    // DATABASE_URL through the adapter in src/shared/db.
    // Read with process.env (not env()) so `prisma generate` still works in
    // CI, where no database URL is set.
    url: process.env.DATABASE_URL_UNPOOLED,
  },
})
