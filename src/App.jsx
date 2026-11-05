import { useState, useEffect, lazy, Suspense } from 'react'
import { Loader } from 'lucide-react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import PWABadge from './components/PWABadge.jsx'
import ConfirmModal from './components/modals/ConfirmModal.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import gunService from './services/gunService.js'
import archiveService from './services/archiveService.js'
import GUNS_LOCAL from './data/guns.js'
import './App.css'

// Lazy-loaded page & detail components (deferred until needed)
const Catalog = lazy(() => import('./pages/Catalog.jsx'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage.jsx'))
const ArchivePage = lazy(() => import('./pages/ArchivePage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const CreateGunPage = lazy(() => import('./pages/CreateGunPage.jsx'))
const EditGunPage = lazy(() => import('./pages/EditGunPage.jsx'))
const GunDetail = lazy(() => import('./components/gun/GunDetail.jsx'))

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [tab, setTab] = useState('Catalog')
  const [mode, setMode] = useState('list') // 'list' | 'create' | 'edit' | 'detail'
  const [selectedGun, setSelectedGun] = useState(null)
  const [editingGun, setEditingGun] = useState(null)
  const [activeDraftId, setActiveDraftId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Resolve authentic share link (`?gun=<id>`) on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sharedGunId = params.get('gun') || params.get('id')
    if (!sharedGunId) return

    // Skip splash when opening a shared product link directly
    setShowSplash(false)

    const loadSharedGun = async () => {
      try {
        if (!String(sharedGunId).startsWith('local-')) {
          const res = await gunService.getGunById(sharedGunId)
          if (res.success && res.data) {
            setSelectedGun(res.data)
            setMode('detail')
            return
          }
        }
      } catch {
        // Fallback to local catalog lookup
      }

      const localList = GUNS_LOCAL.map((g, i) => ({
        ...g,
        id: g.id || `local-${i}`,
      }))
      const found = localList.find(
        (g) =>
          String(g.id) === String(sharedGunId) ||
          String(g.name) === String(sharedGunId),
      )
      if (found) {
        setSelectedGun(found)
        setMode('detail')
      }
    }

    loadSharedGun()
  }, [])

  // Sync URL query parameter when viewing product detail
  const updateUrlParam = (gunId) => {
    try {
      const url = new URL(window.location.href)
      if (gunId) {
        url.searchParams.set('gun', String(gunId))
      } else {
        url.searchParams.delete('gun')
        url.searchParams.delete('id')
      }
      window.history.replaceState({}, '', url.toString())
    } catch {
      // Ignore in restricted environments
    }
  }

  const handleNavigate = (target, payload) => {
    if (target === 'Create') {
      setActiveDraftId(payload?.draftId || null)
      setMode('create')
      updateUrlParam(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Edit') {
      setEditingGun(payload)
      setMode('edit')
      updateUrlParam(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Detail') {
      setSelectedGun(payload)
      setMode('detail')
      updateUrlParam(payload?.id || payload?.name)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setTab(target)
      setMode('list')
      setSelectedGun(null)
      setEditingGun(null)
      setActiveDraftId(null)
      updateUrlParam(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBackToList = () => {
    setMode('list')
    setSelectedGun(null)
    setEditingGun(null)
    setActiveDraftId(null)
    updateUrlParam(null)
  }

  const handleResumeDraft = (draftItem) => {
    if (draftItem.isCreate) {
      handleNavigate('Create', { draftId: draftItem.draftId })
    } else {
      handleNavigate('Edit', { id: draftItem.draftId, ...draftItem.raw?.formData })
    }
  }

  return (
    <div className="shell">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <Header
        tab={mode === 'list' ? tab : ''}
        onTab={(newTab) => handleNavigate(newTab)}
        onNavigateCreate={() => handleNavigate('Create')}
      />

      <main className="main">
        <Suspense
          fallback={
            <div className="state-box">
              <Loader size={28} className="spin" />
              <p>Loading module…</p>
            </div>
          }
        >
          {mode === 'create' && (
            <CreateGunPage
              initialDraftId={activeDraftId}
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'edit' && (
            <EditGunPage
              gun={editingGun}
              gunId={editingGun?.id}
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'detail' && selectedGun && (
            <GunDetail
              gun={selectedGun}
              onBack={handleBackToList}
              onEdit={(g) => handleNavigate('Edit', g)}
              onDelete={(g) => setDeleteTarget(g)}
            />
          )}

          {mode === 'list' && (
            <>
              {tab === 'Catalog' && (
                <Catalog
                  onNavigate={(destination, payload) =>
                    handleNavigate(destination, payload)
                  }
                />
              )}
              {tab === 'Favorites' && (
                <FavoritesPage
                  onSelectGun={(g) => handleNavigate('Detail', g)}
                  onNavigateCatalog={() => setTab('Catalog')}
                />
              )}
              {tab === 'Archive' && (
                <ArchivePage
                  onSelectGun={(g) => handleNavigate('Detail', g)}
                  onNavigateCatalog={() => setTab('Catalog')}
                />
              )}
              {tab === 'Profile' && (
                <ProfilePage
                  onReplaySplash={() => setShowSplash(true)}
                  onResumeDraft={handleResumeDraft}
                  onNavigateArchive={() => setTab('Archive')}
                />
              )}
            </>
          )}
        </Suspense>
      </main>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Hardware Record"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? It will be moved to Archive where it can be restored or permanently deleted.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={() => {
          if (!deleteTarget) return
          try {
            setDeleting(true)
            archiveService.archiveGun(deleteTarget)
            setDeleteTarget(null)
            handleBackToList()
            setTab('Archive')
          } catch (err) {
            console.error(err)
          } finally {
            setDeleting(false)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <PWABadge />
      <Footer />
    </div>
  )
}

export default App
