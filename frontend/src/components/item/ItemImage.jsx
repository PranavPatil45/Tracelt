import { useState } from 'react'
import { Package, ImageOff, Maximize2, X } from 'lucide-react'
import { getItemImageUrl } from '../../utils/imageUrl.js'

export default function ItemImage({ imageUrl, title, category }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const resolvedUrl = getItemImageUrl(imageUrl)

  if (!resolvedUrl || hasError) {
    return (
      <div className="item-detail-img-box item-detail-img-box--empty" aria-label="No image available">
        {hasError ? (
          <>
            <ImageOff size={48} className="item-detail-placeholder-icon" />
            <span className="item-detail-placeholder-text">Image could not be loaded</span>
          </>
        ) : (
          <>
            <Package size={52} className="item-detail-placeholder-icon" strokeWidth={1.4} />
            <span className="item-detail-placeholder-text">No photo attached</span>
            <span className="item-detail-placeholder-sub">{category || 'Campus item'}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="item-detail-img-box">
        {!imageLoaded && (
          <div className="item-detail-img-skeleton" aria-hidden="true" />
        )}
        <img
          src={resolvedUrl}
          alt={title}
          className={`item-detail-img ${imageLoaded ? 'item-detail-img--loaded' : ''}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setHasError(true)
            setImageLoaded(true)
          }}
          loading="eager"
        />

        {imageLoaded && !hasError && (
          <button
            type="button"
            className="item-detail-zoom-btn"
            onClick={() => setLightboxOpen(true)}
            title="View full size image"
            aria-label="Enlarge image"
          >
            <Maximize2 size={16} />
            <span>Enlarge</span>
          </button>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="item-lightbox-backdrop"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div className="item-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="item-lightbox-close"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close enlarged preview"
            >
              <X size={24} />
            </button>
            <img src={resolvedUrl} alt={title} className="item-lightbox-img" />
            <div className="item-lightbox-caption">{title}</div>
          </div>
        </div>
      )}
    </>
  )
}
