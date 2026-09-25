import { describe, expect, it } from "vitest"

import { isWorkspaceFileKey, workspaceFileKey } from "../keys"

describe("workspaceFileKey", () => {
  it("prefixes every key with its workspace", () => {
    expect(
      workspaceFileKey("ws_1", "brand-kits", "kit_1", "logo-abc.png")
    ).toBe("workspaces/ws_1/brand-kits/kit_1/logo-abc.png")
  })

  it("needs at least one segment after the workspace", () => {
    expect(() => workspaceFileKey("ws_1")).toThrow(/at least one segment/)
  })

  it.each(["../ws_2", "a/b", "..", "", ".hidden", "logo..png", "a b"])(
    "rejects the unsafe segment %j",
    (segment) => {
      expect(() => workspaceFileKey("ws_1", segment)).toThrow(/Invalid/)
    }
  )

  it("rejects an unsafe workspace id", () => {
    expect(() => workspaceFileKey("../other", "logo.png")).toThrow(/Invalid/)
  })
})

describe("isWorkspaceFileKey", () => {
  it("accepts keys under the workspace prefix", () => {
    expect(isWorkspaceFileKey("workspaces/ws_1/logo.png", "ws_1")).toBe(true)
  })

  it("rejects another workspace, including one sharing a prefix", () => {
    expect(isWorkspaceFileKey("workspaces/ws_2/logo.png", "ws_1")).toBe(false)
    expect(isWorkspaceFileKey("workspaces/ws_10/logo.png", "ws_1")).toBe(false)
  })
})

describe("sharedFileKey", async () => {
  const { sharedFileKey } = await import("../keys")

  it("puts shared files under shared/", () => {
    expect(sharedFileKey("presenters", "maya", "portrait.png")).toBe(
      "shared/presenters/maya/portrait.png"
    )
  })

  it("rejects unsafe segments", () => {
    expect(() => sharedFileKey("..", "x")).toThrow(/Invalid/)
    expect(() => sharedFileKey()).toThrow()
  })
})
