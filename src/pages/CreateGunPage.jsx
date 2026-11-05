import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
  Images,
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

export default function CreateGunPage({ onBack, onSuccess, initialDraftId }) {
  const [currentStep, setCurrentStep] = useState('upload')
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

  // Multi-image states
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [uploadedImages, setUploadedImages] = useState([])

  const [specs, setSpecs] = useState([
    { name: 'Frame', quantity: 'Polymer' },
    { name: 'Action', quantity: 'Striker-Fired' },
    { name: 'Capacity', quantity: '17 rounds' },
  ])

  const [steps, setSteps] = useState([
    'Verify firearm is completely unloaded and point in safe direction.',
    'Disassemble slide assembly from receiver frame for routine maintenance.',
  ])

  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showDraftModal, setShowDraftModal] = useState(
    () => !initialDraftId && hasDraft('create'),
  )
  const [draftTimestamp, setDraftTimestamp] = useState(() =>
    getDraftTimestamp('create'),
  )

  const applyDraftObject = useCallback((draft) => {
    if (!draft) return
    if (draft.formData) setFormData(draft.formData)
    if (draft.specs) setSpecs(draft.specs)
    if (draft.steps) setSteps(draft.steps)
    const imgs =
      Array.isArray(draft.uploadedImages) && draft.uploadedImages.length > 0
        ? draft.uploadedImages
        : draft.uploadedImageUrl
        ? [draft.uploadedImageUrl]
        : []
    if (imgs.length > 0) {
      setUploadedImages(imgs)
      setImagePreviews(imgs)
      setCurrentStep('form')
    }
  }, [])

  useEffect(() => {
    if (initialDraftId) {
      const draft = loadDraft(initialDraftId)
      if (draft) {
        applyDraftObject(draft)
        setSuccessMsg('Draft loaded from Profile.')
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    }
  }, [initialDraftId, applyDraftObject])

  const handleSaveDraft = useCallback(
    (notify = true) => {
      const activeImages =
        uploadedImages.length > 0 ? uploadedImages : imagePreviews
      const draftData = {
        formData,
        specs,
        steps,
        uploadedImages: activeImages,
        uploadedImageUrl: activeImages[0] || '',
      }
      const saved = saveDraft(draftData, 'create')
      if (saved) {
        const ts = getDraftTimestamp('create')
        setDraftTimestamp(ts)
        if (notify) {
          setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
          setTimeout(() => setSuccessMsg(''), 3000)
        }
      }
    },
    [formData, specs, steps, uploadedImages, imagePreviews],
  )

  useEffect(() => {
    if (currentStep !== 'form') return
    const interval = setInterval(() => {
      handleSaveDraft(false)
    }, 30000)
    return () => clearInterval(interval)
  }, [handleSaveDraft, currentStep])

  const handleLoadDraft = () => {
    const draft = loadDraft('create')
    if (draft) {
      applyDraftObject(draft)
      setShowDraftModal(false)
      setSuccessMsg('Draft successfully loaded.')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft('create')
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  // Handle selecting one or multiple image files
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const validFiles = []
    const newPreviews = []

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`"${file.name}" exceeds 5MB limit.`)
        continue
      }
      if (!allowed.includes(file.type)) {
        setError(`"${file.name}" has an unsupported format.`)
        continue
      }
      validFiles.push(file)
      newPreviews.push(URL.createObjectURL(file))
    }

    if (validFiles.length > 0) {
      setImageFiles((prev) => [...prev, ...validFiles])
      setImagePreviews((prev) => [...prev, ...newPreviews])
      setError('')
    }
  }

  const handleRemovePreview = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSelectPreset = (url) => {
    setImagePreviews((prev) => (prev.includes(url) ? prev : [...prev, url]))
    setUploadedImages((prev) => (prev.includes(url) ? prev : [...prev, url]))
    setError('')
  }

  const handleUploadImages = async () => {
    if (imageFiles.length === 0) {
      if (uploadedImages.length > 0 || imagePreviews.length > 0) {
        if (uploadedImages.length === 0) setUploadedImages(imagePreviews)
        setCurrentStep('form')
        return
      }
      setError('Please select at least one image or preset.')
      return
    }

    try {
      setUploading(true)
      setError('')
      const result = await uploadService.uploadMultipleImages(imageFiles)
      if (result.success && result.data.length > 0) {
        const urls = result.data.map((d) => d.url)
        const presetUrls = uploadedImages.filter((u) => u.startsWith('/guns/'))
        const combined = Array.from(new Set([...presetUrls, ...urls]))
        setUploadedImages(combined)
        setImagePreviews(combined)
        setImageFiles([])
        setCurrentStep('form')
      } else {
        throw new Error('Failed to upload images.')
      }
    } catch (err) {
      console.warn('Multi-upload fallback to local previews:', err)
      setUploadedImages(
        imagePreviews.length > 0 ? imagePreviews : ['/guns/pistol.svg'],
      )
      setCurrentStep('form')
    } finally {
      setUploading(false)
    }
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
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

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps.filter((s) => s.trim()).map((s) => s.trim())
    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance / assembly step.')
      return
    }

    const finalImages =
      uploadedImages.length > 0
        ? uploadedImages
        : imagePreviews.length > 0
        ? imagePreviews
        : ['/guns/pistol.svg']

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      caliber: formData.caliber,
      price: Number(formData.price) || 500,
      category: formData.category || 'makanan',
      description:
        formData.description.trim() ||
        `${formData.type} caliber ${formData.caliber}.`,
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
      setCreating(true)
      const response = await gunService.createGun(payload)
      if (response.success || response.data) {
        deleteDraft('create')
        if (response.isOffline) {
          setSuccessMsg(
            'Hardware saved locally (Offline mode). It will be committed to database when back online.',
          )
          setTimeout(() => {
            if (onSuccess) onSuccess(response.data)
            else if (onBack) onBack()
          }, 1200)
        } else {
          if (onSuccess) onSuccess(response.data)
          else if (onBack) onBack()
        }
      } else {
        throw new Error(response.message || 'Failed to create product.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while saving product to server.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="form-page">
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
      </div>

      <div className="form-title-group">
        <h1 className="display">Register New Hardware</h1>
        <p className="lede">
          Upload one or multiple images per catalog item, configure specifications,
          or save as a draft.
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

      <div className="form-steps-nav">
        <div
          className={`step-badge ${
            currentStep === 'upload' ? 'step-badge--active' : 'step-badge--done'
          }`}
        >
          1. Multi-Imagery ({imagePreviews.length})
        </div>
        <div className="step-badge-connector" />
        <div
          className={`step-badge ${
            currentStep === 'form' ? 'step-badge--active' : ''
          }`}
        >
          2. Specifications &amp; Details
        </div>
      </div>

      {/* STEP 1: Multi-Image Upload */}
      {currentStep === 'upload' && (
        <div className="card-box">
          <h2 className="card-box-title">Weapon Imagery (Multi-Photo Support)</h2>
          <p className="card-box-desc">
            Select one or multiple photographs/blueprints (max 5MB each), or combine
            armory presets.
          </p>

          <div className="upload-dropzone">
            <input
              id="gun-image-input"
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden-file-input"
            />
            <label htmlFor="gun-image-input" className="upload-label">
              <Upload size={36} className="upload-icon" />
              <span className="upload-main-text">
                Click to select one or multiple images
              </span>
              <span className="upload-sub-text">
                Supports multiple JPG, PNG, or WebP files up to 5MB each
              </span>
            </label>

            <div className="preset-selector">
              <span className="preset-title">Add stock presets to gallery:</span>
              <div className="preset-pills">
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleSelectPreset('/guns/pistol.svg')}
                >
                  + Pistol Vector
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleSelectPreset('/guns/rifle.svg')}
                >
                  + Rifle Vector
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleSelectPreset('/guns/shotgun.svg')}
                >
                  + Shotgun Vector
                </button>
              </div>
            </div>
          </div>

          {imagePreviews.length > 0 && (
            <div className="preview-container" style={{ marginTop: '20px' }}>
              <div
                className="multi-preview-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '12px',
                  width: '100%',
                }}
              >
                {imagePreviews.map((src, idx) => (
                  <div
                    key={idx}
                    className="preview-image-wrap"
                    style={{ height: '120px', maxWidth: '100%' }}
                  >
                    <img
                      src={src}
                      alt={`Preview ${idx + 1}`}
                      className="preview-img"
                    />
                    {idx === 0 && (
                      <span
                        className="mono-badge"
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          left: '6px',
                          background: 'rgba(0,0,0,0.75)',
                          color: '#fff',
                          fontSize: '0.7rem',
                        }}
                      >
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      className="preview-remove-btn"
                      onClick={() => handleRemovePreview(idx)}
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="preview-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--outline btn--save-draft"
                  onClick={() => handleSaveDraft(true)}
                  disabled={uploading}
                  title="Save draft"
                >
                  <Save size={16} /> Save Draft
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleUploadImages}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader size={18} className="spin" /> Uploading{' '}
                      {imageFiles.length} Image(s)…
                    </>
                  ) : (
                    <>
                      <Images size={18} /> Confirm {imagePreviews.length} Image(s)
                      &amp; Continue
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Product Form */}
      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="entry-form">
          <div className="selected-thumb-bar" style={{ flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
              {(uploadedImages.length > 0 ? uploadedImages : imagePreviews).map(
                (src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`Selected ${idx + 1}`}
                    className="thumb-small"
                  />
                ),
              )}
            </div>
            <div className="thumb-info">
              <span className="thumb-title">
                {(uploadedImages.length || imagePreviews.length)} Image(s) Assigned
              </span>
              <span className="thumb-sub">Ready for multi-photo catalog entry</span>
            </div>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCurrentStep('upload')}
            >
              Manage Images
            </button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Model Designation <span className="req">*</span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="e.g. Glock 19 Gen 5, Colt M4A1..."
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="type" className="form-label">
                Platform / Category <span className="req">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={(e) => {
                  handleFormChange(e)
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                  }))
                }}
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
              <label htmlFor="caliber" className="form-label">
                Caliber / Chambering <span className="req">*</span>
              </label>
              <input
                id="caliber"
                type="text"
                name="caliber"
                value={formData.caliber}
                onChange={handleFormChange}
                placeholder="e.g. 9mm, 5.56mm, 12 Gauge"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price (USD) <span className="req">*</span>
              </label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                min="0"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Grade / Build Quality <span className="req">*</span>
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="form-select"
              >
                <option value="mudah">Commercial / Standard</option>
                <option value="sedang">Mil-Spec / Service Issue</option>
                <option value="sulit">Match Grade / Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Armory Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="Operational background, ergonomics, intended mission profile..."
              rows={3}
              className="form-textarea"
            />
          </div>

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
                    placeholder="Attribute"
                    value={spec.name}
                    onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="Value"
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
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--outline btn--save-draft"
              onClick={() => handleSaveDraft(true)}
              disabled={creating}
              title="Save draft"
            >
              <Save size={16} /> Save Draft
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader size={18} className="spin" /> Uploading Item…
                </>
              ) : (
                'Upload Item'
              )}
            </button>
          </div>
        </form>
      )}

      <ConfirmModal
        open={showDraftModal}
        title="Resume Previous Draft?"
        message={`An unfinished draft from ${
          draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'
        } was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
