import { z } from "zod"

import { defineJob } from "@/shared/jobs/define"

/**
 * Render one export to MP4 (§7.15). The worker runs one at a time: a
 * render uses every core. A 3-minute 1080p video renders in a few minutes
 * on a laptop; 45 minutes leaves room for 10-minute clips on a small CPU.
 */
export const renderExportJob = defineJob({
  name: "exports.render",
  schema: z.object({ exportId: z.string().min(1) }),
  policy: { retryLimit: 2, retryDelaySeconds: 30, timeoutSeconds: 45 * 60 },
})
