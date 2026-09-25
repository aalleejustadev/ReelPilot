import { describe, expect, it } from "vitest"

import { pickRecordingType, recordingName } from "../lib/recorder"

describe("pickRecordingType", () => {
  it("prefers H.264 MP4 when the browser can record it", () => {
    expect(pickRecordingType(() => true)).toBe("video/mp4;codecs=avc1")
  })

  it("falls back to WebM (older Chrome, Firefox)", () => {
    const supported = new Set(["video/webm;codecs=vp8", "video/webm"])
    expect(pickRecordingType((type) => supported.has(type))).toBe(
      "video/webm;codecs=vp8"
    )
  })

  it("lets the browser choose when it names no supported type", () => {
    expect(pickRecordingType(() => false)).toBe("")
  })
})

describe("recordingName", () => {
  it("names a recording by when it was made", () => {
    // "Sep" or "Sept" depending on the ICU version.
    expect(recordingName(new Date(2026, 8, 25, 14, 5))).toMatch(
      /^Screen recording 25 Sept?, 14:05$/
    )
  })
})
