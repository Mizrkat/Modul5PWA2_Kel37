export const formatPrice = (price) => {
  const num = Number(price)
  if (Number.isNaN(num)) return '$0'
  return `$${num.toLocaleString()}`
}

export const matchesSearch = (item, query) => {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    (item.name || '').toLowerCase().includes(q) ||
    (item.description || '').toLowerCase().includes(q) ||
    (item.caliber || '').toLowerCase().includes(q)
  )
}

export const matchesCategory = (item, category) => {
  if (!category || category === 'All') return true
  return (
    (item.type || '').toLowerCase() === category.toLowerCase() ||
    (item.category || '').toLowerCase() === category.toLowerCase()
  )
}

export const sortItems = (items, key = 'name', order = 'asc') => {
  const sorted = [...items].sort((a, b) => {
    if (key === 'price') return (Number(a.price) || 0) - (Number(b.price) || 0)
    return String(a[key] || '').localeCompare(String(b[key] || ''))
  })
  return order === 'desc' ? sorted.reverse() : sorted
}

export const truncate = (str, max = 100) => {
  if (!str || str.length <= max) return str || ''
  return str.slice(0, max).trimEnd() + '…'
}

export const extractCategories = (items) => {
  const set = new Set()
  items.forEach((i) => {
    const cat = i.type || i.category
    if (cat) set.add(cat)
  })
  return ['All', ...Array.from(set).sort()]
}

export const averageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0
  const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

/**
 * Build an authentic, shareable deep link for a specific catalog item.
 * Follows the Modul 5 Responsi pattern (`?gun=<id>`).
 */
export const buildShareUrl = (gunId) => {
  if (typeof window === 'undefined') return `?gun=${encodeURIComponent(gunId)}`
  const url = new URL(window.location.href)
  url.searchParams.set('gun', String(gunId))
  return url.toString()
}
