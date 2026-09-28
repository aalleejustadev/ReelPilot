import { describe, expect, it } from "vitest"

import { renderFontFamily, stageFontsWith } from "@/remotion/fonts"
import { adFonts } from "@/shared/config/ad-fonts"
import { defaultPresentation } from "@/shared/motion"

import { attachment, downloadFileName } from "../lib/files"
import { renderFingerprint } from "../lib/fingerprint"
import { exportFileKey } from "../lib/keys"

describe("downloadFileName", () => {
  it("names the file after the video and its shape", () => {
    expect(downloadFileName("Launch video", "9:16")).toBe(
      "Launch video 9x16.mp4"
    )
  })

  it("keeps only safe characters and is never empty", () => {
    expect(downloadFileName('a/b\\c:"d"*?<>|', "1:1")).toBe("abcd 1x1.mp4")
    expect(downloadFileName("  ✨  ", "16:9")).toBe("Video 16x9.mp4")
    expect(downloadFileName("Café  demo", "16:9")).toBe("Cafe demo 16x9.mp4")
  })

  it("downloads under that name", () => {
    expect(attachment("Demo 16x9.mp4")).toBe(
      'attachment; filename="Demo 16x9.mp4"'
    )
  })
})

describe("renderFingerprint", () => {
  const stage = {
    clips: [
      {
        id: "a",
        videoUrl: "https://bucket.test/v.mp4?X-Amz-Signature=1",
        presentation: defaultPresentation,
      },
    ],
  }

  it("ignores the signature on links (they change every time)", () => {
    const resigned = structuredClone(stage)
    resigned.clips[0]!.videoUrl = "https://bucket.test/v.mp4?X-Amz-Signature=2"
    expect(renderFingerprint(resigned)).toBe(renderFingerprint(stage))
  })

  it("changes when the edit or the file changes", () => {
    const edited = structuredClone(stage)
    edited.clips[0]!.presentation = {
      ...defaultPresentation,
      frame: {
        ...defaultPresentation.frame,
        shadow: !defaultPresentation.frame.shadow,
      },
    }
    expect(renderFingerprint(edited)).not.toBe(renderFingerprint(stage))
    const other = structuredClone(stage)
    other.clips[0]!.videoUrl = "https://bucket.test/w.mp4?X-Amz-Signature=1"
    expect(renderFingerprint(other)).not.toBe(renderFingerprint(stage))
  })
})

describe("render fonts", () => {
  it("has a self-hosted family for every brand kit font", () => {
    for (const font of adFonts) {
      expect(renderFontFamily[font.name]).toMatch(/^'.+'$/)
    }
  })

  it("uses the kit's heading and body, with the heading's weight", () => {
    expect(
      stageFontsWith({ heading: "bebas neue", body: "Lato" }, renderFontFamily)
    ).toEqual({
      heading: "'Bebas Neue', system-ui, sans-serif",
      headingWeight: 400,
      body: "'Lato', system-ui, sans-serif",
    })
    // Unknown fonts fall back to Inter; body follows the heading.
    expect(stageFontsWith({ heading: "Comic Sans" }, renderFontFamily)).toEqual(
      {
        heading: "'Inter Variable', system-ui, sans-serif",
        headingWeight: 700,
        body: "'Inter Variable', system-ui, sans-serif",
      }
    )
  })
})

describe("exportFileKey", () => {
  it("keeps the MP4 in its clip's or video's folder", () => {
    expect(exportFileKey("ws", "kit", { kind: "clip", id: "c1" }, "e1")).toBe(
      "workspaces/ws/brand-kits/kit/footage/c1/exports/e1.mp4"
    )
    expect(exportFileKey("ws", "kit", { kind: "video", id: "p1" }, "e1")).toBe(
      "workspaces/ws/brand-kits/kit/projects/p1/exports/e1.mp4"
    )
  })
})
