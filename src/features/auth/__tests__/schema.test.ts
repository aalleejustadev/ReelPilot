import { describe, expect, it } from "vitest"

import { updateProfileSchema } from "../schema"

describe("updateProfileSchema", () => {
  it("trims the name", () => {
    expect(updateProfileSchema.parse({ name: "  Ada Lovelace " })).toEqual({
      name: "Ada Lovelace",
    })
  })

  it("rejects an empty or whitespace-only name", () => {
    const result = updateProfileSchema.safeParse({ name: "   " })
    expect(result.error?.issues[0]?.message).toBe("Enter your name.")
  })

  it("rejects names over 60 characters", () => {
    const result = updateProfileSchema.safeParse({ name: "a".repeat(61) })
    expect(result.error?.issues[0]?.message).toBe(
      "Keep your name under 60 characters."
    )
  })
})
