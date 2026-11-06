import { apiClient, IS_SUPABASE } from '../config/api'
import { getUserIdentifier, getUserProfile } from './userService'
import {
  getQueryCache,
  setQueryCache,
  invalidateQueryCache,
} from '../utils/queryCache'
import outboxService from './outboxService'

const LOCAL_REVIEWS_KEY = 'bore_barrel_local_reviews'
const REACTIONS_TAG = '__REACTIONS__:'

// Auto-migration: clean up old stale local records that shadow server reviews
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY)
    if (raw) {
      const map = JSON.parse(raw)
      let changed = false
      Object.keys(map).forEach((prodId) => {
        if (Array.isArray(map[prodId]?.added)) {
          // Keep only true offline/local un-synced reviews
          const pending = map[prodId].added.filter(
            (r) =>
              typeof r.id === 'string' &&
              (r.id.startsWith('offline-') || r.id.startsWith('local-')),
          )
          if (pending.length !== map[prodId].added.length) {
            map[prodId].added = pending
            changed = true
          }
        }
        if (map[prodId]?.edited) {
          map[prodId].edited = {}
          changed = true
        }
      })
      if (changed) {
        localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(map))
      }
    }
  } catch {
    // Ignore migration errors
  }
}

export const parseCommentReactions = (rawComment) => {
  if (!rawComment || typeof rawComment !== 'string') {
    return { text: '', reactions: { likes: [], dislikes: [] } }
  }
  const idx = rawComment.indexOf(REACTIONS_TAG)
  if (idx === -1) {
    return { text: rawComment.trim(), reactions: { likes: [], dislikes: [] } }
  }
  const text = rawComment.substring(0, idx).trim()
  const jsonStr = rawComment.substring(idx + REACTIONS_TAG.length).trim()
  try {
    const parsed = JSON.parse(jsonStr)
    return {
      text,
      reactions: {
        likes: Array.isArray(parsed.likes) ? parsed.likes : [],
        dislikes: Array.isArray(parsed.dislikes) ? parsed.dislikes : [],
      },
    }
  } catch {
    return { text: rawComment.trim(), reactions: { likes: [], dislikes: [] } }
  }
}

export const buildCommentWithReactions = (text, reactions) => {
  const cleanText = (text || '').trim()
  const payload = {
    likes: Array.from(new Set(reactions?.likes || [])),
    dislikes: Array.from(new Set(reactions?.dislikes || [])),
  }
  return `${cleanText}\n\n${REACTIONS_TAG}${JSON.stringify(payload)}`
}

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

