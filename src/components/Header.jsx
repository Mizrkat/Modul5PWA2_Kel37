import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { useFavorites } from '../hooks/useFavorites'
import archiveService from '../services/archiveService'

const NAV_ITEMS = [
  { id: 'Catalog', label: 'Catalog' },
  { id: 'Favorites', label: 'Favorites', badgeType: 'favorites' },
  { id: 'Archive', label: 'Archive', badgeType: 'archive' },
  { id: 'Profile', label: 'Profile' },
]

function Header({ tab, onTab, onNavigateCreate }) {
  const { favorites } = useFavorites()
  const favCount = favorites ? favorites.length : 0
  const [archiveCount, setArchiveCount] = useState(() =>
    archiveService.getArchivedCount(),
  )

  useEffect(() => {
    const syncArchiveCount = () => {
      setArchiveCount(archiveService.getArchivedCount())
    }
    window.addEventListener('archive-updated', syncArchiveCount)
    return () => window.removeEventListener('archive-updated', syncArchiveCount)
  }, [])

  return (
    <header className="header">
      <div
        className="header-brand-wrap"
        onClick={() => onTab('Catalog')}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <div className="header-logo-badge">
          <img src="/logo.png" alt="Bore & Barrel" loading="lazy" />
        </div>
        <span className="brand display">Bore &amp; Barrel</span>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => {
          const badgeVal =
            item.badgeType === 'favorites'
              ? favCount
              : item.badgeType === 'archive'
              ? archiveCount
              : 0
          return (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'nav-link active' : 'nav-link'}
              onClick={() => onTab(item.id)}
            >
              {item.label}
              {badgeVal > 0 && <span className="nav-badge">{badgeVal}</span>}
            </button>
          )
        })}
      </nav>

      {onNavigateCreate && (
        <button
          type="button"
          className="btn btn--primary btn--sm header-cta"
          onClick={onNavigateCreate}
          title="Register new hardware"
        >
          <Plus size={15} /> Add Hardware
        </button>
      )}
    </header>
  )
}

export default Header
