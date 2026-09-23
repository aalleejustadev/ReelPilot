import { afterEach, describe, expect, it, vi } from "vitest"

import { AppError } from "../errors"
import { err, ok, toResultError } from "../result"

describe("ok / err", () => {
  it("wraps data and errors in a discriminated union", () => {
    expect(ok(42)).toEqual({ ok: true, data: 42 })
    expect(err({ code: "NOT_FOUND", message: "Gone" })).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Gone" },
    })
  })
})

describe("toResultError", () => {
  afterEach(() => vi.restoreAllMocks())

  it("passes an AppError's code, message and field errors through", () => {
    const error = new AppError("VALIDATION", "Check the highlighted fields.", {
      fieldErrors: { url: ["Enter a valid URL."] },
    })

    expect(toResultError(error)).toEqual({
      code: "VALIDATION",
      message: "Check the highlighted fields.",
      fieldErrors: { url: ["Enter a valid URL."] },
    })
  })

  it("omits fieldErrors when there are none", () => {
    expect(toResultError(new AppError("FORBIDDEN", "No access."))).toEqual({
      code: "FORBIDDEN",
      message: "No access.",
    })
  })

  it("hides unexpected errors behind a generic INTERNAL error and logs them", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const cause = new Error("connection refused at 10.0.0.3:5432")

    const result = toResultError(cause)

    expect(result.code).toBe("INTERNAL")
    expect(result.message).not.toContain("10.0.0.3")
    expect(log).toHaveBeenCalledWith(cause)
  })
})
