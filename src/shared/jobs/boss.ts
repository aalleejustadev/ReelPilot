import "server-only"

import { PgBoss } from "pg-boss"

import { env } from "@/shared/config/env"

import type { JobDefinition } from "./define"

/**
 * pg-boss keeps its queue in the `pgboss` schema of our Postgres. It needs
 * a direct (unpooled) connection: it takes advisory locks, which PgBouncer's
 * transaction mode doesn't keep (build plan §4).
 */
export function createBoss(options: { max: number; supervise: boolean }) {
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL_UNPOOLED,
    max: options.max,
    supervise: options.supervise,
    schedule: false,
  })
  boss.on("error", (error: unknown) => console.error("pg-boss error", error))
  return boss
}

const knownQueues = new WeakMap<PgBoss, Set<string>>()

/** Creates the job's queue with its retry policy, once per process. */
export async function ensureQueue(boss: PgBoss, job: JobDefinition<unknown>) {
  let known = knownQueues.get(boss)
  if (!known) knownQueues.set(boss, (known = new Set()))
  if (known.has(job.name)) return

  if (!(await boss.getQueue(job.name))) {
    await boss
      .createQueue(job.name, {
        retryLimit: job.policy.retryLimit,
        retryDelay: job.policy.retryDelaySeconds,
        retryBackoff: true,
        expireInSeconds: job.policy.timeoutSeconds,
      })
      .catch(async (error: unknown) => {
        // Another process created it first.
        if (!(await boss.getQueue(job.name))) throw error
      })
  }
  known.add(job.name)
}
