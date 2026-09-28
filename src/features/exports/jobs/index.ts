// The worker's entry into the exports slice (its index.ts carries UI code
// the worker must not load).
import "server-only"

import { handle } from "@/shared/jobs/worker"

import { renderExportJob } from "./definitions"
import { renderExport } from "./render-export"

export const exportJobs = [handle(renderExportJob, renderExport)]
