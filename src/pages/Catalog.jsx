import { useState, useMemo, useEffect } from 'react'
import {
  RefreshCw,
  Plus,
  Loader,
  AlertCircle,
  PackageOpen,
  Database,
} from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import archiveService from '../services/archiveService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

export default function Catalog({ onNavigate }) {
  const { guns: apiGuns, loading, error, cacheInfo, refetch } = useGuns({
    limit: 50,
  })
  const [useLocal, setUseLocal] = useState(false)
  const [archiveVersion, setArchiveVersion] = useState(0)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    const onArchiveChange = () => setArchiveVersion((v) => v + 1)
    window.addEventListener('archive-updated', onArchiveChange)
    return () => window.removeEventListener('archive-updated', onArchiveChange)
  }, [])

  // Decide data source & filter out archived items
  const rawGuns = useMemo(() => {
    const source =
      useLocal || (error && apiGuns.length === 0)
        ? GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
        : apiGuns

    return source.filter((g) => !archiveService.isArchived(g.id || g.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiGuns, error, useLocal, archiveVersion])

  // Filters / sort
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  const categories = useMemo(() => extractCategories(rawGuns), [rawGuns])

  const filteredGuns = useMemo(() => {
    const result = rawGuns.filter(
      (g) => matchesSearch(g, search) && matchesCategory(g, activeCategory),
    )
    return sortItems(result, sortKey, sortOrder)
  }, [rawGuns, search, activeCategory, sortKey, sortOrder])

  const [selectedGun, setSelectedGun] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      archiveService.archiveGun(deleteTarget)
      setToastMsg(`"${deleteTarget.name}" deleted and moved to Archive.`)
      setDeleteTarget(null)
      setSelectedGun(null)
      setArchiveVersion((v) => v + 1)
      setTimeout(() => setToastMsg(''), 3000)
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => {
          setSelectedGun(null)
          setDeleteTarget(g)
        }}
      />
    )
  }

  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      {toastMsg && <div className="toast toast--success">{toastMsg}</div>}

      <section>
        <div className="list-head" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2>Current stock</h2>
            {cacheInfo?.fromCache && (
              <span
                className="mono-badge"
                title="Data served from API Query Cache & Image Disk Cache"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Database size={12} color="var(--brass)" /> Cached (
                {cacheInfo.source})
              </span>
            )}
          </div>
          <div className="list-head-right">
            <span className="count">
              {filteredGuns.length} piece{filteredGuns.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={refetch}
              title="Force refresh API & update query cache"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        <AdvancedFilter
          search={search}
          onSearch={setSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={setActiveCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={({ key, order }) => {
            setSortKey(key)
            setSortOrder(order)
          }}
        />

        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && filteredGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {filteredGuns.length > 0 && (
          <ul className="stock">
            {filteredGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={(g) =>
                  onNavigate ? onNavigate('Detail', g) : setSelectedGun(g)
                }
                onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={setDeleteTarget}
                onShared={(url) => {
                  setToastMsg(`Share link copied: ${url}`)
                  setTimeout(() => setToastMsg(''), 3000)
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Item"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? It will be moved to Archive where it can be restored or permanently deleted.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError('')
        }}
      />

      {deleteError && <div className="toast toast--error">{deleteError}</div>}
    </>
  )
}
