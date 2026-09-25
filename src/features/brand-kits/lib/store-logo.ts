import "server-only"

import { randomUUID } from "node:crypto"

import { deleteFile, putFile, workspaceFileKey } from "@/shared/storage"

import { setBrandKitLogo } from "../service"
import { logoRules, type LogoType } from "./logo"

/** Removes a replaced file. A leftover file is harmless, so failures only log. */
export async function deleteOldLogo(key: string | null) {
  if (!key) return
  await deleteFile(key).catch((error: unknown) =>
    console.warn("Couldn't delete replaced logo", key, error)
  )
}

/**
 * Stores a verified logo under a new key (each version gets its own key),
 * points the kit at it, then deletes the previous file.
 */
export async function storeLogo(
  workspaceId: string,
  kitId: string,
  logo: { bytes: Uint8Array; type: LogoType }
) {
  const key = workspaceFileKey(
    workspaceId,
    "brand-kits",
    kitId,
    `logo-${randomUUID()}.${logoRules.extensions[logo.type]}`
  )
  await putFile(key, logo.bytes, logo.type)
  try {
    const { previousLogoKey } = await setBrandKitLogo(workspaceId, kitId, key)
    await deleteOldLogo(previousLogoKey)
  } catch (error) {
    // The kit is gone or unchanged; don't leave the new file behind.
    await deleteOldLogo(key)
    throw error
  }
}
