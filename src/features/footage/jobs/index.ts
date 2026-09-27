// The worker's entry into the footage slice: job handlers and maintenance.
// (The slice's index.ts carries UI code the worker must not load.)
import "server-only"

import { handle, type MaintenanceTask } from "@/shared/jobs/worker"

import { enqueue } from "@/shared/jobs"

import { failStaleUploads, stuckAnalyses } from "../service"
import { analyzeFootage } from "./analyze-footage"
import { analyzeFootageJob, processFootageJob } from "./definitions"
import { processFootage } from "./process-footage"

export const footageJobs = [
  handle(processFootageJob, processFootage),
  handle(analyzeFootageJob, analyzeFootage),
]

export const footageMaintenance: MaintenanceTask[] = [
  {
    // Signed uploads last an hour; after 3 an unfinished one is abandoned.
    name: "footage.fail-stale-uploads",
    everyMs: 15 * 60 * 1000,
    run: async () => {
      const count = await failStaleUploads(
        new Date(Date.now() - 3 * 60 * 60 * 1000)
      )
      if (count > 0)
        console.info(`[maintenance] failed ${count} stale upload(s)`)
    },
  },
  {
    // An analysis asked for but never queued (the enqueue after processing
    // failed): queue it again. Stately queues drop it if it's queued.
    name: "footage.requeue-stuck-analyses",
    everyMs: 10 * 60 * 1000,
    run: async () => {
      const ids = await stuckAnalyses(new Date(Date.now() - 10 * 60 * 1000))
      for (const footageId of ids) {
        await enqueue(
          analyzeFootageJob,
          { footageId },
          { singletonKey: footageId }
        )
      }
    },
  },
]
