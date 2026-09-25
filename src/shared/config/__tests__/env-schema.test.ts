import { describe, expect, it } from "vitest"

import { parseEnv } from "../env-schema"

const validEnv = {
  DATABASE_URL:
    "postgresql://user:pass@ep-x-pooler.neon.tech/db?sslmode=require",
  DATABASE_URL_UNPOOLED:
    "postgresql://user:pass@ep-x.neon.tech/db?sslmode=require",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GITHUB_CLIENT_ID: "github-id",
  GITHUB_CLIENT_SECRET: "github-secret",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "ReelPilot <hello@example.com>",
  AI_TEXT_PROVIDER: "anthropic",
  AI_TEXT_MODEL: "claude-sonnet-5",
  ANTHROPIC_API_KEY: "sk-ant-123",
  AWS_ACCESS_KEY_ID: "key-id",
  AWS_SECRET_ACCESS_KEY: "secret",
  AWS_ENDPOINT_URL_S3: "https://storage.example.com",
  AWS_REGION: "us-east-2",
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

  it("rejects an AI provider the registry doesn't know", () => {
    expect(() =>
      parseEnv({ ...validEnv, AI_TEXT_PROVIDER: "sk-ant-oops" })
    ).toThrow(/AI_TEXT_PROVIDER/)
  })

  it("rejects an Anthropic key in the wrong format without echoing it", () => {
    const key = "not-an-anthropic-key"

    expect(() => parseEnv({ ...validEnv, ANTHROPIC_API_KEY: key })).toThrow(
      /ANTHROPIC_API_KEY/
    )
    try {
      parseEnv({ ...validEnv, ANTHROPIC_API_KEY: key })
    } catch (error) {
      expect(String(error)).not.toContain(key)
    }
  })

  it("requires the storage variables", () => {
    expect(() =>
      parseEnv({ ...validEnv, AWS_ENDPOINT_URL_S3: undefined })
    ).toThrow(/AWS_ENDPOINT_URL_S3/)
  })
})
