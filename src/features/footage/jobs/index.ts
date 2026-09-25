// The worker's entry into the footage slice: job handlers and maintenance.
// (The slice's index.ts carries UI code the worker must not load.)
import "server-only"

import { handle, type MaintenanceTask } from "@/shared/jobs/worker"

import { failStaleUploads } from "../service"
import { processFootageJob } from "./definitions"
import { processFootage } from "./process-footage"

export const footageJobs = [handle(processFootageJob, processFootage)]

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
]
