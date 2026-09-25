import { randomUUID } from "node:crypto"

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// Capture the email instead of sending it; everything else is real.
const sendEmail = vi.fn()
vi.mock("@/shared/email", () => ({ sendEmail }))

// Runs against the real database; skipped in CI, where no .env exists.
describe.skipIf(!process.env.DATABASE_URL)("magic link sign-in", async () => {
  const { auth } = await import("../lib/auth")
  const { db } = await import("@/shared/db")

  const email = `magic-link-test-${randomUUID()}@example.com`

  beforeEach(() => sendEmail.mockClear())

  afterAll(async () => {
    await db.user.deleteMany({ where: { email } })
    await db.$disconnect()
  })

  async function requestLink() {
    await auth.api.signInMagicLink({
      body: { email, callbackURL: "/dashboard", errorCallbackURL: "/sign-in" },
      headers: new Headers(),
    })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const [{ to, react }] = sendEmail.mock.calls[0]
    expect(to).toBe(email)
    return new URL(react.props.url as string)
  }

  function verify(link: URL) {
    return auth.api.magicLinkVerify({
      query: Object.fromEntries(link.searchParams) as {
        token: string
        callbackURL?: string
        errorCallbackURL?: string
      },
      headers: new Headers(),
      asResponse: true,
    })
  }

  it("creates a verified user and a session, then redirects to the dashboard", async () => {
    const link = await requestLink()
    const response = await verify(link)

    expect(response.status).toBe(302)
    expect(new URL(response.headers.get("location")!, link).pathname).toBe(
      "/dashboard"
    )
    expect(response.headers.get("set-cookie")).toContain("session_token")

    const user = await db.user.findUniqueOrThrow({
      where: { email },
      include: { sessions: true },
    })
    expect(user.emailVerified).toBe(true)
    expect(user.role).toBe("USER")
    expect(user.sessions).toHaveLength(1)
  })

  it("stores the token hashed, never in plain text", async () => {
    const link = await requestLink()
    const token = link.searchParams.get("token")!

    const rows = await db.verification.findMany({
      where: { value: { contains: email } },
    })
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.identifier).not.toBe(token)
  })

  it("rejects a link that was already used", async () => {
    const link = await requestLink()
    await verify(link)
    const second = await verify(link)

    const location = new URL(second.headers.get("location")!, link)
    expect(location.pathname).toBe("/sign-in")
    expect(location.searchParams.get("error")).toBe("INVALID_TOKEN")
  })
})
