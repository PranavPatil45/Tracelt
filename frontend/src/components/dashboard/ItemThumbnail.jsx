import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import { getItemImageUrl } from '../../utils/imageUrl.js'
import './ItemThumbnail.css'

export default function ItemThumbnail({
  src,
  alt = 'Item photo',
  fallbackIcon: FallbackIcon = Package,
  fallbackIconSize = 20,
  className = '',
  imgClassName = '',
  style = {},
}) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  const resolvedUrl = getItemImageUrl(src)

  if (!resolvedUrl || hasError) {
    return (
      <div
        className={`item-thumbnail item-thumbnail--fallback ${className}`.trim()}
        style={style}
        aria-label={alt}
      >
        <FallbackIcon
          size={fallbackIconSize}
          strokeWidth={1.5}
          className="item-thumbnail__fallback-icon"
        />
      </div>
    )
  }

  return (
    <div
      className={`item-thumbnail item-thumbnail--image ${className}`.trim()}
      style={style}
    >
      <img
        src={resolvedUrl}
        alt={alt}
        className={`item-thumbnail__img ${imgClassName}`.trim()}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  )
}
