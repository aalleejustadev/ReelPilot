import { randomBytes, randomUUID } from "node:crypto"
import { existsSync } from "node:fs"

import { test as base, expect } from "@playwright/test"
import { serializeSignedCookie } from "better-call"
import pg from "pg"

/**
 * Signed-in tests need a real database. Locally that's .env; CI has only
 * placeholder env, so these tests skip there (like the DB unit tests).
 */
export const hasDatabase = existsSync(".env")
if (hasDatabase) process.loadEnvFile(".env")

type TestUser = { id: string; name: string; email: string }

export const test = base.extend<{
  /** A fresh user with a valid session cookie; deleted after the test. */
  signedInUser: TestUser
  /** Console errors and warnings seen during the test. */
  consoleProblems: string[]
}>({
  signedInUser: async ({ context, baseURL }, use) => {
    const db = new pg.Client({
      connectionString: process.env.DATABASE_URL_UNPOOLED,
    })
    await db.connect()
    const id = `e2e-${randomUUID()}`
    const user = { id, name: "Ada Lovelace", email: `${id}@example.com` }
    const token = randomBytes(24).toString("base64url")

    await db.query(
      `insert into users (id, name, email, "emailVerified", "updatedAt")
       values ($1, $2, $3, true, now())`,
      [user.id, user.name, user.email]
    )
    await db.query(
      `insert into sessions (id, token, "expiresAt", "userId", "updatedAt")
       values ($1, $2, now() + interval '1 hour', $3, now())`,
      [randomUUID(), token, user.id]
    )
    // Signed exactly the way Better Auth signs its session cookie.
    const cookie = await serializeSignedCookie(
      "better-auth.session_token",
      token,
      process.env.BETTER_AUTH_SECRET!
    )
    const value = cookie.split(";")[0].split("=").slice(1).join("=")
    await context.addCookies([
      { name: "better-auth.session_token", value, url: baseURL! },
    ])

    await use(user)

    // Cascades to sessions, memberships and the personal workspace.
    await db.query("delete from users where id = $1", [user.id])
    await db.end()
  },

  consoleProblems: async ({ page }, use) => {
    const problems: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        problems.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on("pageerror", (error) =>
      problems.push(`pageerror: ${error.message}`)
    )
    await use(problems)
  },
})

export { expect }
