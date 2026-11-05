import { useState, useEffect } from 'react'
import { Download, WifiOff, X, RefreshCw, CheckCircle2 } from 'lucide-react'
import outboxService from '../services/outboxService'

export default function PWABadge() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [pendingCount, setPendingCount] = useState(() =>
    outboxService.getPendingCount(),
  )
  const [syncNotice, setSyncNotice] = useState('')

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const handleAppInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    const handleOnline = () => {
      setIsOffline(false)
      outboxService.processQueue()
    }
    const handleOffline = () => setIsOffline(true)
    const handleOutboxUpdate = () =>
      setPendingCount(outboxService.getPendingCount())
    const handleOutboxSynced = (e) => {
      setPendingCount(outboxService.getPendingCount())
      const count = e.detail?.count || 0
      if (count > 0) {
        setSyncNotice(`Synced ${count} offline mutation(s) to database.`)
        setTimeout(() => setSyncNotice(''), 4500)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('outbox-updated', handleOutboxUpdate)
    window.addEventListener('outbox-synced', handleOutboxSynced)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('outbox-updated', handleOutboxUpdate)
      window.removeEventListener('outbox-synced', handleOutboxSynced)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    setInstallPrompt(null)
  }

  if (dismissed) return null

  if (syncNotice) {
    return (
      <aside className="pwa-badge" style={{ background: '#1e8449' }} role="status">
        <div className="pwa-badge-content">
          <CheckCircle2 size={16} color="#fff" />
          <span>{syncNotice}</span>
        </div>
      </aside>
    )
  }

  if (isOffline) {
    return (
      <aside className="pwa-badge pwa-badge--offline" role="status" aria-live="polite">
        <WifiOff size={16} />
        <span>
          Working offline. Cached data active.
          {pendingCount > 0 && ` (${pendingCount} queued for sync)`}
        </span>
      </aside>
    )
  }

  if (installPrompt && !installed) {
    return (
      <aside className="pwa-badge" role="region" aria-label="Install App">
        <div className="pwa-badge-content">
          <Download size={16} stroke="var(--brass)" />
          <span>
            Install <strong>Bore &amp; Barrel</strong> for offline access.
          </span>
        </div>
        <div className="pwa-badge-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleInstallClick}
          >
            Install App
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </aside>
    )
  }

  return null
}
