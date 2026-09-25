import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

import { env } from "@/shared/config/env"

import { PrismaClient } from "./generated/client"

function createClient() {
  // Neon's pooled URL; PgBouncer does the real pooling, so keep ours small.
  // Hosting is a long-running Node server (Hostinger), so a plain pool is
  // right; no serverless pool hooks needed.
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 })
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

// Reuse one client across dev hot reloads so we don't leak connections.
const globalForDb = globalThis as unknown as { db?: PrismaClient }

export const db = globalForDb.db ?? createClient()

if (process.env.NODE_ENV !== "production") globalForDb.db = db
