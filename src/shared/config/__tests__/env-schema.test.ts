import { describe, expect, it } from "vitest"

import { parseEnv } from "../env-schema"

const validEnv = {
  DATABASE_URL:
    "postgresql://user:pass@ep-x-pooler.neon.tech/db?sslmode=require",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GITHUB_CLIENT_ID: "github-id",
  GITHUB_CLIENT_SECRET: "github-secret",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "ReelPilot <hello@example.com>",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
}

describe("parseEnv", () => {
  it("accepts a complete environment", () => {
    expect(parseEnv(validEnv)).toMatchObject(validEnv)
  })

  it("lists every missing variable by name", () => {
    const partial = {
      ...validEnv,
      GOOGLE_CLIENT_ID: undefined,
      RESEND_API_KEY: undefined,
    }

    expect(() => parseEnv(partial)).toThrow(
      /GOOGLE_CLIENT_ID[\s\S]*RESEND_API_KEY/
    )
  })

  it("rejects a short auth secret without echoing its value", () => {
    const secret = "too-short-secret"

    expect(() => parseEnv({ ...validEnv, BETTER_AUTH_SECRET: secret })).toThrow(
      /BETTER_AUTH_SECRET: Must be at least 32 characters/
    )
    try {
      parseEnv({ ...validEnv, BETTER_AUTH_SECRET: secret })
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })

  it("rejects a non-Postgres database URL", () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: "mysql://user:pass@host/db" })
    ).toThrow(/DATABASE_URL/)
  })
})
