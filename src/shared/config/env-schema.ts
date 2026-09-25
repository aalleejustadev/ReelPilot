import { z } from "zod"

/**
 * Server environment. Add a variable here in the slice that first uses it,
 * and mirror it in .env.example.
 */
const envSchema = z.object({
  // Neon pooled connection for app traffic.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Direct connection: Prisma migrations and the pg-boss job queue (it takes
  // advisory locks, which PgBouncer's transaction mode doesn't keep).
  DATABASE_URL_UNPOOLED: z.url({ protocol: /^postgres(ql)?$/ }),

  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "Must be at least 32 characters. Generate one with: openssl rand -base64 32"
    ),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM: z.string().min(1),

  // AI text through the Vercel AI SDK registry (src/shared/ai). Add a
  // provider here and in the registry together, with its own key below.
  AI_TEXT_PROVIDER: z.enum(["anthropic"]),
  AI_TEXT_MODEL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),

  // Neon Object Storage for the linked branch. Written by `neon env pull`.
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_ENDPOINT_URL_S3: z.url(),
  AWS_REGION: z.string().min(1),

  NEXT_PUBLIC_APP_URL: z.url(),
})

export type Env = z.infer<typeof envSchema>

/** Parses env vars, listing every problem by name (never by value). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source)
  if (parsed.success) return parsed.data

  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n")
  throw new Error(
    `Invalid environment variables:\n${problems}\nSee .env.example for the full list.`
  )
}
