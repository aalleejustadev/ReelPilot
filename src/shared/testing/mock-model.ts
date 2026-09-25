import { MockLanguageModelV4 } from "ai/test"

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
}

/** A text model that always answers `text` and records every prompt. */
export function modelReturning(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  })
}

/** A text model whose provider call always fails. */
export function failingModel() {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("upstream 500")
    },
  })
}
