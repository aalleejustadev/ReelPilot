import { z } from "zod"

import { defineJob } from "@/shared/jobs/define"

/** Convert an uploaded clip, make thumbnails and find key moments. */
export const processFootageJob = defineJob({
  name: "footage.process",
  schema: z.object({ footageId: z.string().min(1) }),
  // 3 retries with backoff (build plan §9). A 10-minute 1080p clip converts
  // in a few minutes on a small CPU; 30 minutes leaves room.
  policy: { retryLimit: 3, retryDelaySeconds: 30, timeoutSeconds: 30 * 60 },
})
