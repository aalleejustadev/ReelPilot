/**
 * Reuses a signed download link for the first half of its life. Pages that
 * refresh themselves (a clip processing) used to get a newly signed link
 * for every image each time; the browser preloaded each one, the next
 * refresh replaced it unused, and it warned — and nothing could be cached.
 * The same key and lifetime now give the same link, and a reused link
 * always has at least half its lifetime left.
 */
export function createUrlCache(options: { maxEntries: number }) {
  const cache = new Map<string, { url: string; freshUntil: number }>()
  return async function cached(
    key: string,
    expiresInSeconds: number,
    sign: () => Promise<string>,
    now = Date.now()
  ) {
    const id = `${expiresInSeconds}:${key}`
    const hit = cache.get(id)
    if (hit && now < hit.freshUntil) return hit.url
    const url = await sign()
    // Bounded: the oldest entries go first (Map keeps insertion order).
    if (cache.size >= options.maxEntries) {
      cache.delete(cache.keys().next().value!)
    }
    cache.delete(id)
    cache.set(id, { url, freshUntil: now + (expiresInSeconds * 1000) / 2 })
    return url
  }
}
