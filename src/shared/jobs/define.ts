import type { z } from "zod"

/** Retry and timing policy for a job's queue (pg-boss queue options). */
export type JobQueuePolicy = {
  /** Attempts after the first. Build plan §9: 3 with backoff. */
  retryLimit: number
  /** First retry delay in seconds; doubles each time (with jitter). */
  retryDelaySeconds: number
  /** A running job is failed (and retried) after this long. */
  timeoutSeconds: number
}

export type JobDefinition<T> = {
  /** Queue name, e.g. "footage.process". */
  name: string
  schema: z.ZodType<T>
  policy: JobQueuePolicy
}

/**
 * Declares a background job. Features keep their definitions in
 * `jobs/`; the app enqueues them with `enqueue`, the worker runs them
 * with `startWorkers`.
 */
export function defineJob<T>(definition: JobDefinition<T>) {
  return definition
}
