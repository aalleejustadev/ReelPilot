import { describe, expect, it, vi } from "vitest"

import { createUrlCache } from "../url-cache"

describe("signed link reuse", () => {
  it("gives the same link for half its life, then signs a new one", async () => {
    const cached = createUrlCache({ maxEntries: 10 })
    let n = 0
    const sign = vi.fn(async () => `url-${++n}`)
    const t0 = 1_000_000
    expect(await cached("a", 3600, sign, t0)).toBe("url-1")
    expect(await cached("a", 3600, sign, t0 + 29 * 60_000)).toBe("url-1")
    expect(await cached("a", 3600, sign, t0 + 30 * 60_000)).toBe("url-2")
    expect(sign).toHaveBeenCalledTimes(2)
  })

  it("keeps keys and lifetimes apart", async () => {
    const cached = createUrlCache({ maxEntries: 10 })
    let n = 0
    const sign = async () => `url-${++n}`
    expect(await cached("a", 3600, sign, 0)).toBe("url-1")
    expect(await cached("b", 3600, sign, 0)).toBe("url-2")
    expect(await cached("a", 60, sign, 0)).toBe("url-3")
  })

  it("stays within its size, dropping the oldest", async () => {
    const cached = createUrlCache({ maxEntries: 2 })
    let n = 0
    const sign = async () => `url-${++n}`
    await cached("a", 3600, sign, 0)
    await cached("b", 3600, sign, 0)
    await cached("c", 3600, sign, 0)
    expect(await cached("b", 3600, sign, 0)).toBe("url-2")
    expect(await cached("a", 3600, sign, 0)).toBe("url-4")
  })
})