class ReviewService {
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline-review-synced', (e) => {
        const { tempId, gunId } = e.detail || {}
        if (tempId && gunId) {
          const localMap = readLocalReviews()
          const key = String(gunId)
          if (localMap[key]?.added) {
            localMap[key].added = localMap[key].added.filter(
              (r) => String(r.id) !== String(tempId),
            )
            writeLocalReviews(localMap)
          }
          invalidateQueryCache(`reviews_${gunId}`)
        }
      })
    }
  }

  /**
   * Enrich a review with reaction counts (likes, dislikes, userReaction) and ownership flag.
   */
  enrichReview(r, currentUserId) {
    const { text, reactions } = parseCommentReactions(r.raw_comment || r.comment)
    const rawOwner = r.raw_user_id || r.user_id || r.owner_id || ''
    const isOwn =
      Boolean(currentUserId) && String(rawOwner) === String(currentUserId)

    const likesList = Array.isArray(reactions.likes) ? reactions.likes : []
    const dislikesList = Array.isArray(reactions.dislikes) ? reactions.dislikes : []

    let userReaction = null
    if (likesList.includes(currentUserId)) {
      userReaction = 'like'
    } else if (dislikesList.includes(currentUserId)) {
      userReaction = 'dislike'
    }

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
      comment: text,
      raw_comment: r.raw_comment || r.comment,
      reactions: { likes: likesList, dislikes: dislikesList },
      created_at: r.created_at || new Date().toISOString(),
      isOwn,
      isPendingSync: Boolean(r.isPendingSync),
      likes: likesList.length,
      dislikes: dislikesList.length,
      userReaction,
    }
  }

  /**
   * Fetch all reviews for a given product (server + local pending).
   */
  async getReviews(gunId, options = {}) {
    const currentUserId = getUserIdentifier()
    const cacheKey = `reviews_${gunId}`

    let serverList = []
    const cached = !options.forceRefresh ? getQueryCache(cacheKey) : null

    if (cached && (cached.isFresh || !navigator.onLine)) {
      serverList = cached.data
    } else if (!navigator.onLine) {
      serverList = cached?.data || []
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
              raw_comment: r.comment || '',
              created_at: r.created_at,
            }))
            // Cache with shorter TTL (60s) so live interactions update quickly
            setQueryCache(cacheKey, serverList, 60 * 1000)
          }
        } else if (!IS_SUPABASE) {
          const res = await apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
          if (res?.data) {
            serverList = res.data
            setQueryCache(cacheKey, serverList, 60 * 1000)
          }
        }
      } catch (err) {
        console.warn('Network review fetch error, falling back to cache:', err)
        serverList = cached?.data || []
      }
    }

    // Merge server reviews with any offline pending reviews
    const localMap = readLocalReviews()
    const productLocal = localMap[String(gunId)] || {
      added: [],
      edited: {},
      deleted: [],
    }
    const deletedSet = new Set((productLocal.deleted || []).map(String))

    // Server reviews are the authoritative source of truth
    const serverIds = new Set(serverList.map((r) => String(r.id)))

    // Purge any localMap.added items that are already confirmed on the server
    if (productLocal.added && productLocal.added.length > 0) {
      const cleanAdded = productLocal.added.filter(
        (r) => !serverIds.has(String(r.id)),
      )
      if (cleanAdded.length !== productLocal.added.length) {
        localMap[String(gunId)].added = cleanAdded
        writeLocalReviews(localMap)
      }
    }

    // Only include offline/local pending reviews that are not on the server
    const pendingOffline = (productLocal.added || []).filter(
      (r) => !serverIds.has(String(r.id)),
    )

    // Put serverList FIRST so server data always takes precedence
    const combined = [...serverList, ...pendingOffline]

    const seenIds = new Set()
    const finalReviews = []

    combined.forEach((rev) => {
      const idStr = String(rev.id)
      if (deletedSet.has(idStr) || seenIds.has(idStr)) return
      seenIds.add(idStr)
      // Only apply local edited override if offline
      const override = !navigator.onLine ? productLocal.edited?.[idStr] : null
      const merged = override ? { ...rev, ...override } : rev
      finalReviews.push(this.enrichReview(merged, currentUserId))
    })

    return {
      success: true,
      data: finalReviews,
      fromCache: Boolean(cached && cached.isFresh),
      isOffline: !navigator.onLine,
    }
  }

  /**
   * Submit a new review (supports offline queueing).
   */
  async createReview(gunId, reviewData, options = {}) {
    const currentUserId =
      reviewData.user_id || reviewData.user_identifier || getUserIdentifier()
    const profile = getUserProfile()

    // Offline handling
    if (!navigator.onLine && !options.fromOutbox) {
      const tempId = `offline-rev-${Date.now()}`
      const newReview = {
        id: tempId,
        product_id: gunId,
        raw_user_id: currentUserId,
        user_identifier: `${profile.username || 'Shooter'} (You)`,
        rating: Number(reviewData.rating),
        comment: reviewData.comment || '',
        raw_comment: reviewData.comment || '',
        created_at: new Date().toISOString(),
        isPendingSync: true,
      }

      const localMap = readLocalReviews()
      const key = String(gunId)
      if (!localMap[key]) localMap[key] = { added: [], edited: {}, deleted: [] }
      localMap[key].added = [newReview, ...localMap[key].added]
      writeLocalReviews(localMap)
      invalidateQueryCache(`reviews_${gunId}`)

      outboxService.enqueue('CREATE_REVIEW', {
        gunId,
        reviewData: {
          user_id: currentUserId,
          rating: Number(reviewData.rating),
          comment: reviewData.comment || '',
        },
        tempId,
      })

      return {
        success: true,
        data: this.enrichReview(newReview, currentUserId),
        isOffline: true,
      }
    }

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
        if (!options.fromOutbox) {
          // Fall back to offline queue
          return this.createReview(gunId, reviewData, { fromOutbox: false })
        }
        throw err
      }
    }

    const newReview = {
      id: created?.id || `local-rev-${Date.now()}`,
      product_id: gunId,
      raw_user_id: currentUserId,
      user_identifier: `${profile.username || 'Shooter'} (You)`,
      rating: Number(reviewData.rating),
      comment: reviewData.comment || '',
      raw_comment: reviewData.comment || '',
      created_at: created?.created_at || new Date().toISOString(),
    }

    // Only store in localMap.added if NOT saved on server
    if (!created?.id) {
      const localMap = readLocalReviews()
      const key = String(gunId)
      if (!localMap[key]) localMap[key] = { added: [], edited: {}, deleted: [] }
      localMap[key].added = [
        newReview,
        ...localMap[key].added.filter((r) => String(r.id) !== String(newReview.id)),
      ]
      writeLocalReviews(localMap)
    }

    invalidateQueryCache(`reviews_${gunId}`)
    return { success: true, data: this.enrichReview(newReview, currentUserId) }
  }

  /**
   * Edit an existing review created by the current user.
   */
  async updateReview(reviewId, reviewData, gunId) {
    const currentUserId = getUserIdentifier()
    const { reactions } = parseCommentReactions(reviewData.raw_comment || '')
    const fullComment = buildCommentWithReactions(reviewData.comment, reactions)

    if (
      IS_SUPABASE &&
      !String(reviewId).startsWith('local-rev-') &&
      !String(reviewId).startsWith('offline-')
    ) {
      try {
        await apiClient.patch(
          `/rest/v1/reviews?id=eq.${reviewId}`,
          {
            rating: Number(reviewData.rating),
            comment: fullComment,
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
        raw_comment: fullComment,
        updated_at: new Date().toISOString(),
      }
      localMap[key].added = localMap[key].added.map((r) =>
        String(r.id) === String(reviewId)
          ? {
              ...r,
              rating: Number(reviewData.rating),
              comment: reviewData.comment,
              raw_comment: fullComment,
            }
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
        raw_comment: fullComment,
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
      !String(reviewId).startsWith('offline-')
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
   * Toggle Like ('like') or Dislike ('dislike') on a review with Supabase persistence.
   */
  async toggleReaction(review, reactionType) {
    const currentUserId = getUserIdentifier()
    const reviewId = String(review.id)
    const { text, reactions } = parseCommentReactions(
      review.raw_comment || review.comment,
    )

    let likes = Array.isArray(reactions.likes) ? [...reactions.likes] : []
    let dislikes = Array.isArray(reactions.dislikes) ? [...reactions.dislikes] : []

    const hasLiked = likes.includes(currentUserId)
    const hasDisliked = dislikes.includes(currentUserId)

    if (reactionType === 'like') {
      if (hasLiked) {
        // Untoggle like
        likes = likes.filter((id) => id !== currentUserId)
      } else {
        // Toggle on like & remove dislike
        likes = Array.from(new Set([...likes, currentUserId]))
        dislikes = dislikes.filter((id) => id !== currentUserId)
      }
    } else if (reactionType === 'dislike') {
      if (hasDisliked) {
        // Untoggle dislike
        dislikes = dislikes.filter((id) => id !== currentUserId)
      } else {
        // Toggle on dislike & remove like
        dislikes = Array.from(new Set([...dislikes, currentUserId]))
        likes = likes.filter((id) => id !== currentUserId)
      }
    }

    const updatedComment = buildCommentWithReactions(text, { likes, dislikes })

    // Invalidate query cache for this review set
    invalidateQueryCache(`reviews_${review.product_id}`)

    // 1. Sync to Supabase or queue in Outbox if offline
    if (
      IS_SUPABASE &&
      !reviewId.startsWith('local-') &&
      !reviewId.startsWith('offline-')
    ) {
      if (navigator.onLine) {
        try {
          await apiClient.patch(
            `/rest/v1/reviews?id=eq.${reviewId}`,
            { comment: updatedComment },
            { headers: { Prefer: 'return=representation' } },
          )
        } catch (err) {
          console.warn('Reaction patch offline fallback:', err)
          outboxService.enqueue('TOGGLE_REACTION', {
            reviewId,
            comment: updatedComment,
          })
        }
      } else {
        outboxService.enqueue('TOGGLE_REACTION', {
          reviewId,
          comment: updatedComment,
        })
      }
    }

    let userReaction = null
    if (likes.includes(currentUserId)) userReaction = 'like'
    else if (dislikes.includes(currentUserId)) userReaction = 'dislike'

    return {
      likes: likes.length,
      dislikes: dislikes.length,
      userReaction,
      reactions: { likes, dislikes },
      raw_comment: updatedComment,
      comment: text,
    }
  }

  /**
   * Sync a reaction comment update directly to Supabase (called by Outbox worker).
   */
  async syncReactionToSupabase(reviewId, comment) {
    if (
      IS_SUPABASE &&
      !String(reviewId).startsWith('local-') &&
      !String(reviewId).startsWith('offline-')
    ) {
      await apiClient.patch(
        `/rest/v1/reviews?id=eq.${reviewId}`,
        { comment },
        { headers: { Prefer: 'return=minimal' } },
      )
      return true
    }
    return true
  }
}

export default new ReviewService()
