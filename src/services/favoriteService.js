import { apiClient, IS_SUPABASE } from '../config/api'
import { normalizeProduct } from './gunService'
import {
  getQueryCache,
  setQueryCache,
  invalidateQueryCache,
} from '../utils/queryCache'

class FavoriteService {
  /**
   * Retrieve all favourited products for the given user with Query Caching.
   */
  async getFavorites(userIdentifier, options = {}) {
    const cacheKey = `favorites_${userIdentifier}`
    if (!options.forceRefresh) {
      const cached = getQueryCache(cacheKey)
      if (cached && (cached.isFresh || !navigator.onLine)) {
        return {
          ...cached.data,
          fromCache: true,
          cacheSource: cached.source,
          cachedAt: cached.timestamp,
        }
      }
    }

    if (!navigator.onLine) {
      const cached = getQueryCache(cacheKey)
      if (cached?.data) {
        return {
          ...cached.data,
          fromCache: true,
          cacheSource: 'offline-cache',
        }
      }
    }

    if (IS_SUPABASE) {
      const data = await apiClient.get(
        `/rest/v1/favorites?user_id=eq.${userIdentifier}&select=product_id,created_at,products(*)`,
      )
      const list = Array.isArray(data)
        ? data.map((fav) => {
            const prod = fav.products ? normalizeProduct(fav.products) : null
            return {
              ...(prod || {}),
              id: fav.product_id,
              recipe_id: fav.product_id,
              product_id: fav.product_id,
              created_at: fav.created_at,
            }
          })
        : []
      const result = { success: true, data: list, fromCache: false }
      setQueryCache(cacheKey, result)
      return result
    }

    const res = await apiClient.get('/api/v1/favorites', {
      params: { user_identifier: userIdentifier },
    })
    if (res?.success) {
      setQueryCache(cacheKey, res)
    }
    return res
  }

  /**
   * Toggle a product's favourite state (add <-> remove).
   */
  async toggleFavorite(data) {
    const userId = data.user_identifier
    if (IS_SUPABASE) {
      const targetId = Number(data.recipe_id || data.gun_id)

      const existing = await apiClient.get(
        `/rest/v1/favorites?product_id=eq.${targetId}&user_id=eq.${userId}&select=*`,
      )
      let isFavorited = false
      if (Array.isArray(existing) && existing.length > 0) {
        await apiClient.delete(
          `/rest/v1/favorites?product_id=eq.${targetId}&user_id=eq.${userId}`,
        )
        isFavorited = false
      } else {
        await apiClient.post(
          '/rest/v1/favorites',
          { product_id: targetId, user_id: userId },
          { headers: { Prefer: 'return=minimal' } },
        )
        isFavorited = true
      }
      invalidateQueryCache(`favorites_${userId}`)
      return { success: true, data: { is_favorited: isFavorited } }
    }
    const res = await apiClient.post('/api/v1/favorites/toggle', data)
    invalidateQueryCache(`favorites_${userId}`)
    return res
  }
}

export default new FavoriteService()
