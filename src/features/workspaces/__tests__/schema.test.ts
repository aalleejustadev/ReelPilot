import { describe, expect, it } from "vitest"

import { renameWorkspaceSchema } from "../schema"

describe("renameWorkspaceSchema", () => {
  it("trims the name", () => {
    expect(renameWorkspaceSchema.parse({ name: "  Launch team  " })).toEqual({
      name: "Launch team",
    })
  })

  it("rejects an empty or whitespace-only name", () => {
    const result = renameWorkspaceSchema.safeParse({ name: "   " })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      "Enter a name for your workspace."
    )
  })

  it("rejects names over 50 characters", () => {
    const result = renameWorkspaceSchema.safeParse({ name: "a".repeat(51) })
    expect(result.error?.issues[0]?.message).toBe(
      "Keep the name under 50 characters."
    )
  })

  it("rejects a missing name", () => {
    expect(renameWorkspaceSchema.safeParse({ name: null }).success).toBe(false)
  })
})
