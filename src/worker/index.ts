/**
 * ReelPilot's job worker (build plan §4): a long-running Node process, next
 * to the web app, that runs background jobs from the pg-boss queue.
 *
 * Run with `npm run worker` (or `npm run dev:all` with the app). It runs
 * with the "react-server" condition so shared modules marked `server-only`
 * load outside Next.
 */
import { startWorkers } from "@/shared/jobs/worker"

import { registrations } from "./registrations"

async function main() {
  const boss = await startWorkers(registrations)
  console.info(
    `[worker] running ${registrations.length} job type(s): ${
      registrations.map((r) => r.job.name).join(", ") || "none"
    }`
  )

  let stopping = false
  const stop = async (signal: string) => {
    if (stopping) return
    stopping = true
    console.info(`[worker] ${signal}: finishing running jobs, then stopping`)
    // Graceful: running jobs get up to 30s to finish; the rest stay queued.
    await boss.stop({ graceful: true, timeout: 30_000 })
    process.exit(0)
  }
  process.on("SIGINT", () => void stop("SIGINT"))
  process.on("SIGTERM", () => void stop("SIGTERM"))
}

main().catch((error: unknown) => {
  console.error("[worker] failed to start", error)
  process.exit(1)
})
