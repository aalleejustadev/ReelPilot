import "server-only"

import type { PgBoss } from "pg-boss"

import { createBoss, ensureQueue } from "./boss"
import type { JobDefinition } from "./define"

export type JobHandler<T> = (
  data: T,
  context: {
    jobId: string
    signal: AbortSignal
    /** No retries left after this one: record the failure for the user. */
    isLastAttempt: boolean
  }
) => Promise<void>

export type RegisteredJob<T = never> = {
  job: JobDefinition<T>
  handler: JobHandler<T>
}

/** Pairs a job with the function that runs it (used by `startWorkers`). */
export function handle<T>(
  job: JobDefinition<T>,
  handler: JobHandler<T>
): RegisteredJob<T> {
  return { job, handler }
}

/**
 * Starts pg-boss with maintenance on and runs each registered job, one at a
 * time per queue. A thrown error fails the attempt; pg-boss retries it with
 * backoff up to the job's retryLimit. Returns the boss so callers can stop it.
 */
export async function startWorkers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a list of jobs with different payload types
  registrations: RegisteredJob<any>[],
  options: { boss?: PgBoss; pollingIntervalSeconds?: number } = {}
) {
  const boss = options.boss ?? createBoss({ max: 5, supervise: true })
  if (!options.boss) await boss.start()

  for (const { job, handler } of registrations) {
    await ensureQueue(boss, job)
    await boss.work(
      job.name,
      {
        pollingIntervalSeconds: options.pollingIntervalSeconds ?? 2,
        includeMetadata: true,
      },
      async ([item]) => {
        if (!item) return
        const data = job.schema.parse(item.data)
        const started = Date.now()
        console.info(`[job] ${job.name} ${item.id} started`)
        try {
          await handler(data, {
            jobId: item.id,
            signal: item.signal,
            isLastAttempt: item.retryCount >= item.retryLimit,
          })
          console.info(
            `[job] ${job.name} ${item.id} done in ${Date.now() - started}ms`
          )
        } catch (error) {
          console.error(`[job] ${job.name} ${item.id} failed`, error)
          throw error
        }
      }
    )
  }
  return boss
}

/** A periodic task the worker runs on a timer (e.g. expiring stale rows). */
export type MaintenanceTask = {
  name: string
  everyMs: number
  run: () => Promise<void>
}

/** Runs each task now and then every `everyMs`; returns a stop function. */
export function startMaintenance(tasks: MaintenanceTask[]) {
  const timers = tasks.map((task) => {
    const run = () =>
      task
        .run()
        .catch((error: unknown) =>
          console.error(`[maintenance] ${task.name} failed`, error)
        )
    void run()
    return setInterval(run, task.everyMs)
  })
  return () => timers.forEach(clearInterval)
}
