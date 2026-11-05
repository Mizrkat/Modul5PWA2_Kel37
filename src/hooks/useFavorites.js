import { useState, useEffect, useCallback } from 'react'
import favoriteService from '../services/favoriteService'
import { getUserIdentifier } from '../services/userService'

const LOCAL_KEY = 'bore_barrel_favorites'

const readLocalFavs = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeLocalFavs = (ids) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids))
  } catch {
    /* quota exceeded */
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLocal, setIsLocal] = useState(false)
  const userIdentifier = getUserIdentifier()

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await favoriteService.getFavorites(userIdentifier)
      if (response.success) {
        setFavorites(response.data || [])
        setIsLocal(false)
      } else {
        throw new Error(response.message)
      }
    } catch {
      setFavorites(readLocalFavs())
      setIsLocal(true)
    } finally {
      setLoading(false)
    }
  }, [userIdentifier])

  useEffect(() => {
    fetchFavorites()
    const handleFavUpdate = () => fetchFavorites()
    window.addEventListener('favorites-updated', handleFavUpdate)
    return () => window.removeEventListener('favorites-updated', handleFavUpdate)
  }, [fetchFavorites])

  return { favorites, loading, error, isLocal, refetch: fetchFavorites }
}

export function useToggleFavorite() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const userIdentifier = getUserIdentifier()

  const toggleFavorite = async (gunId) => {
    try {
      setLoading(true)
      setError(null)
      const response = await favoriteService.toggleFavorite({
        recipe_id: gunId,
        user_identifier: userIdentifier,
      })
      if (response.success) {
        window.dispatchEvent(new CustomEvent('favorites-updated'))
        return response.data
      }
      throw new Error(response.message)
    } catch {
      const current = readLocalFavs()
      const idx = current.findIndex((id) => String(id) === String(gunId))
      let isFavorited
      if (idx === -1) {
        current.push(gunId)
        isFavorited = true
      } else {
        current.splice(idx, 1)
        isFavorited = false
      }
      writeLocalFavs(current)
      window.dispatchEvent(new CustomEvent('favorites-updated'))
      return { is_favorited: isFavorited }
    } finally {
      setLoading(false)
    }
  }

  return { toggleFavorite, loading, error }
}

export function useIsFavorited(gunId) {
  const { favorites, loading: fetchLoading, refetch } = useFavorites()
  const { toggleFavorite: toggle, loading: toggleLoading } = useToggleFavorite()

  const isFavorited = favorites.some((fav) => {
    const favId =
      typeof fav === 'object' && fav !== null
        ? fav.id ?? fav.product_id ?? fav.recipe_id
        : fav
    return String(favId) === String(gunId)
  })

  const toggleFavorite = async () => {
    const result = await toggle(gunId)
    if (result) await refetch()
    return result
  }

  return {
    isFavorited,
    loading: fetchLoading || toggleLoading,
    toggleFavorite,
  }
}

export { getUserIdentifier }
