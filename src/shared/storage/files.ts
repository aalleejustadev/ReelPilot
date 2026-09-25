import "server-only"

import { Files } from "files-sdk"
import { neon } from "files-sdk/neon"

import { env } from "@/shared/config/env"
import { AppError } from "@/shared/lib/errors"

import { MEDIA_BUCKET } from "./keys"

/** Signed download links last this long unless a caller asks for less. */
const DEFAULT_URL_EXPIRY_SECONDS = 60 * 60

let client: Files | undefined
const files = () =>
  (client ??= new Files({
    adapter: neon({
      bucket: MEDIA_BUCKET,
      endpoint: env.AWS_ENDPOINT_URL_S3,
      region: env.AWS_REGION,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    }),
  }))

function storageFailed(cause: unknown): AppError {
  return new AppError(
    "PROVIDER_FAILED",
    "We couldn't reach file storage. Try again in a moment.",
    { cause }
  )
}

/** Stores a file in the private media bucket. Keys come from workspaceFileKey. */
export async function putFile(
  key: string,
  body: Blob | Uint8Array,
  contentType: string
) {
  try {
    await files().upload(key, body, { contentType })
  } catch (error) {
    throw storageFailed(error)
  }
}

/** A short-lived signed download URL (the bucket is never public, §11). */
export async function signedFileUrl(
  key: string,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS
) {
  try {
    return await files().url(key, { expiresIn: expiresInSeconds })
  } catch (error) {
    throw storageFailed(error)
  }
}

/** Deletes a file. Deleting a key that doesn't exist is not an error. */
export async function deleteFile(key: string) {
  try {
    await files().delete(key)
  } catch (error) {
    throw storageFailed(error)
  }
}
