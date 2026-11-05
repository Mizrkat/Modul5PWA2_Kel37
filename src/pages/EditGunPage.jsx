import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

export default function EditGunPage({ gun, gunId, onBack, onSuccess }) {
  const targetId = gunId || gun?.id

  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan',
    difficulty: 'mudah',
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  // Multi-image list
  const [images, setImages] = useState([])
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploading, setUploading] = useState(false)

  const [specs, setSpecs] = useState([{ name: '', quantity: '' }])
  const [steps, setSteps] = useState([''])

  const [showDraftModal, setShowDraftModal] = useState(() =>
    targetId ? hasDraft(targetId) : false,
  )
  const [draftTimestamp, setDraftTimestamp] = useState(() =>
    targetId ? getDraftTimestamp(targetId) : null,
  )

  useEffect(() => {
    const fetchGun = async () => {
      try {
        setLoading(true)
        setError('')
        let data = gun
        if (!data || !data.ingredients || !data.steps) {
          if (targetId && !String(targetId).startsWith('local-')) {
            const res = await gunService.getGunById(targetId)
            if (res.success && res.data) {
              data = res.data
            }
          }
        }
        if (data) {
          setFormData({
            name: data.name || '',
            type: data.type || (data.category === 'makanan' ? 'Pistol' : 'Rifle'),
            caliber: data.caliber || '9mm',
            category: data.category || 'makanan',
            difficulty: data.difficulty || 'mudah',
            price: data.price ?? data.cook_time ?? 599,
            description: data.description || '',
            servings: data.servings || 1,
            is_featured: Boolean(data.is_featured),
          })
          const initialImgs =
            Array.isArray(data.images) && data.images.length > 0
              ? data.images
              : [data.image_url || data.image || '/guns/pistol.svg']
          setImages(initialImgs)

          if (data.ingredients && data.ingredients.length > 0) {
            setSpecs(
              data.ingredients.map((ing) => ({
                name: ing.name || '',
                quantity: ing.quantity || '',
              })),
            )
          } else {
            setSpecs([
              { name: 'Platform', quantity: data.type || 'Pistol' },
              { name: 'Caliber', quantity: data.caliber || '9mm' },
            ])
          }

          if (data.steps && data.steps.length > 0) {
            setSteps(
              data.steps.map((st) =>
                typeof st === 'string' ? st : st.instruction || '',
              ),
            )
          } else {
            setSteps(['Standard manufacturer maintenance and cleaning protocol.'])
          }
        } else {
          setError('Hardware record could not be loaded.')
        }
      } catch (err) {
        setError(err.message || 'Failed to load hardware record from server.')
      } finally {
        setLoading(false)
      }
    }

    if (targetId) fetchGun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  const handleLoadDraft = () => {
    const draft = loadDraft(targetId)
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (Array.isArray(draft.uploadedImages) && draft.uploadedImages.length > 0) {
        setImages(draft.uploadedImages)
      }
      setShowDraftModal(false)
      setSuccessMsg('Saved draft restored.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft(targetId)
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  const handleManualSaveDraft = () => {
    const draftData = {
      formData,
      specs,
      steps,
      uploadedImages: images,
      imagePreview: images[0],
    }
    const saved = saveDraft(draftData, targetId)
    if (saved) {
      const ts = getDraftTimestamp(targetId)
      setDraftTimestamp(ts)
      setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const valid = []
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`"${file.name}" exceeds 5MB limit.`)
        continue
      }
      if (!allowed.includes(file.type)) {
        setError(`"${file.name}" has an unsupported format.`)
        continue
      }
      valid.push(file)
    }
    if (valid.length > 0) {
      setPendingFiles((prev) => [...prev, ...valid])
      setImages((prev) => [
        ...prev,
        ...valid.map((f) => URL.createObjectURL(f)),
      ])
      setError('')
    }
  }

  const handleUploadPendingImages = async () => {
    if (pendingFiles.length === 0) return
    try {
      setUploading(true)
      const res = await uploadService.uploadMultipleImages(pendingFiles)
      if (res.success && res.data.length > 0) {
        const uploadedUrls = res.data.map((d) => d.url)
        setImages((prev) => {
          const nonBlob = prev.filter((u) => !u.startsWith('blob:'))
          return [...nonBlob, ...uploadedUrls]
        })
        setPendingFiles([])
        setSuccessMsg('Images uploaded to storage.')
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    } catch (err) {
      console.warn('Multi-upload fallback to local preview:', err)
      setPendingFiles([])
    } finally {
      setUploading(false)
    }
  }

  const removeImageAt = (index) => {
    if (images.length <= 1) return
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }
  const addSpec = () => setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }
  const addStep = () => setSteps((prev) => [...prev, ''])
  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))

    const cleanSteps = steps.filter((s) => s.trim()).map((s) => s.trim())

    const finalImages = images.length > 0 ? images : ['/guns/pistol.svg']

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      caliber: formData.caliber || '9mm',
      price: Number(formData.price) || 500,
      category: formData.category || 'makanan',
      description: formData.description.trim(),
      image_url: finalImages[0],
      images: finalImages,
      prep_time: 15,
      cook_time: Number(formData.price) || 500,
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setUpdating(true)
      const res = await gunService.updateGun(targetId, payload)
      if (res.success || res.data) {
        deleteDraft(targetId)
        if (onSuccess) onSuccess(res.data)
        else if (onBack) onBack()
      } else {
        throw new Error(res.message || 'Failed to update record on server.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while updating record.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="state-box">
        <Loader size={32} className="spin" />
        <p>Loading hardware details for editing…</p>
      </div>
    )
  }

  return (
    <div className="form-page">
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={handleManualSaveDraft}
        >
          <Save size={14} /> Save Draft
        </button>
      </div>

      <div className="form-title-group">
        <h1 className="display">Modify Hardware Record</h1>
        <p className="lede">
          Updating record ID: <code className="mono-badge">{targetId}</code>
        </p>
      </div>

      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="entry-form">
        {/* Multi-Imagery Section */}
        <div className="card-box">
          <h2 className="card-box-title">Visual Assets ({images.length})</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '12px',
              marginBottom: '14px',
            }}
          >
            {images.map((imgUrl, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  height: '100px',
                  border: '1px solid var(--line)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={imgUrl}
                  alt={`Asset ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {images.length > 1 && (
                  <button
                    type="button"
                    className="preview-remove-btn"
                    onClick={() => removeImageAt(idx)}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="edit-img-controls" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <input
              id="edit-gun-images"
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden-file-input"
            />
            <label htmlFor="edit-gun-images" className="btn btn--outline btn--sm">
              <Upload size={14} /> Add More Images
            </label>
            {pendingFiles.length > 0 && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleUploadPendingImages}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader size={14} className="spin" /> Uploading…
                  </>
                ) : (
                  `Upload ${pendingFiles.length} New File(s)`
                )}
              </button>
            )}
          </div>
        </div>

        {/* Core fields */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">
              Model Designation <span className="req">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((p) => ({ ...p, name: e.target.value }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-type" className="form-label">
              Platform / Category <span className="req">*</span>
            </label>
            <select
              id="edit-type"
              value={formData.type}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  type: e.target.value,
                  category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                }))
              }
              className="form-select"
            >
              <option value="Pistol">Pistol (Sidearm)</option>
              <option value="Rifle">Rifle (Long Gun)</option>
              <option value="Shotgun">Shotgun (Smoothbore)</option>
              <option value="Submachine Gun">Submachine Gun</option>
            </select>
          </div>
        </div>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label htmlFor="edit-caliber" className="form-label">
              Caliber <span className="req">*</span>
            </label>
            <input
              id="edit-caliber"
              type="text"
              value={formData.caliber}
              onChange={(e) =>
                setFormData((p) => ({ ...p, caliber: e.target.value }))
              }
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-price" className="form-label">
              Price (USD) <span className="req">*</span>
            </label>
            <input
              id="edit-price"
              type="number"
              value={formData.price}
              onChange={(e) =>
                setFormData((p) => ({ ...p, price: e.target.value }))
              }
              className="form-input"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-difficulty" className="form-label">
              Grade <span className="req">*</span>
            </label>
            <select
              id="edit-difficulty"
              value={formData.difficulty}
              onChange={(e) =>
                setFormData((p) => ({ ...p, difficulty: e.target.value }))
              }
              className="form-select"
            >
              <option value="mudah">Commercial / Standard</option>
              <option value="sedang">Mil-Spec / Service Issue</option>
              <option value="sulit">Match Grade / Custom</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-desc" className="form-label">
            Armory Description
          </label>
          <textarea
            id="edit-desc"
            value={formData.description}
            onChange={(e) =>
              setFormData((p) => ({ ...p, description: e.target.value }))
            }
            rows={3}
            className="form-textarea"
          />
        </div>

        {/* Specs */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Specifications &amp; Components</label>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={addSpec}
            >
              <Plus size={14} /> Add Spec
            </button>
          </div>
          <div className="multi-rows">
            {specs.map((spec, i) => (
              <div key={i} className="multi-row">
                <input
                  type="text"
                  value={spec.name}
                  onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                  className="form-input"
                />
                <input
                  type="text"
                  value={spec.quantity}
                  onChange={(e) =>
                    handleSpecChange(i, 'quantity', e.target.value)
                  }
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeSpec(i)}
                  disabled={specs.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Assembly &amp; Maintenance Protocol</label>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={addStep}
            >
              <Plus size={14} /> Add Step
            </button>
          </div>
          <div className="multi-rows">
            {steps.map((st, i) => (
              <div key={i} className="step-row">
                <span className="step-num">{i + 1}</span>
                <input
                  type="text"
                  value={st}
                  onChange={(e) => handleStepChange(i, e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeStep(i)}
                  disabled={steps.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions-bar">
          <button
            type="button"
            className="btn btn--outline"
            onClick={onBack}
            disabled={updating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={updating}
          >
            {updating ? (
              <>
                <Loader size={18} className="spin" /> Updating Record…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={showDraftModal}
        title="Resume Unsaved Changes?"
        message={`An unsaved draft for this product was saved on ${
          draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'
        }. Would you like to restore it?`}
        confirmLabel="Restore Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
