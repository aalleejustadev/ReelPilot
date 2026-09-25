import { describe, expect, it } from "vitest"

import { personalWorkspaceName } from "../lib/workspace-name"

describe("personalWorkspaceName", () => {
  it("uses the first name", () => {
    expect(personalWorkspaceName("Ali Murtaza")).toBe("Ali’s workspace")
  })

  it("trims and collapses whitespace", () => {
    expect(personalWorkspaceName("   Ada    Lovelace ")).toBe("Ada’s workspace")
  })

  it.each(["", "   ", null, undefined])("falls back for %j", (name) => {
    expect(personalWorkspaceName(name)).toBe("My workspace")
  })
})
