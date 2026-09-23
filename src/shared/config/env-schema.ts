import { z } from "zod"

/**
 * Server environment. Add a variable here in the slice that first uses it,
 * and mirror it in .env.example.
 */
export const envSchema = z.object({
  // Neon pooled connection for app traffic. Migrations use the direct
  // DATABASE_URL_UNPOOLED, which only the Prisma CLI reads.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

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
