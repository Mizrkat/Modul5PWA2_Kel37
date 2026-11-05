import { Heart } from 'lucide-react'
import { useIsFavorited } from '../../hooks/useFavorites'

export default function FavoriteButton({ gunId, onToggle }) {
  const { isFavorited, loading, toggleFavorite } = useIsFavorited(gunId)

  const handleClick = async (e) => {
    e.stopPropagation()
    const result = await toggleFavorite()
    if (result && onToggle) onToggle(result)
  }

  return (
    <button
      type="button"
      className={`fav-btn${isFavorited ? ' fav-btn--active' : ''}`}
      onClick={handleClick}
      disabled={loading}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        size={18}
        fill={isFavorited ? 'var(--brass)' : 'none'}
        stroke={isFavorited ? 'var(--brass)' : 'var(--steel)'}
      />
    </button>
  )
}
