import { Archive, Images } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import LazyImage from '../common/LazyImage'
import { formatPrice, truncate } from '../../utils/helpers'

export default function GunCard({
  gun,
  onSelect,
  onEdit,
  onDelete,
  onArchive,
  onShared,
}) {
  const images =
    Array.isArray(gun.images) && gun.images.length > 0
      ? gun.images
      : [gun.image_url || gun.image || '/guns/pistol.svg']
  const imgSrc = images[0]
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  return (
    <li className="card">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <div className="card-img-container" style={{ position: 'relative', width: '100%' }}>
          <LazyImage
            className="card-img"
            src={imgSrc}
            alt={gun.name}
            width="240"
            height="180"
          />
          {images.length > 1 && (
            <span className="multi-img-badge" title={`${images.length} photos`}>
              <Images size={12} /> {images.length}
            </span>
          )}
        </div>
        <span className="name display">{gun.name}</span>
        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>
        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}
        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
        <ShareButton gun={gun} onShared={onShared} />
        <FavoriteButton gunId={gun.id || gun.name} />
        {onArchive && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => {
              e.stopPropagation()
              onArchive(gun)
            }}
            aria-label={`Archive ${gun.name}`}
            title="Move to Archive"
          >
            <Archive size={15} />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(gun)
            }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(gun)
            }}
            aria-label={`Delete ${gun.name}`}
            title="Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
