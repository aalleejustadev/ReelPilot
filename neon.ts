import { defineConfig } from "@neon/config/v1"

/**
 * Neon services for every branch. `media` holds workspace files (logos from
 * M1, footage from M2, renders later). Private: read via signed URLs only
 * (build plan §11). Apply with `neon deploy`; `neon checkout --create`
 * applies it to new branches.
 */
export default defineConfig({
  buckets: {
    media: {},
  },
})
