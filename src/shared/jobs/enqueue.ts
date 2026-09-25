import "server-only"

import type { PgBoss } from "pg-boss"

import { createBoss, ensureQueue } from "./boss"
import type { JobDefinition } from "./define"

let started: Promise<PgBoss> | undefined

/** The app's sender: small pool, no maintenance (the worker does that). */
function sender() {
  started ??= createBoss({ max: 2, supervise: false })
    .start()
    .catch((error: unknown) => {
      started = undefined
      throw error
    })
  return started
}

/**
 * Queues a job for the worker. `data` is validated against the job's
 * schema here, so a bad payload fails at the caller, not in the worker.
 * `singletonKey` drops duplicates while one with the same key is queued.
 */
export async function enqueue<T>(
  job: JobDefinition<T>,
  data: T,
  options: { singletonKey?: string } = {}
) {
  const payload = job.schema.parse(data)
  const boss = await sender()
  await ensureQueue(boss, job)
  return boss.send(job.name, payload as object, {
    singletonKey: options.singletonKey,
  })
}

/** Closes the sender's connections (tests, shutdown). */
export async function closeJobSender() {
  const boss = await started
  started = undefined
  await boss?.stop({ graceful: false })
}
