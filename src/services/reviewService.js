import { apiClient, IS_SUPABASE } from '../config/api'
import { getUserIdentifier, getUserProfile } from './userService'
import {
  getQueryCache,
  setQueryCache,
  invalidateQueryCache,
} from '../utils/queryCache'

const LOCAL_REVIEWS_KEY = 'bore_barrel_local_reviews'
const REACTIONS_KEY = 'bore_barrel_review_reactions'

const readLocalReviews = () => {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const writeLocalReviews = (map) => {
  try {
    localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(map))
  } catch {
    // Ignore
  }
}

const readReactionsMap = () => {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const writeReactionsMap = (map) => {
  try {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(map))
  } catch {
    // Ignore
  }
}

class ReviewService {
  /**
   * Enrich a review with reaction counts (likes, dislikes, userReaction) and ownership flag.
   */
  enrichReview(r, currentUserId) {
    const reactionsMap = readReactionsMap()
    const entry = reactionsMap[String(r.id)] || {
      likes: 0,
      dislikes: 0,
      byUser: {},
    }
    const rawOwner = r.raw_user_id || r.user_id || r.owner_id || ''
    const isOwn =
      Boolean(currentUserId) && String(rawOwner) === String(currentUserId)

    return {
      ...r,
      id: r.id,
      product_id: r.product_id,
      raw_user_id: rawOwner,
      user_identifier: isOwn
        ? `${getUserProfile().username || 'Shooter'} (You)`
        : (r.user_identifier ||
            (rawOwner
              ? `Operator ${String(rawOwner).substring(0, 8)}`
              : 'Anonymous')),
      rating: Number(r.rating) || 5,
      comment: r.comment || '',
      created_at: r.created_at || new Date().toISOString(),
      isOwn,
      likes: entry.likes ?? 0,
      dislikes: entry.dislikes ?? 0,
      userReaction: entry.byUser?.[currentUserId] || null, // 'like' | 'dislike' | null
    }
  }

