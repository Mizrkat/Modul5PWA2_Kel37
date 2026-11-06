import { useState, useEffect, useCallback } from 'react'
import reviewService from '../services/reviewService'

export function useReviews(gunId) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReviews = useCallback(
    async (forceRefresh = false) => {
      if (!gunId) {
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError(null)
        const response = await reviewService.getReviews(gunId, { forceRefresh })
        if (response.success) {
          setReviews(response.data || [])
        } else {
          setError(response.message || 'Failed to fetch reviews.')
        }
      } catch (err) {
        setError(err.message || 'An error occurred while fetching reviews.')
        setReviews([])
      } finally {
        setLoading(false)
      }
    },
    [gunId],
  )

  useEffect(() => {
    fetchReviews(true)
    const handleSync = () => fetchReviews(true)
    window.addEventListener('outbox-synced', handleSync)
    return () => window.removeEventListener('outbox-synced', handleSync)
  }, [fetchReviews])

  const updateReview = async (reviewId, reviewData) => {
    const res = await reviewService.updateReview(reviewId, reviewData, gunId)
    if (res.success) {
      await fetchReviews(true)
    }
    return res
  }

  const deleteReview = async (reviewId) => {
    const res = await reviewService.deleteReview(reviewId, gunId)
    if (res.success) {
      await fetchReviews(true)
    }
    return res
  }

  const reactToReview = async (review, reactionType) => {
    const updated = await reviewService.toggleReaction(review, reactionType)
    setReviews((prev) =>
      prev.map((r) =>
        String(r.id) === String(review.id) ? { ...r, ...updated } : r,
      ),
    )
  }

  return {
    reviews,
    loading,
    error,
    refetch: () => fetchReviews(true),
    updateReview,
    deleteReview,
    reactToReview,
  }
}

export function useCreateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const createReview = async (gunId, reviewData) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)
      const response = await reviewService.createReview(gunId, reviewData)
      if (response.success) {
        setSuccess(true)
        return response.data
      } else {
        setError(response.message || 'Failed to submit review.')
        return null
      }
    } catch (err) {
      setError(err.message || 'An error occurred while submitting review.')
      return null
    } finally {
      setLoading(false)
    }
  }

  return { createReview, loading, error, success }
}
