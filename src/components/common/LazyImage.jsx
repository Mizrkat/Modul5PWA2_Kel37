import { useState, useEffect, useRef } from 'react'

/**
 * LazyImage — Defers loading an image until it enters (or approaches) the
 * viewport using IntersectionObserver + native `loading="lazy"`.
 * Also preserves clean image URLs so the browser serves cached images directly
 * from `(disk cache)`.
 */
export default function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  fallbackSrc = '/guns/pistol.svg',
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [imgSrc, setImgSrc] = useState(src || fallbackSrc)
  const containerRef = useRef(null)

  useEffect(() => {
    setImgSrc(src || fallbackSrc)
    setIsLoaded(false)
  }, [src, fallbackSrc])

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin: '120px 0px', threshold: 0.01 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`lazy-img-wrapper ${className} ${isLoaded ? 'lazy-img--loaded' : 'lazy-img--loading'}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {!isLoaded && <div className="lazy-img-skeleton" aria-hidden="true" />}
      {isVisible && (
        <img
          src={imgSrc}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          className={className}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (imgSrc !== fallbackSrc) {
              setImgSrc(fallbackSrc)
            }
            setIsLoaded(true)
          }}
          style={{
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.28s ease-in-out',
          }}
        />
      )}
    </div>
  )
}
