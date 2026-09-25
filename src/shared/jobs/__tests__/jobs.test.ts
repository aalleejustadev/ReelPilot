import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { defineJob } from "../define"

// Needs a database; skipped when DATABASE_URL_UNPOOLED is unset.
const hasDatabase = Boolean(process.env.DATABASE_URL_UNPOOLED)

async function waitFor(check: () => boolean, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > until) throw new Error("Timed out waiting")
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

describe.runIf(hasDatabase)("background jobs (pg-boss)", () => {
  let jobs: typeof import("../index")
  let worker: typeof import("../worker")
  let boss: Awaited<ReturnType<typeof import("../worker").startWorkers>>

  // Unique queue names so parallel runs never share a queue.
  const run = randomUUID().slice(0, 8)
  const echoJob = defineJob({
    name: `test.echo.${run}`,
    schema: z.object({ message: z.string() }),
    policy: { retryLimit: 0, retryDelaySeconds: 1, timeoutSeconds: 60 },
  })
  const flakyJob = defineJob({
    name: `test.flaky.${run}`,
    schema: z.object({ id: z.string() }),
    policy: { retryLimit: 3, retryDelaySeconds: 1, timeoutSeconds: 60 },
  })

  const received: string[] = []
  const attempts = new Map<string, number>()
  const lastAttemptFlags: boolean[] = []

  beforeAll(async () => {
    jobs = await import("../index")
    worker = await import("../worker")
    boss = await worker.startWorkers(
      [
        worker.handle(echoJob, async ({ message }) => {
          received.push(message)
        }),
        worker.handle(flakyJob, async ({ id }, { isLastAttempt }) => {
          lastAttemptFlags.push(isLastAttempt)
          const count = (attempts.get(id) ?? 0) + 1
          attempts.set(id, count)
          if (count < 2) throw new Error("provider hiccup")
        }),
      ],
      { pollingIntervalSeconds: 0.5 }
    )
  })

  afterAll(async () => {
    await jobs.closeJobSender()
    for (const name of [echoJob.name, flakyJob.name]) {
      await boss.deleteQueue(name).catch(() => {})
    }
    await boss.stop({ graceful: false })
  })

  it("runs a queued job in the worker", async () => {
    await jobs.enqueue(echoJob, { message: "hello" })

    await waitFor(() => received.includes("hello"))
  })

  it("retries a failing job with backoff until it succeeds", async () => {
    await jobs.enqueue(flakyJob, { id: "a" })

    await waitFor(() => attempts.get("a") === 2, 30_000)
    // 3 retries allowed, so neither attempt was the last.
    expect(lastAttemptFlags).toEqual([false, false])
  })

  it("refuses a bad payload at the caller", async () => {
    await expect(
      // @ts-expect-error — wrong payload on purpose
      jobs.enqueue(echoJob, { message: 42 })
    ).rejects.toThrow()
  })
})
