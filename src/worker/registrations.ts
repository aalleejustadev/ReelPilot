import { footageJobs, footageMaintenance } from "@/features/footage/jobs"
import type { MaintenanceTask, RegisteredJob } from "@/shared/jobs/worker"

/**
 * Every job the worker runs. Features export theirs from
 * `@/features/<name>/jobs` (the worker's only way into a feature besides
 * its index, which also carries UI code).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jobs have different payload types
export const registrations: RegisteredJob<any>[] = [...footageJobs]

export const maintenance: MaintenanceTask[] = [...footageMaintenance]
