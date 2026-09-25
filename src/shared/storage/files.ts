import "server-only"

import { createWriteStream, openAsBlob } from "node:fs"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"

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

/**
 * A signed browser upload (HTML form POST) straight to the bucket. Storage
 * enforces the size range and content type, so the file never passes
 * through our server and can't exceed `maxBytes`.
 */
export async function signedFileUpload(
  key: string,
  options: { maxBytes: number; contentType: string; expiresInSeconds: number }
) {
  let signed: Awaited<ReturnType<Files["signedUploadUrl"]>>
  try {
    signed = await files().signedUploadUrl(key, {
      expiresIn: options.expiresInSeconds,
      contentType: options.contentType,
      maxSize: options.maxBytes,
    })
  } catch (error) {
    throw storageFailed(error)
  }
  // maxSize always yields a POST policy; a PUT would have no size limit.
  if (signed.method !== "POST") {
    throw new Error("Expected a size-limited POST upload")
  }
  return { url: signed.url, fields: signed.fields }
}

/** The stored file's size in bytes, or null if there's no such file. */
export async function fileSize(key: string) {
  try {
    if (!(await files().exists(key))) return null
    return (await files().head(key)).size
  } catch (error) {
    throw storageFailed(error)
  }
}

/** Deletes every file whose key starts with `prefix` (a folder, ending "/"). */
export async function deleteFolder(prefix: string) {
  if (!prefix.endsWith("/")) throw new Error("A folder prefix ends with /")
  try {
    let cursor: string | undefined
    do {
      const page = await files().list({ prefix, cursor })
      if (page.items.length > 0) {
        await files().delete(page.items.map((item) => item.key))
      }
      cursor = page.cursor
    } while (cursor)
  } catch (error) {
    throw storageFailed(error)
  }
}

/** Streams a stored file to a local path (the worker's temp folder). */
export async function downloadToFile(key: string, path: string) {
  try {
    const file = await files().download(key)
    await pipeline(
      Readable.fromWeb(file.stream() as NodeReadableStream),
      createWriteStream(path)
    )
  } catch (error) {
    throw storageFailed(error)
  }
}

/** Uploads a local file without reading it all into memory. */
export async function uploadFromFile(
  key: string,
  path: string,
  contentType: string
) {
  try {
    await files().upload(key, await openAsBlob(path, { type: contentType }), {
      contentType,
    })
  } catch (error) {
    throw storageFailed(error)
  }
}
