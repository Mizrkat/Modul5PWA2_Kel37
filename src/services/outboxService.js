// ---------------------------------------------------------------------------
// outboxService.js — Outbox FIFO Mutation Queue & Offline Synchronization Engine
//
// Menyimpan mutasi data (CREATE_PRODUCT, CREATE_REVIEW, TOGGLE_REACTION) yang
// dilakukan pengguna saat offline ke dalam antrean FIFO (localStorage).
// Saat koneksi pulih ('online' event), antrean diproses secara berurutan
// dan disinkronkan ke Supabase REST API.
// ---------------------------------------------------------------------------

import { apiClient, IS_SUPABASE } from '../config/api'
import { invalidateQueryCache } from '../utils/queryCache'

const OUTBOX_KEY = 'bore_barrel_outbox_queue'
let isSyncing = false

const readQueue = () => {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeQueue = (queue) => {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue))
    window.dispatchEvent(
      new CustomEvent('outbox-updated', { detail: { count: queue.length } }),
    )
    return true
  } catch {
    return false
  }
}

class OutboxService {
  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.info('[OutboxService] Network back online. Triggering FIFO sync...')
        this.processQueue()
      })
    }
  }

  /**
   * Get all queued mutations.
   */
  getQueue() {
    return readQueue()
  }

  /**
   * Get count of pending mutations in outbox.
   */
  getPendingCount() {
    return readQueue().length
  }

  /**
   * Enqueue a new mutation into the FIFO queue.
   * @param {'CREATE_PRODUCT'|'CREATE_REVIEW'|'TOGGLE_REACTION'} type
   * @param {any} payload
   */
  enqueue(type, payload) {
    const item = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
    }

    const queue = readQueue()
    queue.push(item)
    writeQueue(queue)
    console.info(`[OutboxService] Enqueued ${type}:`, item.id)

    // Attempt processing immediately if online
    if (navigator.onLine) {
      setTimeout(() => this.processQueue(), 100)
    }

    return item
  }

  /**
   * Process all queued mutations in FIFO order.
   */
  async processQueue() {
    if (isSyncing || !navigator.onLine) return
    const queue = readQueue()
    if (queue.length === 0) return

    isSyncing = true
    window.dispatchEvent(new CustomEvent('outbox-sync-start'))
    let syncedCount = 0

    try {
      while (queue.length > 0) {
        const item = queue[0] // FIFO head
        let success = false

        try {
          if (item.type === 'CREATE_PRODUCT') {
            success = await this.syncCreateProduct(item.payload)
          } else if (item.type === 'CREATE_REVIEW') {
            success = await this.syncCreateReview(item.payload)
          } else if (item.type === 'TOGGLE_REACTION') {
            success = await this.syncToggleReaction(item.payload)
          }
        } catch (err) {
          console.error(`[OutboxService] Error syncing ${item.type}:`, err)
          item.attempts = (item.attempts || 0) + 1
          // If still offline or network error, stop processing and retry later
          if (!navigator.onLine) break
        }

        if (success) {
          queue.shift() // Dequeue FIFO head
          writeQueue(queue)
          syncedCount++
        } else {
          // If persistent failure and online, keep in queue or abort
          break
        }
      }
    } finally {
      isSyncing = false
      if (syncedCount > 0) {
        invalidateQueryCache('')
        window.dispatchEvent(
          new CustomEvent('outbox-synced', { detail: { count: syncedCount } }),
        )
      }
      window.dispatchEvent(new CustomEvent('outbox-sync-end'))
    }
  }

  /**
   * Sync a pending product to Supabase.
   */
  async syncCreateProduct(payload) {
    if (IS_SUPABASE) {
      const res = await apiClient.post('/rest/v1/products', payload.supabasePayload || payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      if (created?.id && payload.tempId) {
        // Clean up temporary offline product
        window.dispatchEvent(
          new CustomEvent('offline-product-synced', {
            detail: { tempId: payload.tempId, realId: created.id },
          }),
        )
      }
      return true
    }
    return false
  }

  /**
   * Sync a pending review to Supabase.
   */
  async syncCreateReview({ gunId, reviewData, tempId }) {
    if (IS_SUPABASE) {
      const payload = {
        product_id: Number(gunId),
        user_id: reviewData.user_id || reviewData.user_identifier,
        rating: Number(reviewData.rating),
        comment: reviewData.comment || '',
      }
      const res = await apiClient.post('/rest/v1/reviews', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      if (created?.id && tempId) {
        window.dispatchEvent(
          new CustomEvent('offline-review-synced', {
            detail: { tempId, realId: created.id, gunId },
          }),
        )
      }
      return true
    }
    return false
  }

  /**
   * Sync an updated reaction to Supabase.
   */
  async syncToggleReaction({ reviewId, comment }) {
    if (IS_SUPABASE && !String(reviewId).startsWith('local-') && !String(reviewId).startsWith('offline-')) {
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

const outboxService = new OutboxService()
export default outboxService