  /**
   * Fetch all reviews for a given product (server + local + community seed).
   */
  async getReviews(gunId, options = {}) {
    const currentUserId = getUserIdentifier()
    const cacheKey = `reviews_${gunId}`

    let serverList = []
    const cached = !options.forceRefresh ? getQueryCache(cacheKey) : null

    if (cached && cached.isFresh) {
      serverList = cached.data
    } else {
      try {
        if (IS_SUPABASE && !String(gunId).startsWith('local-')) {
          const data = await apiClient.get(
            `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
          )
          if (Array.isArray(data)) {
            serverList = data.map((r) => ({
              id: r.id,
              product_id: r.product_id,
              raw_user_id: r.user_id,
              user_identifier: r.user_id
                ? `Operator ${String(r.user_id).substring(0, 8)}`
                : 'Anonymous',
              rating: r.rating,
              comment: r.comment || '',
              created_at: r.created_at,
            }))
            setQueryCache(cacheKey, serverList)
          }
        } else if (!IS_SUPABASE) {
          const res = await apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
          if (res?.data) {
            serverList = res.data
            setQueryCache(cacheKey, serverList)
          }
        }
      } catch (err) {
        console.warn('Using local fallback reviews:', err)
      }
    }

    // Merge local overrides/additions + seed reviews from other users
    const localMap = readLocalReviews()
    const productLocal = localMap[String(gunId)] || {
      added: [],
      edited: {},
      deleted: [],
    }
    const deletedSet = new Set((productLocal.deleted || []).map(String))

    const combined = [
      ...(productLocal.added || []),
      ...serverList,
    ]

    const seenIds = new Set()
    const finalReviews = []

    combined.forEach((rev) => {
      const idStr = String(rev.id)
      if (deletedSet.has(idStr) || seenIds.has(idStr)) return
      seenIds.add(idStr)
      const override = productLocal.edited?.[idStr]
      const merged = override ? { ...rev, ...override } : rev
      finalReviews.push(this.enrichReview(merged, currentUserId))
    })

    return {
      success: true,
      data: finalReviews,
      fromCache: Boolean(cached && cached.isFresh),
    }
  }

  /**
   * Submit a new review.
   */
  async createReview(gunId, reviewData) {
    const currentUserId = reviewData.user_id || reviewData.user_identifier || getUserIdentifier()
    const profile = getUserProfile()

    let created = null
    if (IS_SUPABASE && !String(gunId).startsWith('local-')) {
      try {
        const payload = {
          product_id: Number(gunId),
          user_id: currentUserId,
          rating: Number(reviewData.rating),
          comment: reviewData.comment || '',
        }
        const res = await apiClient.post('/rest/v1/reviews', payload, {
          headers: { Prefer: 'return=representation' },
        })
        created = Array.isArray(res) ? res[0] : res
      } catch (err) {
        console.warn('Server review create fallback to localStorage:', err)
      }
    }

    const newReview = {
      id: created?.id || `local-rev-${Date.now()}`,
      product_id: gunId,
      raw_user_id: currentUserId,
      user_identifier: `${profile.username || 'Shooter'} (You)`,
      rating: Number(reviewData.rating),
      comment: reviewData.comment || '',
      created_at: created?.created_at || new Date().toISOString(),
    }

    const localMap = readLocalReviews()
    const key = String(gunId)
    if (!localMap[key]) localMap[key] = { added: [], edited: {}, deleted: [] }
    localMap[key].added = [
      newReview,
      ...localMap[key].added.filter((r) => String(r.id) !== String(newReview.id)),
    ]
    writeLocalReviews(localMap)
    invalidateQueryCache(`reviews_${gunId}`)

    return { success: true, data: this.enrichReview(newReview, currentUserId) }
  }

  /**
   * Edit an existing review created by the current user.
   */
  async updateReview(reviewId, reviewData, gunId) {
    const currentUserId = getUserIdentifier()
    if (
      IS_SUPABASE &&
      !String(reviewId).startsWith('local-rev-') &&
      !String(reviewId).startsWith('seed-')
    ) {
      try {
        await apiClient.patch(
          `/rest/v1/reviews?id=eq.${reviewId}`,
          {
            rating: Number(reviewData.rating),
            comment: reviewData.comment,
          },
          { headers: { Prefer: 'return=representation' } },
        )
      } catch (err) {
        console.warn('Fallback to local review update:', err)
      }
    }

    if (gunId !== undefined) {
      const localMap = readLocalReviews()
      const key = String(gunId)
      if (!localMap[key]) localMap[key] = { added: [], edited: {}, deleted: [] }
      localMap[key].edited[String(reviewId)] = {
        rating: Number(reviewData.rating),
        comment: reviewData.comment,
        updated_at: new Date().toISOString(),
      }
      localMap[key].added = localMap[key].added.map((r) =>
        String(r.id) === String(reviewId)
          ? { ...r, rating: Number(reviewData.rating), comment: reviewData.comment }
          : r,
      )
      writeLocalReviews(localMap)
      invalidateQueryCache(`reviews_${gunId}`)
    }

    return {
      success: true,
      data: {
        id: reviewId,
        rating: Number(reviewData.rating),
        comment: reviewData.comment,
        raw_user_id: currentUserId,
      },
    }
  }

  /**
   * Delete a review created by the current user.
   */
  async deleteReview(reviewId, gunId) {
    if (
      IS_SUPABASE &&
      !String(reviewId).startsWith('local-rev-') &&
      !String(reviewId).startsWith('seed-')
    ) {
      try {
        await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
      } catch (err) {
        console.warn('Fallback to local review delete:', err)
      }
    }

    if (gunId !== undefined) {
      const localMap = readLocalReviews()
      const key = String(gunId)
      if (!localMap[key]) localMap[key] = { added: [], edited: {}, deleted: [] }
      if (!localMap[key].deleted.includes(String(reviewId))) {
        localMap[key].deleted.push(String(reviewId))
      }
      localMap[key].added = localMap[key].added.filter(
        (r) => String(r.id) !== String(reviewId),
      )
      writeLocalReviews(localMap)
      invalidateQueryCache(`reviews_${gunId}`)
    }

    return { success: true }
  }

  /**
   * Toggle Like ('like') or Dislike ('dislike') on another user's review.
   */
  toggleReaction(review, reactionType) {
    const currentUserId = getUserIdentifier()
    const reviewId = String(review.id)
    const reactionsMap = readReactionsMap()

    const currentEntry = reactionsMap[reviewId] || {
      likes: review.likes ?? 0,
      dislikes: review.dislikes ?? 0,
      byUser: {},
    }

    const prevReaction = currentEntry.byUser[currentUserId] || null

    if (prevReaction === reactionType) {
      // Remove existing reaction
      delete currentEntry.byUser[currentUserId]
      if (reactionType === 'like') {
        currentEntry.likes = Math.max(0, currentEntry.likes - 1)
      } else {
        currentEntry.dislikes = Math.max(0, currentEntry.dislikes - 1)
      }
    } else {
      // Switch or add new reaction
      if (prevReaction === 'like') {
        currentEntry.likes = Math.max(0, currentEntry.likes - 1)
      } else if (prevReaction === 'dislike') {
        currentEntry.dislikes = Math.max(0, currentEntry.dislikes - 1)
      }
      currentEntry.byUser[currentUserId] = reactionType
      if (reactionType === 'like') {
        currentEntry.likes += 1
      } else {
        currentEntry.dislikes += 1
      }
    }

    reactionsMap[reviewId] = currentEntry
    writeReactionsMap(reactionsMap)

    return {
      likes: currentEntry.likes,
      dislikes: currentEntry.dislikes,
      userReaction: currentEntry.byUser[currentUserId] || null,
    }
  }
}

export default new ReviewService()
