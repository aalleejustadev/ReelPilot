import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

import { env } from "@/shared/config/env"

import { withStrictSsl } from "./connection-string"
import { PrismaClient } from "./generated/client"

function createClient() {
  // Neon's pooled URL; PgBouncer does the real pooling, so keep ours small.
  // Hosting is a long-running Node server (Hostinger), so a plain pool is
  // right; no serverless pool hooks needed.
  const pool = new Pool({
    connectionString: withStrictSsl(env.DATABASE_URL),
    max: 5,
  })
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    // Transactions that lock a row (plan limits) can queue behind each other;
    // Prisma's 2s/5s defaults were too tight with ~300ms round trips to Neon.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  })
}

// Reuse one client across dev hot reloads so we don't leak connections.
const globalForDb = globalThis as unknown as { db?: PrismaClient }

export const db = globalForDb.db ?? createClient()

if (process.env.NODE_ENV !== "production") globalForDb.db = db
