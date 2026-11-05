import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { buildShareUrl } from '../../utils/helpers'

/**
 * ShareButton — Generates an authentic deep-link (`?gun=<id>`) for a catalog
 * item and triggers Web Share API or copies the link to the clipboard.
 */
export default function ShareButton({ gun, variant = 'icon', onShared }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async (e) => {
    e.stopPropagation()
    const gunId = gun?.id ?? gun?.name
    const shareUrl = buildShareUrl(gunId)
    const shareData = {
      title: `${gun?.name || 'Hardware'} — Bore & Barrel`,
      text: `Check out ${gun?.name || 'this item'} (${gun?.type || 'Hardware'} · ${gun?.caliber || 'Standard'}) on Bore & Barrel Armory:`,
      url: shareUrl,
    }

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
        if (onShared) onShared(shareUrl, 'shared')
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = shareUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopied(true)
    if (onShared) onShared(shareUrl, 'copied')
    setTimeout(() => setCopied(false), 2200)
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className="btn btn--outline btn--sm"
        onClick={handleShare}
        title="Share authentic catalog link"
      >
        {copied ? (
          <>
            <Check size={15} color="var(--brass)" /> Link Copied!
          </>
        ) : (
          <>
            <Share2 size={15} /> Share Link
          </>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="card-act-btn"
      onClick={handleShare}
      aria-label={`Share link for ${gun?.name}`}
      title={copied ? 'Link copied!' : 'Share authentic link'}
    >
      {copied ? (
        <Check size={15} color="var(--brass)" />
      ) : (
        <Share2 size={15} stroke="var(--ink)" />
      )}
    </button>
  )
}
