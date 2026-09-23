import "server-only"

import { parseEnv } from "./env-schema"

/** Validated server env. Throws on first import if anything is missing. */
export const env = parseEnv(process.env)
