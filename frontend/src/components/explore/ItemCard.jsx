import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Calendar, ArrowRight, Package, UserCheck } from 'lucide-react'
import { getItemImageUrl } from '../../utils/imageUrl.js'
import { formatDate } from '../../utils/dateUtils.js'
import './ItemCard.css'

export default function ItemCard({ item, currentUserId }) {
  const [imgError, setImgError] = useState(false)

  const isLost = item.type === 'LOST'
  const isFound = item.type === 'FOUND'
  const isOwner = Boolean(currentUserId && item.user_id === currentUserId)

  const detailUrl = isLost ? `/lost-items/${item.id}` : `/found-items/${item.id}`
  const resolvedImageUrl = getItemImageUrl(item.image_url)

  function getStatusDotClass(status) {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'explore-card__status-dot--active'
      case 'AVAILABLE':
        return 'explore-card__status-dot--available'
      case 'MATCHED':
        return 'explore-card__status-dot--matched'
      case 'CLAIMED':
        return 'explore-card__status-dot--claimed'
      case 'RECOVERED':
        return 'explore-card__status-dot--recovered'
      case 'RETURNED':
        return 'explore-card__status-dot--returned'
      case 'CLOSED':
        return 'explore-card__status-dot--closed'
      default:
        return ''
    }
  }

  return (
    <article
      className={`explore-card ${isLost ? 'explore-card--lost' : 'explore-card--found'}`}
    >
      {/* Media Thumbnail */}
      <div className="explore-card__media">
        {resolvedImageUrl && !imgError ? (
          <img
            src={resolvedImageUrl}
            alt={item.title}
            className="explore-card__img"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="explore-card__placeholder">
            <Package size={38} strokeWidth={1.5} />
            <span className="explore-card__placeholder-cat">{item.category}</span>
          </div>
        )}

        {/* Badges Overlay */}
        <div className="explore-card__badges">
          <span
            className={`explore-type-badge ${
              isLost ? 'explore-type-badge--lost' : 'explore-type-badge--found'
            }`}
          >
            {isLost ? '🟠 LOST' : '🟢 FOUND'}
          </span>

          {isOwner && (
            <span className="explore-owner-badge" title="You reported this item">
              <UserCheck size={11} style={{ display: 'inline', marginRight: '3px' }} />
              Your Report
            </span>
          )}
        </div>
      </div>

      {/* Body Information */}
      <div className="explore-card__body">
        <span className="explore-card__category">{item.category}</span>
        <h3 className="explore-card__title" title={item.title}>
          {item.title}
        </h3>

        <div className="explore-card__meta">
          <div className="explore-card__meta-item" title={item.location}>
            <MapPin size={13} />
            <span>{item.location}</span>
          </div>
          <div className="explore-card__meta-item">
            <Calendar size={13} />
            <span>
              {isLost ? 'Lost:' : 'Found:'} {formatDate(item.date)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="explore-card__footer">
          <span className="explore-card__status">
            <span
              className={`explore-card__status-dot ${getStatusDotClass(item.status)}`}
            />
            {item.status}
          </span>

          <Link to={detailUrl} className="explore-card__btn">
            View Details <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  )
}
