import { apiClient, IS_SUPABASE } from '../config/api'
import {
  getQueryCache,
  setQueryCache,
  invalidateQueryCache,
} from '../utils/queryCache'
import outboxService from './outboxService'

const GALLERY_STORAGE_KEY = 'bore_barrel_gun_images'
const OFFLINE_GUNS_KEY = 'bore_barrel_offline_guns'
const IMAGES_SPEC_PREFIX = '__IMAGES__:'

export const getOfflineGuns = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_GUNS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const saveOfflineGun = (gun) => {
  try {
    const list = getOfflineGuns()
    const updated = [gun, ...list.filter((g) => String(g.id) !== String(gun.id))]
    localStorage.setItem(OFFLINE_GUNS_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('offline-guns-updated'))
    invalidateQueryCache('guns_')
  } catch {
    // quota
  }
}

export const removeOfflineGun = (gunId) => {
  try {
    const list = getOfflineGuns().filter((g) => String(g.id) !== String(gunId))
    localStorage.setItem(OFFLINE_GUNS_KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('offline-guns-updated'))
    invalidateQueryCache('guns_')
  } catch {
    //
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline-product-synced', (e) => {
    if (e.detail?.tempId) {
      removeOfflineGun(e.detail.tempId)
    }
  })
}

const readLocalGalleryMap = () => {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const saveLocalGallery = (gunId, images) => {
  if (!gunId || !Array.isArray(images)) return
  try {
    const map = readLocalGalleryMap()
    map[String(gunId)] = images
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage quota errors
  }
}

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// Also extracts multi-image galleries stored in `images`, `specs`, or local map.
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  let extractedImages = []
  let specsList = []

  if (Array.isArray(item.specs)) {
    item.specs.forEach((s, idx) => {
      if (typeof s === 'string' && s.startsWith(IMAGES_SPEC_PREFIX)) {
        try {
          const parsed = JSON.parse(s.slice(IMAGES_SPEC_PREFIX.length))
          if (Array.isArray(parsed)) extractedImages = parsed
        } catch {
          // Ignore malformed JSON
        }
        return
      }
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          specsList.push({
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          })
          return
        }
        specsList.push({
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        })
        return
      }
      if (s && s.name === '__IMAGES__') {
        try {
          const parsed = JSON.parse(s.quantity)
          if (Array.isArray(parsed)) extractedImages = parsed
        } catch {
          // Ignore
        }
        return
      }
      specsList.push(s)
    })
  } else if (Array.isArray(item.ingredients)) {
    item.ingredients.forEach((ing) => {
      if (ing && ing.name === '__IMAGES__') {
        try {
          const parsed = JSON.parse(ing.quantity)
          if (Array.isArray(parsed)) extractedImages = parsed
        } catch {
          // Ignore
        }
        return
      }
      specsList.push(ing)
    })
  }

  // Resolve multi-image array from item.images, spec metadata, or local gallery map
  const galleryMap = readLocalGalleryMap()
  const localImages = item.id ? galleryMap[String(item.id)] : null
  const primaryImg = item.image_url || item.image || '/guns/pistol.svg'

  const rawImages =
    (Array.isArray(item.images) && item.images.length > 0 && item.images) ||
    (extractedImages.length > 0 && extractedImages) ||
    (Array.isArray(localImages) && localImages.length > 0 && localImages) ||
    [primaryImg]

  // Deduplicate while preserving order
  const uniqueImages = Array.from(new Set([primaryImg, ...rawImages].filter(Boolean)))

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : [
          'Verify firearm is completely unloaded and point in safe direction.',
          'Inspect receiver and mechanism for maintenance.',
        ]

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: uniqueImages[0] || '/guns/pistol.svg',
    image: uniqueImages[0] || '/guns/pistol.svg',
    images: uniqueImages,
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints with Query Caching.
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products with Query Caching.
   */
  async getGuns(params = {}, options = {}) {
    const cacheKey = `guns_list_${JSON.stringify(params)}`
    const offlineItems = getOfflineGuns().map(normalizeProduct)

    if (!options.forceRefresh) {
      const cached = getQueryCache(cacheKey)
      if (cached && (cached.isFresh || !navigator.onLine)) {
        const cachedList = Array.isArray(cached.data?.data) ? cached.data.data : []
        const merged = [
          ...offlineItems,
          ...cachedList.filter((g) => !offlineItems.some((o) => o.id === g.id)),
        ]
        return {
          ...cached.data,
          data: merged,
          fromCache: true,
          cacheSource: cached.source,
          cachedAt: cached.timestamp,
          isOffline: !navigator.onLine,
        }
      }
    }

    if (!navigator.onLine) {
      const cached = getQueryCache(cacheKey)
      const cachedList = Array.isArray(cached?.data?.data) ? cached.data.data : []
      const merged = [
        ...offlineItems,
        ...cachedList.filter((g) => !offlineItems.some((o) => o.id === g.id)),
      ]
      return {
        success: true,
        data: merged,
        pagination: {
          total: merged.length,
          page: params.page || 1,
          limit: params.limit || 50,
        },
        fromCache: true,
        cacheSource: 'offline-cache',
        isOffline: true,
      }
    }

    if (IS_SUPABASE) {
      try {
        const queryParts = ['select=*']
        if (params.search) {
          queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
        }
        if (params.category && params.category !== 'All') {
          queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
        }
        if (params.sort_by) {
          const order = params.order === 'desc' ? 'desc' : 'asc'
          queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
        } else {
          queryParts.push('order=created_at.desc')
        }
        if (params.limit) {
          queryParts.push(`limit=${params.limit}`)
        }
        const queryString = queryParts.join('&')
        const data = await apiClient.get(`/rest/v1/products?${queryString}`)
        const list = Array.isArray(data) ? data.map(normalizeProduct) : []
        const merged = [
          ...offlineItems,
          ...list.filter((g) => !offlineItems.some((o) => o.id === g.id)),
        ]
        const result = {
          success: true,
          data: merged,
          pagination: {
            total: merged.length,
            page: params.page || 1,
            limit: params.limit || 50,
          },
          fromCache: false,
        }
        setQueryCache(cacheKey, result)
        return result
      } catch (err) {
        console.warn('Network error in getGuns, falling back to cache:', err)
        const cached = getQueryCache(cacheKey)
        const cachedList = Array.isArray(cached?.data?.data) ? cached.data.data : []
        const merged = [
          ...offlineItems,
          ...cachedList.filter((g) => !offlineItems.some((o) => o.id === g.id)),
        ]
        return {
          success: true,
          data: merged,
          pagination: {
            total: merged.length,
            page: params.page || 1,
            limit: params.limit || 50,
          },
          fromCache: true,
          cacheSource: 'offline-cache',
          isOffline: true,
        }
      }
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    const response = await apiClient.get('/api/v1/recipes', { params: clean })
    if (response?.success) {
      setQueryCache(cacheKey, response)
    }
    return response
  }

  /**
   * Fetch a single product by ID with Query Caching.
   */
  async getGunById(id, options = {}) {
    const cacheKey = `gun_detail_${id}`
    if (!options.forceRefresh) {
      const cached = getQueryCache(cacheKey)
      if (cached && cached.isFresh) {
        return {
          ...cached.data,
          fromCache: true,
          cacheSource: cached.source,
          cachedAt: cached.timestamp,
        }
      }
    }

    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        const result = {
          success: true,
          data: normalizeProduct(data[0]),
          fromCache: false,
        }
        setQueryCache(cacheKey, result)
        return result
      }
      throw new Error('Hardware item not found.')
    }
    const response = await apiClient.get(`/api/v1/recipes/${id}`)
    if (response?.success) {
      setQueryCache(cacheKey, response)
    }
    return response
  }

  /**
   * Create a new product (supports multi-image array and offline FIFO outbox queue).
   */
  async createGun(data, options = {}) {
    const imagesList = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : [data.image_url || '/guns/pistol.svg']

    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients
            .filter((i) => i.name !== '__IMAGES__')
            .map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? [...data.specs]
        : []

      if (imagesList.length > 1) {
        specsArray.push(`${IMAGES_SPEC_PREFIX}${JSON.stringify(imagesList)}`)
      }

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: imagesList[0] || null,
      }

      // Offline handling: queue in Outbox FIFO
      if (!navigator.onLine && !options.fromOutbox) {
        const tempId = `offline-gun-${Date.now()}`
        const offlineGun = normalizeProduct({
          ...payload,
          id: tempId,
          images: imagesList,
          created_at: new Date().toISOString(),
          isOfflinePending: true,
        })
        saveOfflineGun(offlineGun)
        outboxService.enqueue('CREATE_PRODUCT', {
          supabasePayload: payload,
          tempId,
        })
        return { success: true, data: offlineGun, isOffline: true }
      }

      try {
        const res = await apiClient.post('/rest/v1/products', payload, {
          headers: { Prefer: 'return=representation' },
        })
        const created = Array.isArray(res) ? res[0] : res
        if (created?.id && imagesList.length > 0) {
          saveLocalGallery(created.id, imagesList)
        }
        invalidateQueryCache('guns_')
        return { success: true, data: normalizeProduct({ ...created, images: imagesList }) }
      } catch (err) {
        if (!options.fromOutbox) {
          // Fall back to offline queue on network error
          const tempId = `offline-gun-${Date.now()}`
          const offlineGun = normalizeProduct({
            ...payload,
            id: tempId,
            images: imagesList,
            created_at: new Date().toISOString(),
            isOfflinePending: true,
          })
          saveOfflineGun(offlineGun)
          outboxService.enqueue('CREATE_PRODUCT', {
            supabasePayload: payload,
            tempId,
          })
          return { success: true, data: offlineGun, isOffline: true }
        }
        throw err
      }
    }

    const res = await apiClient.post('/api/v1/recipes', data)
    invalidateQueryCache('guns_')
    return res
  }

  /**
   * Update existing product (supports multi-image array).
   */
  async updateGun(id, data) {
    const imagesList = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : data.image_url
      ? [data.image_url]
      : undefined

    if (IS_SUPABASE) {
      let specsArray = Array.isArray(data.ingredients)
        ? data.ingredients
            .filter((i) => i.name !== '__IMAGES__')
            .map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? [...data.specs]
        : undefined

      if (specsArray && imagesList && imagesList.length > 1) {
        specsArray.push(`${IMAGES_SPEC_PREFIX}${JSON.stringify(imagesList)}`)
      }

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (imagesList && imagesList.length > 0) {
        payload.image_url = imagesList[0]
        saveLocalGallery(id, imagesList)
      } else if (data.image_url !== undefined) {
        payload.image_url = data.image_url
      }

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      invalidateQueryCache('guns_')
      invalidateQueryCache(`gun_detail_${id}`)
      return {
        success: true,
        data: normalizeProduct({ ...updated, images: imagesList }),
      }
    }

    const res = await apiClient.put(`/api/v1/recipes/${id}`, data)
    invalidateQueryCache('guns_')
    invalidateQueryCache(`gun_detail_${id}`)
    return res
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    const res = await apiClient.patch(`/api/v1/recipes/${id}`, data)
    invalidateQueryCache('guns_')
    invalidateQueryCache(`gun_detail_${id}`)
    return res
  }

  /**
   * Delete product permanently.
   */
  async deleteGun(id) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      invalidateQueryCache('guns_')
      invalidateQueryCache(`gun_detail_${id}`)
      return { success: true }
    }
    const res = await apiClient.delete(`/api/v1/recipes/${id}`)
    invalidateQueryCache('guns_')
    invalidateQueryCache(`gun_detail_${id}`)
    return res
  }
}

export default new GunService()
