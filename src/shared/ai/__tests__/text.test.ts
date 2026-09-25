import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

import { failingModel, modelReturning } from "@/shared/testing/mock-model"
import { fillPlaceholderEnv } from "@/shared/testing/placeholder-env"

const schema = z.object({ tagline: z.string() })

describe("generateStructured", () => {
  let generateStructured: typeof import("../text").generateStructured

  beforeAll(async () => {
    fillPlaceholderEnv()
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
    const failing = failingModel()

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
