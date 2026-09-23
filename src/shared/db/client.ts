import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"
import { attachDatabasePool } from "@vercel/functions"
import { Pool } from "pg"

import { env } from "@/shared/config/env"

import { PrismaClient } from "./generated/client"

function createClient() {
  // Neon's pooled URL; PgBouncer does the real pooling, so keep ours small.
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 })
  // On Vercel Fluid compute, closes idle clients before the instance
  // suspends (neon-postgres skill). No-op elsewhere.
  attachDatabasePool(pool)
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

// Reuse one client across dev hot reloads so we don't leak connections.
const globalForDb = globalThis as unknown as { db?: PrismaClient }

export const db = globalForDb.db ?? createClient()

if (process.env.NODE_ENV !== "production") globalForDb.db = db
