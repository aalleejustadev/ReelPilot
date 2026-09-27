import { describe, expect, it } from "vitest"

import { defaultPresentation, presentationSchema } from "../index"
import {
  countNumbers,
  luminance,
  parseSwap,
  plainText,
  readableOn,
  textItemSchema,
} from "../text"

describe("keyword swaps", () => {
  it("reads the words to roll through", () => {
    expect(parseSwap("Ship {faster|safer | together}!")).toEqual({
      before: "Ship ",
      words: ["faster", "safer", "together"],
      after: "!",
    })
    expect(parseSwap("Ship faster")).toBeNull()
    expect(parseSwap("Ship {faster}")).toBeNull()
    expect(plainText("Ship {faster|safer}")).toBe("Ship faster")
  })
})

describe("number ticker", () => {
  it("counts numbers up, keeping their format", () => {
    expect(countNumbers("Save 12 hours", 0.5)).toBe("Save 6 hours")
    expect(countNumbers("$4,200 recovered", 0.5)).toBe("$2,100 recovered")
    expect(countNumbers("98.5% uptime", 1)).toBe("98.5% uptime")
    expect(countNumbers("1,234,567 rows", 1)).toBe("1,234,567 rows")
    expect(countNumbers("No numbers", 0.5)).toBeNull()
  })
})

describe("readable colours", () => {
  it("picks dark text on light colours and white on dark", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1)
    expect(luminance("#000000")).toBe(0)
    expect(readableOn("#f5f5f4")).toBe("#15171c")
    expect(readableOn("#15171c")).toBe("#ffffff")
    expect(readableOn("#22c55e")).toBe("#15171c")
  })
})

describe("text items", () => {
  const item = {
    id: "t1",
    atMs: 1200,
    durationMs: 2500,
    text: "Export in one click",
    role: "headline",
    x: 0.5,
    y: 0.14,
    align: "center",
  }

  it("fill in the video's style and no highlight by default", () => {
    expect(textItemSchema.parse(item)).toMatchObject({
      animation: null,
      emphasis: "",
    })
  })

  it("refuse empty text and off-stage positions", () => {
    expect(textItemSchema.safeParse({ ...item, text: "  " }).success).toBe(
      false
    )
    expect(textItemSchema.safeParse({ ...item, x: 1.2 }).success).toBe(false)
    expect(textItemSchema.safeParse({ ...item, durationMs: 100 }).success).toBe(
      false
    )
  })

  it("old styles read with no text and word rise", () => {
    const {
      texts: _texts,
      textStyle: _textStyle,
      edit: _edit,
      ...old
    } = defaultPresentation
    expect(presentationSchema.parse(old)).toMatchObject({
      texts: [],
      textStyle: { animation: "word-rise" },
      edit: { parts: [] },
    })
  })
})

describe("text sizes", () => {
  it("read as the designed size on items saved before sizes existed", () => {
    const parsed = presentationSchema.parse({
      ...defaultPresentation,
      texts: [
        {
          id: "t",
          atMs: 0,
          durationMs: 2000,
          text: "Hello",
          role: "headline",
          x: 0.5,
          y: 0.5,
          align: "center",
        },
      ],
      graphics: [{ id: "g", kind: "stat", atMs: 0, durationMs: 2000 }],
    })
    expect(parsed.texts[0]!.size).toBe(1)
    expect(parsed.graphics[0]!.textSize).toBe(1)
    expect(parsed.graphics[0]!.secondarySize).toBe(1)
  })

  it("stay within 50%–250%", () => {
    const text = (size: number) =>
      presentationSchema.safeParse({
        ...defaultPresentation,
        texts: [
          {
            id: "t",
            atMs: 0,
            durationMs: 2000,
            text: "Hello",
            role: "headline",
            x: 0.5,
            y: 0.5,
            align: "center",
            size,
          },
        ],
      }).success
    expect(text(2.5)).toBe(true)
    expect(text(3)).toBe(false)
    expect(text(0.4)).toBe(false)
  })
})

describe("text colours", () => {
  const base = {
    id: "t",
    atMs: 0,
    durationMs: 2000,
    text: "Hello",
    role: "headline",
    x: 0.5,
    y: 0.5,
    align: "center",
  }
  it("are automatic unless set, and stored lower-case", () => {
    const parsed = presentationSchema.parse({
      ...defaultPresentation,
      texts: [
        base,
        { ...base, id: "u", color: "#FDE047", background: "#111827" },
      ],
      graphics: [{ id: "g", kind: "slide", atMs: 0, durationMs: 2000 }],
    })
    expect(parsed.texts[0]).toMatchObject({
      color: null,
      highlightColor: null,
      background: null,
    })
    expect(parsed.texts[1]!.color).toBe("#fde047")
    expect(parsed.graphics[0]).toMatchObject({
      textColor: null,
      secondaryColor: null,
      backgroundColor: null,
    })
  })

  it("must be #rrggbb", () => {
    const withColor = (color: string) =>
      presentationSchema.safeParse({
        ...defaultPresentation,
        texts: [{ ...base, color }],
      }).success
    expect(withColor("#12abef")).toBe(true)
    expect(withColor("red")).toBe(false)
    expect(withColor("#fff")).toBe(false)
  })
})
