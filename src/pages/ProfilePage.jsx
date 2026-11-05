import { useState, useEffect } from 'react'
import {
  Shield,
  Copy,
  Check,
  Save,
  Heart,
  FileText,
  Camera,
  Play,
  Edit3,
  Trash2,
  ArrowRight,
  Archive,
  MapPin,
  Phone,
  Clock,
  Info,
  X,
} from 'lucide-react'
import userService from '../services/userService'
import { useFavorites } from '../hooks/useFavorites'
import {
  getAllDrafts,
  deleteDraft,
  formatDraftTime,
} from '../utils/draftStorage'
import archiveService from '../services/archiveService'
import { formatPrice } from '../utils/helpers'

export default function ProfilePage({
  onReplaySplash,
  onResumeDraft,
  onNavigateArchive,
}) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [isEditingProfile, setIsEditingProfile] = useState(false)

  // Edit profile state (inside dedicated modal / sub-page)
  const [username, setUsername] = useState(profile.username || 'Shooter')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatar, setAvatar] = useState(profile.avatar || null)

  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')
  const { favorites } = useFavorites()

  const [drafts, setDrafts] = useState(() => getAllDrafts())
  const [archivedCount, setArchivedCount] = useState(() =>
    archiveService.getArchivedCount(),
  )

  useEffect(() => {
    const syncDrafts = () => setDrafts(getAllDrafts())
    const syncArchive = () => setArchivedCount(archiveService.getArchivedCount())
    window.addEventListener('drafts-updated', syncDrafts)
    window.addEventListener('archive-updated', syncArchive)
    return () => {
      window.removeEventListener('drafts-updated', syncDrafts)
      window.removeEventListener('archive-updated', syncArchive)
    }
  }, [])

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenEditModal = () => {
    setUsername(profile.username || 'Shooter')
    setBio(profile.bio || '')
    setAvatar(profile.avatar || null)
    setIsEditingProfile(true)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setFeedback('Avatar image must be under 2MB.')
      setTimeout(() => setFeedback(''), 3000)
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatar(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = (e) => {
    e.preventDefault()
    const updated = {
      ...profile,
      username: username.trim() || 'Shooter',
      bio: bio.trim(),
      avatar,
    }
    const result = userService.saveUserProfile(updated)
    if (result.success) {
      setProfile(result.data)
      setIsEditingProfile(false)
      setFeedback('Profile successfully updated.')
      setTimeout(() => setFeedback(''), 3000)
    } else {
      setFeedback('Failed to save profile.')
    }
  }

  const handleDeleteDraftItem = (draftId) => {
    deleteDraft(draftId)
    setDrafts(getAllDrafts())
    setFeedback('Draft removed.')
    setTimeout(() => setFeedback(''), 2500)
  }

  return (
    <div className="profile-page">
      <section
        className="masthead"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">
            Operator credentials, saved catalog drafts, armory info, and station
            contact.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleOpenEditModal}
          >
            <Edit3 size={14} /> Edit Profile
          </button>
          {onReplaySplash && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onReplaySplash}
              title="Replay introductory splash animation"
            >
              <Play size={14} /> Replay Intro
            </button>
          )}
        </div>
      </section>

      {feedback && (
        <div className="toast toast--success">
          <Check size={18} /> {feedback}
        </div>
      )}

      {/* Operator Card */}
      <div className="profile-card">
        <div className="profile-card-top" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="avatar-wrap">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  className="avatar-img"
                />
              ) : (
                <div className="avatar-placeholder">
                  <Shield size={36} stroke="var(--brass)" />
                </div>
              )}
            </div>

            <div className="profile-identity">
              <h2 className="display">{profile.username || 'Shooter'}</h2>
              <div className="profile-id-row">
                <span className="mono-badge">{profile.userId}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleCopyId}
                  title="Copy User ID to clipboard"
                >
                  {copied ? (
                    <Check size={14} color="var(--brass)" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
              {profile.bio && (
                <p className="lede" style={{ marginTop: '8px', fontSize: '0.92rem' }}>
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={handleOpenEditModal}
          >
            <Edit3 size={14} /> Edit Profile
          </button>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Procurement Favorites</div>
          </div>

          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{drafts.length}</div>
            <div className="stat-label">Saved Catalog Drafts</div>
          </div>

          <div
            className="stat-item"
            style={{ cursor: onNavigateArchive ? 'pointer' : 'default' }}
            onClick={onNavigateArchive}
          >
            <Archive size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{archivedCount}</div>
            <div className="stat-label">Archived Catalog Items</div>
          </div>
        </div>
      </div>

      {/* SECTION: Drafts List */}
      <section className="card-box" id="profile-drafts-section">
        <div className="fieldset-header" style={{ marginBottom: '14px' }}>
          <div>
            <h3 className="section-title">Saved Catalog Drafts</h3>
            <p className="card-box-desc" style={{ margin: '4px 0 0' }}>
              Unfinished hardware registrations and edits saved in local storage.
            </p>
          </div>
          <span className="mono-badge">{drafts.length} Draft(s)</span>
        </div>

        {drafts.length === 0 ? (
          <div className="state-box" style={{ padding: '28px 16px', margin: 0 }}>
            <FileText size={28} stroke="var(--steel)" />
            <p>No saved catalog drafts at the moment.</p>
          </div>
        ) : (
          <ul className="draft-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {drafts.map((d) => (
              <li
                key={d.draftId}
                className="draft-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '12px 16px',
                  border: '1px solid var(--line)',
                  borderRadius: '4px',
                  background: 'var(--paper)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={d.image}
                    alt={d.name}
                    className="thumb-small"
                    loading="lazy"
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong className="display" style={{ fontSize: '1.05rem' }}>
                        {d.name}
                      </strong>
                      <span className="mono-badge" style={{ fontSize: '0.72rem' }}>
                        {d.isCreate ? 'New Draft' : `Edit #${d.draftId}`}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--steel)' }}>
                      {d.type} · {d.caliber} · {formatPrice(d.price)} ·{' '}
                      {d.imagesCount} photo(s) · Saved {formatDraftTime(d.savedAt)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {onResumeDraft && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => onResumeDraft(d)}
                    >
                      Resume <ArrowRight size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--danger-ghost btn--sm"
                    onClick={() => handleDeleteDraftItem(d.draftId)}
                    title="Delete draft"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SECTION: About & Contact (Moved from Navbar into Profile Page) */}
      <div className="form-grid">
        <section className="card-box" id="profile-about-section" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Info size={18} stroke="var(--brass)" />
            <h3 className="section-title">About — A One-Room Armory</h3>
          </div>
          <p className="lede" style={{ fontSize: '0.95rem' }}>
            Bore &amp; Barrel sells a short, honest list of firearms. Each piece is
            priced from the bench — no markup theatre, no filler. Built as a
            Progressive Web App with offline caching and real-time catalog sync.
          </p>
        </section>

        <section className="card-box" id="profile-contact-section" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <MapPin size={18} stroke="var(--brass)" />
            <h3 className="section-title">Contact — Come by the Shop</h3>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--steel)', fontSize: '0.93rem' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={15} /> 123 Range Road, Gunshop Asli Ngawi
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} /> Open Tuesday to Saturday, 10:00 to 18:00
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={15} /> Call (555) 010-0100
            </li>
          </ul>
        </section>
      </div>

      {/* POP-UP MODAL / PAGE FOR EDIT PROFILE */}
      {isEditingProfile && (
        <div
          className="modal-backdrop"
          onClick={() => setIsEditingProfile(false)}
        >
          <div
            className="modal-box"
            style={{ maxWidth: '500px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="edit-profile-title" className="modal-title display">
                Edit Operator Profile
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsEditingProfile(false)}
                aria-label="Close edit profile"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="avatar-wrap">
                  {avatar ? (
                    <img src={avatar} alt={username} className="avatar-img" />
                  ) : (
                    <div className="avatar-placeholder">
                      <Shield size={36} stroke="var(--brass)" />
                    </div>
                  )}
                  <label
                    htmlFor="modal-avatar-input"
                    className="avatar-upload-btn"
                    title="Upload new avatar"
                  >
                    <Camera size={14} />
                    <input
                      id="modal-avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden-file-input"
                    />
                  </label>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--steel)' }}>
                  Click the camera icon to upload a new operator avatar (max 2MB).
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="prof-name" className="form-label">
                  Callsign / Operator Alias
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Operator Delta, Master Gunsmith"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="prof-bio" className="form-label">
                  Armory Notes / Station Bio
                </label>
                <textarea
                  id="prof-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Qualifications, preferred calibers, unit assignment..."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setIsEditingProfile(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  <Save size={16} /> Save Armorer Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
