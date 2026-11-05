import { useState, useEffect } from 'react'
import { Archive, RotateCcw, Trash2, ArrowRight, Images } from 'lucide-react'
import archiveService from '../services/archiveService'
import gunService from '../services/gunService'
import LazyImage from '../components/common/LazyImage'
import ConfirmModal from '../components/modals/ConfirmModal'
import { formatPrice, truncate } from '../utils/helpers'

/**
 * ArchivePage — Displays all archived catalog items in a dedicated page.
 * Supports restoring items back to the active catalog or permanently deleting them.
 */
export default function ArchivePage({ onSelectGun, onNavigateCatalog }) {
  const [archivedItems, setArchivedItems] = useState(() =>
    archiveService.getArchivedGuns(),
  )
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [feedback, setFeedback] = useState('')

  const refreshArchive = () => {
    setArchivedItems(archiveService.getArchivedGuns())
  }

  useEffect(() => {
    window.addEventListener('archive-updated', refreshArchive)
    return () => window.removeEventListener('archive-updated', refreshArchive)
  }, [])

  const handleRestore = (gun) => {
    archiveService.restoreGun(gun.id || gun.name)
    refreshArchive()
    setFeedback(`"${gun.name}" has been restored to the active catalog.`)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const id = deleteTarget.id || deleteTarget.name
      if (id && !String(id).startsWith('local-')) {
        try {
          await gunService.deleteGun(id)
        } catch (err) {
          console.warn('Server delete skipped or already removed:', err)
        }
      }
      archiveService.removeFromArchive(id)
      setDeleteTarget(null)
      refreshArchive()
      setFeedback('Hardware record permanently deleted.')
      setTimeout(() => setFeedback(''), 3000)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="archive-page">
      <section className="masthead">
        <h1 className="display">Armory Archive</h1>
        <p className="lede">
          Decommissioned and archived catalog items. Restore items back to active
          duty or permanently expunge them from the registry.
        </p>
      </section>

      {feedback && <div className="toast toast--success">{feedback}</div>}

      <section className="archive-content">
        <div className="list-head">
          <h2>Archived Inventory</h2>
          <span className="count">
            {archivedItems.length} item{archivedItems.length !== 1 ? 's' : ''} archived
          </span>
        </div>

        {archivedItems.length === 0 ? (
          <div className="state-box">
            <Archive size={36} stroke="var(--steel)" />
            <h3>Archive is empty</h3>
            <p className="lede">
              Items you archive from the catalog will be stored safely here until you
              restore or permanently delete them.
            </p>
            {onNavigateCatalog && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onNavigateCatalog}
                style={{ marginTop: '16px' }}
              >
                Return to Catalog <ArrowRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <ul className="stock">
            {archivedItems.map((gun) => {
              const images =
                Array.isArray(gun.images) && gun.images.length > 0
                  ? gun.images
                  : [gun.image_url || gun.image || '/guns/pistol.svg']
              return (
                <li key={gun.id || gun.name} className="card">
                  <button
                    type="button"
                    className="card-btn"
                    onClick={() => onSelectGun && onSelectGun(gun)}
                  >
                    <div style={{ position: 'relative', width: '100%' }}>
                      <LazyImage
                        className="card-img"
                        src={images[0]}
                        alt={gun.name}
                        width="240"
                        height="180"
                      />
                      {images.length > 1 && (
                        <span className="multi-img-badge">
                          <Images size={12} /> {images.length}
                        </span>
                      )}
                    </div>
                    <span className="name display">{gun.name}</span>
                    <span className="type">
                      {gun.type || gun.category || 'Hardware'}
                      {gun.caliber ? ` · ${gun.caliber}` : ''}
                    </span>
                    {gun.description && (
                      <span className="card-desc">{truncate(gun.description, 64)}</span>
                    )}
                    <span className="price">{formatPrice(gun.price ?? gun.cook_time ?? 0)}</span>
                  </button>

                  <div
                    className="archive-card-footer"
                    style={{
                      display: 'flex',
                      gap: '8px',
                      padding: '10px 14px',
                      borderTop: '1px solid var(--line)',
                      background: 'var(--paper)',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      style={{ flex: 1 }}
                      onClick={() => handleRestore(gun)}
                      title="Restore to active catalog"
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeleteTarget(gun)}
                      title="Delete permanently"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Permanently Delete Record?"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}" from the archive and database? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        danger
        loading={deleting}
        onConfirm={handlePermanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
