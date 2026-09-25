import { describe, expect, it } from "vitest"

import { AppError } from "@/shared/lib/errors"

import {
  assertCan,
  can,
  workspaceActions,
  type WorkspaceAction,
} from "../lib/permissions"

// The full matrix from build plan §7.2.
const expected: Record<"OWNER" | "EDITOR" | "VIEWER", WorkspaceAction[]> = {
  OWNER: [...workspaceActions],
  EDITOR: [
    "workspace:view",
    "workspace:comment",
    "content:create",
    "content:edit",
    "render:start",
  ],
  VIEWER: ["workspace:view", "workspace:comment"],
}

describe("can", () => {
  for (const [role, allowedActions] of Object.entries(expected)) {
    for (const action of workspaceActions) {
      const allowed = allowedActions.includes(action)
      it(`${role} ${allowed ? "can" : "cannot"} ${action}`, () => {
        expect(can(role as keyof typeof expected, action)).toBe(allowed)
      })
    }
  }
})

describe("assertCan", () => {
  it("passes silently when allowed", () => {
    expect(() => assertCan("EDITOR", "render:start")).not.toThrow()
  })

  it("throws FORBIDDEN with an actionable message when not allowed", () => {
    try {
      assertCan("EDITOR", "billing:manage")
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).code).toBe("FORBIDDEN")
      expect((error as AppError).message).toBe(
        "Only the workspace owner can manage billing."
      )
    }
  })
})
