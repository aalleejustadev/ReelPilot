import "server-only"

import { db } from "@/shared/db"
import { AppError } from "@/shared/lib/errors"

/**
 * Counts one use of `key` in a fixed window and throws RATE_LIMITED once
 * `limit` is passed. One atomic statement, so concurrent calls can't slip
 * past the limit. `message` is shown to the user.
 */
export async function consumeRateLimit(input: {
  key: string
  limit: number
  windowSeconds: number
  message: string
}) {
  const [bucket] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_buckets (key, count, "windowStart")
    VALUES (${input.key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limit_buckets."windowStart" <= now() - make_interval(secs => ${input.windowSeconds})
        THEN 1 ELSE rate_limit_buckets.count + 1 END,
      "windowStart" = CASE
        WHEN rate_limit_buckets."windowStart" <= now() - make_interval(secs => ${input.windowSeconds})
        THEN now() ELSE rate_limit_buckets."windowStart" END
    RETURNING count`
  if (!bucket || bucket.count > input.limit) {
    throw new AppError("RATE_LIMITED", input.message)
  }
}
