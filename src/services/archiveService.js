// ---------------------------------------------------------------------------
// archiveService.js — Manages archived catalog items.
// Supports archiving any catalog item, viewing all archived items on a
// dedicated page, restoring items to the active catalog, and permanently
// deleting items.
// ---------------------------------------------------------------------------

const ARCHIVE_KEY = 'bore_barrel_archived_guns'

const readArchiveMap = () => {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const writeArchiveMap = (map) => {
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('archive-updated'))
    return true
  } catch {
    return false
  }
}

class ArchiveService {
  /**
   * Check if a given product ID is currently archived.
   */
  isArchived(gunId) {
    if (gunId === undefined || gunId === null) return false
    const map = readArchiveMap()
    return Boolean(map[String(gunId)])
  }

  /**
   * Get all archived product records sorted by most recently archived.
   */
  getArchivedGuns() {
    const map = readArchiveMap()
    return Object.values(map).sort(
      (a, b) => new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0),
    )
  }

  /**
   * Get count of archived products.
   */
  getArchivedCount() {
    return Object.keys(readArchiveMap()).length
  }

  /**
   * Move a product to the archive.
   */
  archiveGun(gun) {
    if (!gun) return false
    const id = String(gun.id ?? gun.name)
    const map = readArchiveMap()
    map[id] = {
      ...gun,
      id: gun.id ?? id,
      archivedAt: new Date().toISOString(),
    }
    return writeArchiveMap(map)
  }

  /**
   * Restore an archived product back to the active catalog.
   */
  restoreGun(gunId) {
    const id = String(gunId)
    const map = readArchiveMap()
    if (!map[id]) return null
    const restored = map[id]
    delete map[id]
    writeArchiveMap(map)
    return restored
  }

  /**
   * Remove an archived product from archive storage (used during permanent delete).
   */
  removeFromArchive(gunId) {
    const id = String(gunId)
    const map = readArchiveMap()
    if (map[id]) {
      delete map[id]
      writeArchiveMap(map)
    }
    return true
  }
}

export default new ArchiveService()
