import { describe, expect, it } from "vitest"

import {
  addMarkerSchema,
  completeUploadSchema,
  requestUploadSchema,
} from "../schema"

const upload = {
  kitId: "kit_1",
  name: "Demo take 2.MOV",
  sizeBytes: 1000,
  contentType: "video/quicktime",
  source: "UPLOAD",
}

describe("requestUploadSchema", () => {
  it("drops the extension from the name", () => {
    expect(requestUploadSchema.parse(upload).name).toBe("Demo take 2")
  })

  it("names a clip with no name", () => {
    expect(requestUploadSchema.parse({ ...upload, name: " .mp4 " }).name).toBe(
      "Untitled clip"
    )
  })

  it("accepts a recorder's type with codec parameters", () => {
    expect(
      requestUploadSchema.parse({
        ...upload,
        contentType: "video/webm;codecs=vp9",
        source: "RECORDING",
      }).contentType
    ).toBe("video/webm")
  })

  it.each(["image/gif", "video/x-msvideo", "application/octet-stream", ""])(
    "refuses the type %j",
    (contentType) => {
      const result = requestUploadSchema.safeParse({ ...upload, contentType })
      expect(result.error?.issues[0]?.message).toBe(
        "Upload an MP4, MOV or WebM video."
      )
    }
  )

  it("refuses an empty file", () => {
    expect(
      requestUploadSchema.safeParse({ ...upload, sizeBytes: 0 }).success
    ).toBe(false)
  })
})

describe("marker schemas", () => {
  it("stores an empty label as null", () => {
    expect(
      addMarkerSchema.parse({ footageId: "f", atMs: 1200, label: "  " }).label
    ).toBeNull()
  })

  it("rejects negative times", () => {
    expect(
      addMarkerSchema.safeParse({ footageId: "f", atMs: -1 }).success
    ).toBe(false)
  })

  it("defaults recorded marks to none", () => {
    expect(
      completeUploadSchema.parse({ footageId: "f" }).recordedMarksMs
    ).toEqual([])
  })
})
