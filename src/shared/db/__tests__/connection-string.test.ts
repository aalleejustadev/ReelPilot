import { describe, expect, it } from "vitest"

import { withStrictSsl } from "../connection-string"

describe("withStrictSsl", () => {
  it("asks for full certificate checks instead of require", () => {
    expect(
      withStrictSsl(
        "postgresql://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require"
      )
    ).toBe(
      "postgresql://u:p@ep-x.neon.tech/db?sslmode=verify-full&channel_binding=require"
    )
  })

  it("leaves local URLs without an sslmode alone", () => {
    expect(
      withStrictSsl("postgresql://postgres:postgres@localhost:5432/reelpilot")
    ).toBe("postgresql://postgres:postgres@localhost:5432/reelpilot")
  })

  it("keeps an explicit verify-full or disable", () => {
    expect(withStrictSsl("postgresql://h/db?sslmode=disable")).toContain(
      "sslmode=disable"
    )
    expect(withStrictSsl("postgresql://h/db?sslmode=verify-full")).toContain(
      "sslmode=verify-full"
    )
  })
})
