// ---------------------------------------------------------------------------
// queryCache.js — Client-side Query Cache (Memory + localStorage persistence)
// & Image Disk Cache pre-warmer.
//
// Menyimpan hasil query API sementara (TTL default 5 menit) agar akses
// berikutnya jauh lebih cepat dan mengurangi beban request ke server.
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'bore_barrel_qcache_'
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes
const memoryCache = new Map()
const preloadedImages = new Set()

/**
 * Retrieve cached data for a query key.
 * @param {string} key
 * @returns {{ data: any, timestamp: number, source: 'memory'|'storage', isFresh: boolean } | null}
 */
export const getQueryCache = (key) => {
  const now = Date.now()

  // 1. Check fast in-memory cache first
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key)
    const isFresh = now - entry.timestamp < (entry.ttl || DEFAULT_TTL_MS)
    return {
      data: entry.data,
      timestamp: entry.timestamp,
      source: 'memory',
      isFresh,
    }
  }

  // 2. Check persistent localStorage cache
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry !== 'object') return null
    const isFresh = now - entry.timestamp < (entry.ttl || DEFAULT_TTL_MS)
    // Hydrate memory cache
    memoryCache.set(key, entry)
    return {
      data: entry.data,
      timestamp: entry.timestamp,
      source: 'storage',
      isFresh,
    }
  } catch {
    return null
  }
}

/**
 * Store API query result in memory + localStorage cache.
 * Also pre-warms image URLs so the browser caches them on disk (`(disk cache)`).
 * @param {string} key
 * @param {any} data
 * @param {number} [ttl=DEFAULT_TTL_MS]
 */
export const setQueryCache = (key, data, ttl = DEFAULT_TTL_MS) => {
  const entry = {
    data,
    timestamp: Date.now(),
    ttl,
  }
  memoryCache.set(key, entry)

  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry))
  } catch {
    // Ignore quota errors on large payloads
  }

  // Pre-warm image URLs into browser HTTP disk cache
  warmImageDiskCache(data)
}

/**
 * Invalidate query cache entries matching a prefix (e.g. 'guns', 'reviews_').
 * Called automatically after POST / PUT / PATCH / DELETE mutations.
 * @param {string} [prefix='']
 */
export const invalidateQueryCache = (prefix = '') => {
  for (const k of memoryCache.keys()) {
    if (!prefix || k.startsWith(prefix)) {
      memoryCache.delete(k)
    }
  }
  try {
    const keysToDelete = []
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i)
      if (storageKey && storageKey.startsWith(`${CACHE_PREFIX}${prefix}`)) {
        keysToDelete.push(storageKey)
      }
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k))
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Preload image URLs using standard Image objects with `force-cache` so that
 * subsequent renders hit the browser's HTTP disk cache (`(disk cache)` in DevTools).
 */
export const warmImageDiskCache = (payload) => {
  if (!payload || typeof window === 'undefined') return
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.data)
    ? payload.data
    : [payload]

  items.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const urls = []
    if (item.image_url) urls.push(item.image_url)
    if (item.image) urls.push(item.image)
    if (Array.isArray(item.images)) urls.push(...item.images)

    urls.forEach((url) => {
      if (
        typeof url === 'string' &&
        url &&
        !url.startsWith('data:') &&
        !preloadedImages.has(url)
      ) {
        preloadedImages.add(url)
        const img = new Image()
        img.decoding = 'async'
        img.src = url
      }
    })
  })
}

/**
 * Return statistics about current cached queries for UI inspection.
 */
export const getCacheStats = () => {
  try {
    let storageCount = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(CACHE_PREFIX)) storageCount++
    }
    return {
      memoryEntries: memoryCache.size,
      storageEntries: storageCount,
      warmedImages: preloadedImages.size,
    }
  } catch {
    return {
      memoryEntries: memoryCache.size,
      storageEntries: 0,
      warmedImages: preloadedImages.size,
    }
  }
}
