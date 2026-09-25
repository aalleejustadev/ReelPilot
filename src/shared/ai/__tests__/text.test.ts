import { MockLanguageModelV4 } from "ai/test"
import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
}

function modelReturning(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  })
}

const schema = z.object({ tagline: z.string() })

describe("generateStructured", () => {
  let generateStructured: typeof import("../text").generateStructured

  beforeAll(async () => {
    // env.ts validates on import. Fill anything unset (no .env) with
    // placeholders; the tests pass their own mock model.
    const placeholders = {
      DATABASE_URL: "postgresql://u:p@localhost/db",
      BETTER_AUTH_SECRET: "a".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "x",
      GOOGLE_CLIENT_SECRET: "x",
      GITHUB_CLIENT_ID: "x",
      GITHUB_CLIENT_SECRET: "x",
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "x@example.com",
      AI_TEXT_PROVIDER: "anthropic",
      AI_TEXT_MODEL: "test-model",
      ANTHROPIC_API_KEY: "sk-ant-x",
      AWS_ACCESS_KEY_ID: "x",
      AWS_SECRET_ACCESS_KEY: "x",
      AWS_ENDPOINT_URL_S3: "https://s3.example.com",
      AWS_REGION: "us-east-2",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    }
    for (const [name, value] of Object.entries(placeholders)) {
      process.env[name] ??= value
    }
    ;({ generateStructured } = await import("../text"))
  })

  it("returns data that matches the schema", async () => {
    const result = await generateStructured({
      schema,
      system: "s",
      prompt: "p",
      model: modelReturning('{"tagline":"Ads from your app"}'),
    })

    expect(result).toEqual({ tagline: "Ads from your app" })
  })

  it("turns an off-schema answer into a safe PROVIDER_FAILED error", async () => {
    await expect(
      generateStructured({
        schema,
        system: "s",
        prompt: "p",
        model: modelReturning('{"wrong":1}'),
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_FAILED",
      message: "Our AI couldn't finish that. Try again in a moment.",
    })
  })

  it("turns a provider error into PROVIDER_FAILED", async () => {
    const failing = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("upstream 500")
      },
    })

    await expect(
      generateStructured({ schema, system: "s", prompt: "p", model: failing })
    ).rejects.toMatchObject({ code: "PROVIDER_FAILED" })
  })

  it("resolves the configured model from the registry", async () => {
    const { textModel } = await import("../text")
    const model = textModel()

    expect(typeof model === "object" && model.provider).toMatch(/^anthropic/)
  })
})
