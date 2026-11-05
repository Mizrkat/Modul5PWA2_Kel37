// ---------------------------------------------------------------------------
// draftStorage.js — auto-save / restore form drafts via localStorage.
// Supports listing all drafts in the Profile Page Drafts section.
// ---------------------------------------------------------------------------
const PREFIX = 'gun_draft_'
const TS_SUFFIX = '_ts'

/**
 * Persist a draft object.
 * @param {Object} draftData — arbitrary JSON-serializable form state
 * @param {string} draftId   — 'create' or a product UUID
 * @returns {boolean} true on success
 */
export const saveDraft = (draftData, draftId = 'create') => {
  try {
    const key = `${PREFIX}${draftId}`
    const ts = new Date().toISOString()
    localStorage.setItem(
      key,
      JSON.stringify({ ...draftData, draftId: String(draftId), savedAt: ts }),
    )
    localStorage.setItem(`${key}${TS_SUFFIX}`, ts)
    window.dispatchEvent(new CustomEvent('drafts-updated'))
    return true
  } catch {
    return false
  }
}

/**
 * Load a previously saved draft.
 * @returns {Object|null}
 */
export const loadDraft = (draftId = 'create') => {
  try {
    const raw = localStorage.getItem(`${PREFIX}${draftId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Remove a draft and its timestamp from storage.
 */
export const deleteDraft = (draftId = 'create') => {
  try {
    const key = `${PREFIX}${draftId}`
    localStorage.removeItem(key)
    localStorage.removeItem(`${key}${TS_SUFFIX}`)
    window.dispatchEvent(new CustomEvent('drafts-updated'))
    return true
  } catch {
    return false
  }
}

/**
 * Check whether a draft exists.
 */
export const hasDraft = (draftId = 'create') => {
  try {
    return localStorage.getItem(`${PREFIX}${draftId}`) !== null
  } catch {
    return false
  }
}

/**
 * Return the ISO-8601 timestamp string of the last save, or null.
 */
export const getDraftTimestamp = (draftId = 'create') => {
  try {
    return localStorage.getItem(`${PREFIX}${draftId}${TS_SUFFIX}`)
  } catch {
    return null
  }
}

/**
 * Human-readable "time ago" label for a draft timestamp.
 */
export const formatDraftTime = (timestamp) => {
  if (!timestamp) return ''
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Return all existing draft ids.
 */
export const getAllDraftIds = () => {
  try {
    const ids = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX) && !k.endsWith(TS_SUFFIX)) {
        ids.push(k.slice(PREFIX.length))
      }
    }
    return ids
  } catch {
    return []
  }
}

/**
 * Return full details of all saved drafts for the ProfilePage Drafts section.
 */
export const getAllDrafts = () => {
  try {
    const ids = getAllDraftIds()
    return ids
      .map((id) => {
        const data = loadDraft(id)
        if (!data) return null
        const fd = data.formData || {}
        const images =
          Array.isArray(data.uploadedImages) && data.uploadedImages.length > 0
            ? data.uploadedImages
            : data.uploadedImageUrl
            ? [data.uploadedImageUrl]
            : data.imagePreview
            ? [data.imagePreview]
            : ['/guns/pistol.svg']
        return {
          draftId: id,
          isCreate: id === 'create' || id.startsWith('create_'),
          name: fd.name?.trim() || 'Untitled Hardware Draft',
          type: fd.type || 'Pistol',
          caliber: fd.caliber || '9mm',
          price: Number(fd.price ?? 599),
          description: fd.description || '',
          image: images[0],
          imagesCount: images.length,
          savedAt: data.savedAt || getDraftTimestamp(id),
          raw: data,
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
  } catch {
    return []
  }
}

/**
 * Remove every gun draft from storage.
 */
export const clearAllDrafts = () => {
  getAllDraftIds().forEach(deleteDraft)
}
