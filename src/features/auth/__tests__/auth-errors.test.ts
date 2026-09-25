import { describe, expect, it } from "vitest"

import { authErrorMessage } from "../lib/auth-errors"

describe("authErrorMessage", () => {
  it("returns null when there is no error", () => {
    expect(authErrorMessage(undefined)).toBeNull()
  })

  it("explains an expired or used magic link", () => {
    expect(authErrorMessage("INVALID_TOKEN")).toMatch(
      /expired or was already used/
    )
  })

  it("falls back to a generic message for unknown codes", () => {
    expect(authErrorMessage("something_new")).toBe(
      "Something went wrong while signing you in. Try again."
    )
  })
})
