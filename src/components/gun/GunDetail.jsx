import { useState } from 'react'
import {
  ArrowLeft,
  Star,
  Send,
  Loader,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import LazyImage from '../common/LazyImage'
import { useReviews, useCreateReview } from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'

export default function GunDetail({
  gun,
  onBack,
  onEdit,
  onDelete,
}) {
  const images =
    Array.isArray(gun.images) && gun.images.length > 0
      ? gun.images
      : [gun.image_url || gun.image || '/guns/pistol.svg']

  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [shareToast, setShareToast] = useState('')

  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  // Reviews
  const {
    reviews,
    loading: reviewsLoading,
    refetch: refetchReviews,
    updateReview,
    deleteReview,
    reactToReview,
  } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()

  // New review state
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Inline Edit state for own reviews
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const avgRating = averageRating(reviews) || gun.average_rating || 0
  const reviewCount = reviews.length || gun.review_count || 0

  const handlePrevImage = () => {
    setActiveImageIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setActiveImageIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }

    const result = await createReview(gun.id, {
      user_identifier: getUserIdentifier(),
      rating,
      comment: comment.trim(),
    })

    if (result) {
      setReviewSuccess('Review submitted!')
      setComment('')
      setRating(5)
      refetchReviews()
      setTimeout(() => setReviewSuccess(''), 3000)
    } else {
      setReviewError('Could not submit review.')
    }
  }

  const startEditingReview = (rev) => {
    setEditingReviewId(rev.id)
    setEditRating(rev.rating || 5)
    setEditComment(rev.comment || '')
  }

  const handleSaveReviewEdit = async (reviewId) => {
    setSavingEdit(true)
    await updateReview(reviewId, {
      rating: editRating,
      comment: editComment.trim(),
    })
    setSavingEdit(false)
    setEditingReviewId(null)
    setReviewSuccess('Your review has been updated.')
    setTimeout(() => setReviewSuccess(''), 3000)
  }

  const handleDeleteOwnReview = async (reviewId) => {
    if (window.confirm('Delete this review permanently?')) {
      await deleteReview(reviewId)
      setReviewSuccess('Your review has been deleted.')
      setTimeout(() => setReviewSuccess(''), 3000)
    }
  }

  return (
    <div className="detail">
      {/* Top Bar */}
      <div className="detail-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <ShareButton
          gun={gun}
          variant="button"
          onShared={(url) => {
            setShareToast(`Authentic link copied: ${url}`)
            setTimeout(() => setShareToast(''), 3500)
          }}
        />
      </div>

      {shareToast && <div className="toast toast--success">{shareToast}</div>}

      {/* Hero with Multi-Image Carousel */}
      <div className="detail-hero">
        <div className="detail-gallery">
          <div className="detail-main-img-wrap" style={{ position: 'relative' }}>
            <LazyImage
              className="detail-img"
              src={images[activeImageIdx] || images[0]}
              alt={`${gun.name} — view ${activeImageIdx + 1}`}
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-nav gallery-nav--prev"
                  onClick={handlePrevImage}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="gallery-nav gallery-nav--next"
                  onClick={handleNextImage}
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="gallery-counter">
                  {activeImageIdx + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="detail-thumbs">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`detail-thumb-btn ${idx === activeImageIdx ? 'detail-thumb-btn--active' : ''}`}
                  onClick={() => setActiveImageIdx(idx)}
                  aria-label={`Select image ${idx + 1}`}
                >
                  <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions" style={{ flexWrap: 'wrap' }}>
            <FavoriteButton gunId={gun.id || gun.name} />
            {onEdit && (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => onEdit(gun)}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => onDelete(gun)}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>{step.instruction || step}</li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Operator Reviews ({reviews.length})</h2>

        {/* Submit new review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Write a review for this firearm…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !gun.id}
          >
            {submitting ? (
              <>
                <Loader size={16} className="spin" /> Submitting…
              </>
            ) : (
              <>
                <Send size={16} /> Submit Review
              </>
            )}
          </button>

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
        </form>

        {/* Existing reviews list */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => {
              const isEditing = editingReviewId === rev.id
              return (
                <li key={rev.id} className="review-item">
                  <div className="review-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="review-user">{rev.user_identifier || 'Anonymous'}</span>
                      {rev.isOwn && (
                        <span className="mono-badge" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                          Your Review
                        </span>
                      )}
                    </div>
                    <span className="review-stars-display">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={14}
                          fill={i < rev.rating ? 'var(--brass)' : 'none'}
                          stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                        />
                      ))}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="review-edit-box" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="review-stars">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="star-btn"
                            onClick={() => setEditRating(n)}
                          >
                            <Star
                              size={18}
                              fill={n <= editRating ? 'var(--brass)' : 'none'}
                              stroke={n <= editRating ? 'var(--brass)' : 'var(--steel)'}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="review-input"
                        rows="2"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={savingEdit}
                          onClick={() => handleSaveReviewEdit(rev.id)}
                        >
                          <Check size={14} /> Save
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => setEditingReviewId(null)}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {rev.comment && <p className="review-comment">{rev.comment}</p>}

                      {/* Review Actions: Own review -> Edit & Delete; Other's review -> Like & Dislike */}
                      <div className="review-actions-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                        {rev.isOwn ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              onClick={() => startEditingReview(rev)}
                              title="Edit your review"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger-ghost btn--sm"
                              onClick={() => handleDeleteOwnReview(rev.id)}
                              title="Delete your review"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`reaction-btn ${rev.userReaction === 'like' ? 'reaction-btn--active' : ''}`}
                              onClick={() => reactToReview(rev, 'like')}
                              title="Helpful review (Thumbs Up)"
                            >
                              <ThumbsUp size={14} />
                              <span>{rev.likes || 0}</span>
                            </button>
                            <button
                              type="button"
                              className={`reaction-btn ${rev.userReaction === 'dislike' ? 'reaction-btn--dislike-active' : ''}`}
                              onClick={() => reactToReview(rev, 'dislike')}
                              title="Not helpful (Thumbs Down)"
                            >
                              <ThumbsDown size={14} />
                              <span>{rev.dislikes || 0}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first!</p>
        )}
      </section>
    </div>
  )
}
