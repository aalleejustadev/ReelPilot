import { createHash } from "node:crypto"

/**
 * A short hash of what a render shows: the edit, clips, shots, fonts,
 * colours and logo. Signed links change every time they're made, so only
 * the file they point at counts (the query string is dropped). The same
 * input always gives the same hash, so the editor can tell an export is
 * out of date.
 */
export function renderFingerprint(input: unknown) {
  const json = JSON.stringify(input, (_key, value: unknown) =>
    typeof value === "string" && /^https?:\/\//.test(value)
      ? value.split("?")[0]
      : value
  )
  return createHash("sha256").update(json).digest("hex").slice(0, 32)
}
