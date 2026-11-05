import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [cacheInfo, setCacheInfo] = useState({ fromCache: false, source: null })

  const paramKey = JSON.stringify(params)

  const fetchGuns = useCallback(
    async (forceRefresh = false) => {
      try {
        setLoading(true)
        setError(null)
        const response = await gunService.getGuns(params, { forceRefresh })
        if (response.success) {
          setGuns(response.data || [])
          setPagination(response.pagination || null)
          setCacheInfo({
            fromCache: Boolean(response.fromCache),
            source: response.cacheSource || 'network',
            cachedAt: response.cachedAt || Date.now(),
          })
        } else {
          setError(response.message || 'Failed to fetch products.')
        }
      } catch (err) {
        setError(err.message || 'An error occurred while fetching products.')
        setGuns([])
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramKey],
  )

  useEffect(() => {
    fetchGuns(false)
  }, [fetchGuns])

  return {
    guns,
    loading,
    error,
    pagination,
    cacheInfo,
    refetch: () => fetchGuns(true),
  }
}

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fromCache, setFromCache] = useState(false)

  const fetchGun = useCallback(
    async (forceRefresh = false) => {
      if (!id) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError(null)
        const response = await gunService.getGunById(id, { forceRefresh })
        if (response.success) {
          setGun(response.data)
          setFromCache(Boolean(response.fromCache))
        } else {
          setError(response.message || 'Product not found.')
        }
      } catch (err) {
        setError(err.message || 'Failed to load product details.')
        setGun(null)
      } finally {
        setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    fetchGun(false)
  }, [fetchGun])

  return { gun, loading, error, fromCache, refetch: () => fetchGun(true) }
}
